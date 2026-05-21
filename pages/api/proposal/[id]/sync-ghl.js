/**
 * POST /api/proposal/[id]/sync-ghl  — push a proposal's customer into GHL.
 *
 * Checks if the customer already exists in GoHighLevel (GHL's /contacts/upsert
 * matches on phone/email) — creates them if not, updates them if so. Tags the
 * contact with the proposal status, and writes the proposal link into a GHL
 * custom field so the two systems cross-reference.
 *
 * The custom field is env-configurable — set GHL_PROPOSAL_FIELD_KEY to the
 * field key (e.g. "contact.proposal_link"). Until it's set, the contact
 * check/create + tagging still run; only the custom-field write is skipped.
 *
 * Auth: requireAuth (admin only).
 */

import { serverClient } from '../../../../lib/supabase'
import { upsertContact, addContactTags } from '../../../../lib/ghl'
import { requireAuth } from '../../../../lib/auth'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'proposal id required' })

  const sb = serverClient()
  const { data: p, error } = await sb
    .from('proposals')
    .select('id, prop_num, customer_name, customer_phone, customer_email, customer_address, ghl_contact_id, status')
    .eq('id', id)
    .single()
  if (error || !p) return res.status(404).json({ error: 'Proposal not found' })

  if (!p.customer_phone && !p.customer_email) {
    return res.status(400).json({ error: 'Customer has no phone or email — cannot match in GHL.' })
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
  const shareUrl = `${base.replace(/\/$/, '')}/p/${p.id}`

  // Cross-reference custom field — env-configurable. Skipped cleanly if unset.
  const fieldKey = process.env.GHL_PROPOSAL_FIELD_KEY
  const customFields = fieldKey ? [{ key: fieldKey, field_value: shareUrl }] : undefined

  const up = await upsertContact({
    name: p.customer_name,
    phone: p.customer_phone,
    email: p.customer_email,
    address: p.customer_address,
    customFields,
  })
  if (!up.ok) return res.status(502).json({ error: 'GHL sync failed: ' + (up.error || 'unknown') })

  // Tag with proposal status so GHL workflows/pipelines can cross-reference.
  await addContactTags(up.contactId, [`proposal-${p.status || 'sent'}`])

  await sb.from('proposals').update({
    ghl_contact_id: up.contactId,
    ghl_synced_at: new Date().toISOString(),
  }).eq('id', p.id)

  return res.status(200).json({
    ok: true,
    contactId: up.contactId,
    matched: up.isNew ? 'created a new GHL contact' : 'updated the existing GHL contact',
    customFieldUpdated: !!fieldKey,
  })
}

export default requireAuth(handler)
