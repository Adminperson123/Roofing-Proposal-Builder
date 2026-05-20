import { serverClient } from '../../../../lib/supabase'
import { upsertContact, addContactTags, findPipelineStageByName, upsertOpportunity } from '../../../../lib/ghl'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query
  const { tier, signature } = req.body || {}

  if (!['good','better','best'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be good|better|best' })
  }

  const sb = serverClient()

  // Idempotency — refuse if already accepted
  const { data: cur } = await sb.from('proposals').select('status, selected_tier, accepted_at, superseded_by_id').eq('id', id).single()
  if (!cur) return res.status(404).json({ error: 'Not found' })
  if (cur.superseded_by_id) return res.status(409).json({ error: 'This proposal has been updated. Please open the latest version.' })
  if (cur.status === 'accepted') {
    return res.status(409).json({ error: 'Already accepted', selected_tier: cur.selected_tier, accepted_at: cur.accepted_at })
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim()
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
    .select('id, prop_num, customer_name, customer_phone, customer_email, customer_address, ghl_contact_id, selected_tier, tiers, accepted_total')
    .single()

  if (error) return res.status(500).json({ error: 'Accept failed' })

  // Sync the accepted proposal into GHL (contact + tags + opportunity). Best-effort.
  const ghl = await syncAcceptedProposalToGhl({ proposal: data, sb })

  res.status(200).json({ ok: true, proposal: data, ghl })
}

/**
 * Push an accepted proposal into GHL: upsert the contact, tag it
 * 'proposal-accepted' + 'tier-<good|better|best>', and move/create an
 * opportunity in the "accepted" pipeline stage. Never throws.
 */
async function syncAcceptedProposalToGhl({ proposal, sb }) {
  const result = { contact: null, tags: null, opportunity: null }
  try {
    const up = await upsertContact({
      name: proposal.customer_name,
      phone: proposal.customer_phone,
      email: proposal.customer_email,
      address: proposal.customer_address,
    })
    result.contact = up
    const contactId = up.contactId || proposal.ghl_contact_id
    if (!contactId) {
      console.error('GHL sync — no contactId after upsert:', up.error)
      return result
    }

    result.tags = await addContactTags(contactId, ['proposal-accepted', `tier-${proposal.selected_tier}`])

    const pipelineLookup = await findPipelineStageByName(
      process.env.GHL_PIPELINE_NAME_HINT || 'proposal',
      process.env.GHL_ACCEPTED_STAGE_HINT || 'accepted'
    )
    let opportunityId = null
    if (pipelineLookup.ok) {
      const opp = await upsertOpportunity({
        contactId,
        pipelineId: pipelineLookup.pipelineId,
        pipelineStageId: pipelineLookup.stageId,
        name: `${proposal.customer_name} — Proposal #${proposal.prop_num}`,
        monetaryValue: computeMonetaryValue(proposal),
        status: 'won',
      })
      result.opportunity = opp
      opportunityId = opp.opportunityId || null
    } else {
      result.opportunity = { ok: false, skipped: true, reason: pipelineLookup.error }
    }

    await sb.from('proposals').update({
      ghl_synced_at: new Date().toISOString(),
      ghl_contact_id: contactId,
      ghl_opportunity_id: opportunityId || proposal.ghl_opportunity_id || null,
    }).eq('id', proposal.id)

    return result
  } catch (err) {
    console.error('GHL sync threw unexpectedly:', err)
    return { ...result, fatalError: err.message || String(err) }
  }
}

/** Dollar value for the opportunity: accepted_total, else the selected tier's price. */
function computeMonetaryValue(proposal) {
  if (proposal.accepted_total) return Number(proposal.accepted_total)
  const tierPrice = proposal.tiers?.[proposal.selected_tier]?.price
  return tierPrice ? Number(tierPrice) : null
}
