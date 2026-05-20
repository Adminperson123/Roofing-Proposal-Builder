import { serverClient } from '../../../../lib/supabase'
import {
  upsertContact,
  addContactTags,
  findPipelineStageByName,
  upsertOpportunity,
} from '../../../../lib/ghl'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query
  const { tier, signature } = req.body || {}

  if (!['good', 'better', 'best'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be good|better|best' })
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim()
  const sb = serverClient()
  const { data, error } = await sb
    .from('proposals')
    .update({
      status: 'accepted',
      selected_tier: tier,
      accepted_at: new Date().toISOString(),
      accepted_signature: signature || null,
      accepted_ip: ip || null,
    })
    .eq('id', id)
    // Pull every column we need for GHL sync in a single query
    .select('id, prop_num, customer_name, customer_phone, customer_email, customer_address, ghl_contact_id, selected_tier, tiers, accepted_total')
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // === Sync to GHL: contact + tags + opportunity. Best-effort, never blocks. ===
  const ghlResult = await syncAcceptedProposalToGhl({ proposal: data, sb })

  res.status(200).json({ ok: true, proposal: data, ghl: ghlResult })
}

/**
 * Push the accepted proposal into GHL:
 *   1. Make sure the customer exists as a GHL contact (reuse stored ghl_contact_id when we have one).
 *   2. Tag the contact with 'proposal-accepted' + 'tier-{good|better|best}'.
 *   3. Find the right pipeline + stage by name, create/move opportunity if found.
 *   4. Stamp ghl_synced_at + ghl_opportunity_id back to the proposal row.
 *
 * Returns a structured result so we can see exactly which steps succeeded/failed.
 * Never throws — caller can safely ignore failures.
 */
async function syncAcceptedProposalToGhl({ proposal, sb }) {
  const result = { contact: null, tags: null, opportunity: null }

  try {
    // 1. Upsert contact (skips API call inside helper if no creds — returns ok:false safely)
    const up = await upsertContact({
      name: proposal.customer_name,
      phone: proposal.customer_phone,
      email: proposal.customer_email,
      address: proposal.customer_address,
    })
    result.contact = up
    const contactId = up.contactId || proposal.ghl_contact_id
    if (!contactId) {
      console.error('Cannot sync to GHL — no contactId after upsert:', up.error)
      return result
    }

    // 2. Tag the contact (helps GHL workflows fire automations off "proposal-accepted")
    const tags = ['proposal-accepted', `tier-${proposal.selected_tier}`]
    result.tags = await addContactTags(contactId, tags)

    // 3. Try to upsert an opportunity in the right pipeline stage.
    //    We search by name so this works across GHL accounts without hardcoded IDs.
    //    If GPR's pipeline is named differently, change the search strings here.
    const pipelineLookup = await findPipelineStageByName(
      process.env.GHL_PIPELINE_NAME_HINT || 'proposal',
      process.env.GHL_ACCEPTED_STAGE_HINT || 'accepted'
    )

    let opportunityId = null
    if (pipelineLookup.ok) {
      const monetary = computeMonetaryValue(proposal)
      const opp = await upsertOpportunity({
        contactId,
        pipelineId: pipelineLookup.pipelineId,
        pipelineStageId: pipelineLookup.stageId,
        name: `${proposal.customer_name} — Proposal #${proposal.prop_num}`,
        monetaryValue: monetary,
        status: 'won',
      })
      result.opportunity = opp
      opportunityId = opp.opportunityId || null
    } else {
      console.log('No matching pipeline/stage — skipping opportunity sync:', pipelineLookup.error)
      result.opportunity = { ok: false, skipped: true, reason: pipelineLookup.error }
    }

    // 4. Stamp the proposal so we don't re-sync on every read.
    await sb
      .from('proposals')
      .update({
        ghl_synced_at: new Date().toISOString(),
        ghl_contact_id: contactId,
        ghl_opportunity_id: opportunityId || proposal.ghl_opportunity_id || null,
      })
      .eq('id', proposal.id)

    return result
  } catch (err) {
    console.error('GHL sync threw unexpectedly:', err)
    return { ...result, fatalError: err.message || String(err) }
  }
}

/**
 * Best-effort dollar value for the opportunity.
 * Falls back through: accepted_total → matching tier price in tiers JSON → null.
 */
function computeMonetaryValue(proposal) {
  if (proposal.accepted_total) return Number(proposal.accepted_total)
  const tierPrice = proposal.tiers?.tiers?.[proposal.selected_tier]?.price
  if (tierPrice) return Number(tierPrice)
  return null
}
