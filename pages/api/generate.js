import { serverClient } from '../../lib/supabase'
import { generateTiers } from '../../lib/openai'
import { calcPrices, newPropNum, DEFAULT_SETTINGS } from '../../lib/pricing'
import { requireAuth } from '../../lib/auth'
import { ensureContactAndSendSms } from '../../lib/ghl'

export const config = { maxDuration: 60 }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { customer, scope } = req.body || {}
    // ---- validation ----
    if (!customer?.name || !customer?.address) return res.status(400).json({ error: 'customer.name and customer.address are required' })
    if (!scope?.roofType || !['shingle','tile'].includes(scope.roofType)) return res.status(400).json({ error: 'scope.roofType must be shingle|tile' })
    if (!scope?.squares || +scope.squares <= 0) return res.status(400).json({ error: 'squares must be > 0' })
    if (!scope?.pitch   || +scope.pitch   <= 0) return res.status(400).json({ error: 'pitch must be > 0' })
    if (+scope.stories < 1) return res.status(400).json({ error: 'stories must be >= 1' })
    if (+scope.layers  < 1) return res.status(400).json({ error: 'layers must be >= 1' })

    const sb = serverClient()
    // pull live settings (fallback to defaults)
    let settings = DEFAULT_SETTINGS
    try {
      const { data } = await sb.from('settings').select('payload').eq('id', 'global').single()
      if (data?.payload) settings = { ...DEFAULT_SETTINGS, ...data.payload }
    } catch {}

    const prices = calcPrices(scope, settings)
    const { tiers, coverLetter } = await generateTiers({ customer, scope, prices })
    const propNum = newPropNum()

    const { data, error } = await sb
      .from('proposals')
      .insert({
        prop_num: propNum,
        status: 'sent',
        version_num: 1,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        rep_name: customer.rep || null,
        ghl_contact_id: customer.ghlId || null,
        inspection_notes: customer.notes || null,
        roof_type: scope.roofType,
        tile_subtype: scope.tileSubtype || null,
        squares: +scope.squares,
        pitch: +scope.pitch,
        stories: +scope.stories,
        layers: +scope.layers,
        decking_sheets: +scope.deckingSheets || 0,
        permit_amount: +scope.permit || 0,
        addons: scope.addons || [],
        tiers,
        cover_letter: coverLetter,
        photo_urls: customer.photoUrls || [],
        financing_enabled: settings.financing?.enabled !== false,
      })
      .select('id, prop_num')
      .single()
    if (error) throw error

    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const shareUrl = `${base.replace(/\/$/, '')}/p/${data.id}`

    // Auto-text the proposal link to the customer (best-effort — never blocks the response).
    const sms = await maybeSendProposalSms({ customer, shareUrl, propNum: data.prop_num, proposalId: data.id, sb })

    res.status(200).json({ id: data.id, propNum: data.prop_num, shareUrl, tiers, prices, coverLetter, sms })
  } catch (err) {
    console.error('generate error:', err)
    res.status(500).json({ error: 'Failed to generate proposal. Please try again.' })
  }
}

/**
 * Text the customer their proposal link. Always returns a result object; never throws.
 * The proposal is already saved by the time this runs — an SMS failure must not undo it.
 */
async function maybeSendProposalSms({ customer, shareUrl, propNum, proposalId, sb }) {
  if (!customer?.phone && !customer?.ghlId) {
    return { ok: false, skipped: true, reason: 'no phone or ghl_contact_id' }
  }
  const firstName = (customer.name || '').split(/\s+/)[0] || 'there'
  const message =
    `Hi ${firstName}, this is Good People Roofing. Your proposal #${propNum} is ready to view: ${shareUrl}\n\n` +
    `It includes three options (Good / Better / Best) you can pick from. Reply to this text with any questions.`
  try {
    const result = await ensureContactAndSendSms({
      contactId: customer.ghlId || null,
      phone: customer.phone, name: customer.name, email: customer.email, message,
    })
    const updates = { sent_at: new Date().toISOString() }
    if (result.ok) {
      updates.sent_channels = ['sms']
      if (result.contactId && result.contactId !== customer.ghlId) updates.ghl_contact_id = result.contactId
    } else {
      updates.sent_channels = []
    }
    await sb.from('proposals').update(updates).eq('id', proposalId)
    if (!result.ok) { console.error('SMS to customer failed:', result.error); return { ok: false, error: result.error } }
    return { ok: true, contactId: result.contactId }
  } catch (err) {
    console.error('SMS helper threw unexpectedly:', err)
    return { ok: false, error: err.message || String(err) }
  }
}

export default requireAuth(handler)
