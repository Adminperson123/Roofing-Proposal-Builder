/**
 * POST /api/proposal/[id]/send  — send a proposal to the customer (v3.7).
 *
 * Texts the customer their proposal link via GHL. The rep can pass a custom
 * message; otherwise a sensible default is used. Best-effort GHL contact
 * upsert, then SMS. Stamps sent_at / sent_channels on the proposal.
 *
 * Body (JSON, optional): { message }
 * Auth: requireAuth (admin only).
 */

import { serverClient } from '../../../../lib/supabase'
import { ensureContactAndSendSms } from '../../../../lib/ghl'
import { requireAuth } from '../../../../lib/auth'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'proposal id required' })

  const sb = serverClient()
  const { data: p, error } = await sb
    .from('proposals')
    .select('id, prop_num, customer_name, customer_phone, customer_email, ghl_contact_id')
    .eq('id', id)
    .single()
  if (error || !p) return res.status(404).json({ error: 'Proposal not found' })

  if (!p.customer_phone && !p.ghl_contact_id) {
    return res.status(400).json({ error: 'This customer has no phone number on file.' })
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
  const shareUrl = `${base.replace(/\/$/, '')}/p/${p.id}`
  const firstName = (p.customer_name || '').split(/\s+/)[0] || 'there'

  const message = (req.body?.message && String(req.body.message).trim())
    || `Hi ${firstName}, this is Good People Roofing. Here's your roofing proposal #${p.prop_num}: ${shareUrl}\n\nIt has three options to choose from — reply with any questions.`

  const result = await ensureContactAndSendSms({
    contactId: p.ghl_contact_id || null,
    phone: p.customer_phone,
    name: p.customer_name,
    email: p.customer_email,
    message,
  })

  // Stamp the proposal regardless, so the rep sees it was attempted.
  const updates = { sent_at: new Date().toISOString() }
  if (result.ok) {
    updates.sent_channels = ['sms']
    if (result.contactId && result.contactId !== p.ghl_contact_id) updates.ghl_contact_id = result.contactId
  }
  await sb.from('proposals').update(updates).eq('id', p.id)

  if (!result.ok) return res.status(502).json({ error: 'SMS failed: ' + (result.error || 'unknown') })
  return res.status(200).json({ ok: true, contactId: result.contactId, shareUrl })
}

export default requireAuth(handler)
