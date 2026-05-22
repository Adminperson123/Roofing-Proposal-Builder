/**
 * POST /api/proposal/[id]/send — send a proposal to the customer (v3.7).
 *
 * Sends via SMS and/or Email through GHL. The rep composes the copy in the
 * Send modal; this endpoint upserts the GHL contact once, then dispatches to
 * each requested channel. Stamps sent_at + the channels that actually went out.
 *
 * Body (JSON, all optional — sensible defaults applied):
 *   { channels: ['sms','email'], smsMessage, emailSubject, emailBody }
 * An empty body falls back to a single SMS with default copy (legacy behavior).
 *
 * Auth: requireAuth (admin only).
 */

import { serverClient } from '../../../../lib/supabase'
import { upsertContact, sendSms, sendEmail } from '../../../../lib/ghl'
import { requireAuth } from '../../../../lib/auth'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'proposal id required' })

  const sb = serverClient()
  const { data: p, error } = await sb
    .from('proposals')
    .select('id, prop_num, customer_name, customer_phone, customer_email, ghl_contact_id, sent_channels')
    .eq('id', id)
    .single()
  if (error || !p) return res.status(404).json({ error: 'Proposal not found' })

  const base = (process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '')
  const shareUrl = `${base}/p/${p.id}`
  const firstName = (p.customer_name || '').split(/\s+/)[0] || 'there'

  const body = req.body || {}
  const channels = (Array.isArray(body.channels) && body.channels.length ? body.channels : ['sms'])
    .filter(c => c === 'sms' || c === 'email')
  if (!channels.length) return res.status(400).json({ error: 'No valid channel selected' })

  // Default copy if the rep didn't compose anything in the modal.
  const smsMessage = (body.smsMessage && String(body.smsMessage).trim())
    || `Hi ${firstName}, this is Good People Roofing. Here's your roofing proposal #${p.prop_num}: ${shareUrl}\n\nIt has three options to choose from — reply with any questions.`
  const emailSubject = (body.emailSubject && String(body.emailSubject).trim())
    || `Your Good People Roofing proposal #${p.prop_num}`
  const emailBody = (body.emailBody && String(body.emailBody).trim())
    || `Hi ${firstName},\n\nYour personalized roofing proposal is ready:\n${shareUrl}\n\nReply any time with questions.\n\n— Good People Roofing`

  // Make sure we can actually reach the customer on each requested channel.
  if (channels.includes('sms') && !p.customer_phone && !p.ghl_contact_id) {
    return res.status(400).json({ error: 'This customer has no phone number on file — cannot send SMS.' })
  }
  if (channels.includes('email') && !p.customer_email && !p.ghl_contact_id) {
    return res.status(400).json({ error: 'This customer has no email address on file — cannot send email.' })
  }

  // Upsert the GHL contact once so both channels share one contactId.
  let contactId = p.ghl_contact_id || null
  if (!contactId) {
    const up = await upsertContact({ name: p.customer_name, phone: p.customer_phone, email: p.customer_email })
    if (!up.ok) return res.status(502).json({ error: 'Could not reach GHL: ' + (up.error || 'unknown') })
    contactId = up.contactId
  }

  const results = {}
  if (channels.includes('sms')) {
    const r = await sendSms({ contactId, message: smsMessage })
    results.sms = { ok: r.ok, error: r.error || null }
  }
  if (channels.includes('email')) {
    const r = await sendEmail({ contactId, subject: emailSubject, message: emailBody })
    results.email = { ok: r.ok, error: r.error || null }
  }

  const succeeded = Object.entries(results).filter(([, v]) => v.ok).map(([k]) => k)

  // Stamp the proposal — merge newly-sent channels into any prior ones.
  const prior = Array.isArray(p.sent_channels) ? p.sent_channels : []
  const updates = { sent_at: new Date().toISOString() }
  if (succeeded.length) {
    updates.sent_channels = [...new Set([...prior, ...succeeded])]
    if (contactId && contactId !== p.ghl_contact_id) updates.ghl_contact_id = contactId
  }
  await sb.from('proposals').update(updates).eq('id', p.id)

  if (!succeeded.length) {
    const firstErr = Object.values(results).find(v => v.error)?.error || 'unknown error'
    return res.status(502).json({ error: 'Send failed: ' + firstErr, results })
  }
  return res.status(200).json({ ok: true, sent: succeeded, results, shareUrl, contactId })
}

export default requireAuth(handler)
