import { serverClient } from '../../lib/supabase'
import { generateTiers } from '../../lib/openai'
import { calcPrices, newPropNum } from '../../lib/pricing'
import { ensureContactAndSendSms } from '../../lib/ghl'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { customer, scope, settings } = req.body || {}
    if (!customer?.name || !scope?.roofType) {
      return res.status(400).json({ error: 'Missing customer.name or scope.roofType' })
    }

    const prices = calcPrices(scope, settings)
    const { tiers, coverLetter } = await generateTiers({ customer, scope, prices })
    const propNum = newPropNum()

    const sb = serverClient()
    const { data, error } = await sb
      .from('proposals')
      .insert({
        prop_num: propNum,
        status: 'sent',
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        rep_name: customer.rep || null,
        ghl_contact_id: customer.ghlId || null,
        inspection_notes: customer.notes || null,
        roof_type: scope.roofType,
        tile_subtype: scope.tileSubtype || null,
        squares: scope.squares,
        pitch: scope.pitch,
        stories: scope.stories,
        layers: scope.layers,
        decking_sheets: scope.deckingSheets || 0,
        permit_amount: scope.permit || 0,
        addons: scope.addons || [],
        tiers,
        cover_letter: coverLetter || null,
      })
      .select('id, prop_num')
      .single()

    if (error) throw error

    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const shareUrl = `${base.replace(/\/$/, '')}/p/${data.id}`

    // === Auto-text the proposal link to the customer (best-effort, non-blocking) ===
    // We intentionally DO NOT throw if SMS fails — the proposal is already saved.
    // Any failure is logged + reported back in the response so the rep can retry manually.
    const smsResult = await maybeSendProposalSms({
      customer,
      shareUrl,
      propNum: data.prop_num,
      proposalId: data.id,
      sb,
    })

    res.status(200).json({
      id: data.id,
      propNum: data.prop_num,
      shareUrl,
      tiers,
      prices,
      sms: smsResult, // { ok, error?, contactId? } — visible to the admin UI for visibility
    })
  } catch (err) {
    console.error('generate error:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * Try to text the customer their proposal link. Always returns a result object;
 * never throws. If anything fails we log and move on — the proposal still got saved.
 */
async function maybeSendProposalSms({ customer, shareUrl, propNum, proposalId, sb }) {
  if (!customer?.phone && !customer?.ghlId) {
    return { ok: false, skipped: true, reason: 'no phone or ghl_contact_id on customer' }
  }

  const firstName = (customer.name || '').split(/\s+/)[0] || 'there'
  const message =
    `Hi ${firstName}, this is Good People Roofing. Your proposal #${propNum} is ready to view: ${shareUrl}\n\n` +
    `It includes three options (Good / Better / Best) you can pick from. Reply to this text with any questions.`

  try {
    const result = await ensureContactAndSendSms({
      contactId: customer.ghlId || null,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      message,
    })

    // Always stamp sent_at so we know we tried. If GHL succeeded, record the channel
    // and persist any newly-created contactId back to the proposal row.
    const updates = { sent_at: new Date().toISOString() }
    if (result.ok) {
      updates.sent_channels = ['sms']
      if (result.contactId && result.contactId !== customer.ghlId) {
        updates.ghl_contact_id = result.contactId
      }
    } else {
      updates.sent_channels = []
    }
    await sb.from('proposals').update(updates).eq('id', proposalId)

    if (!result.ok) {
      console.error('SMS to customer failed:', result.error)
      return { ok: false, error: result.error, contactId: result.contactId }
    }
    return { ok: true, contactId: result.contactId }
  } catch (err) {
    console.error('SMS helper threw unexpectedly:', err)
    return { ok: false, error: err.message || String(err) }
  }
}
