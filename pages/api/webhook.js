/**
 * GHL Webhook — receives contact data from GHL workflow and stores in Supabase.
 * Frontend polls GET /api/webhook to pick up the latest unconsumed contact.
 * Replaces the broken in-memory `let pendingContact` from v2.
 */
import { serverClient } from '../../lib/supabase'
import { isAuthed } from '../../lib/auth'

export default async function handler(req, res) {
  const sb = serverClient()

  if (req.method === 'POST') {
    const body = req.body || {}
    const payload = {
      firstName: body.firstName  || body.first_name  || body.contact_first_name  || '',
      lastName:  body.lastName   || body.last_name   || body.contact_last_name   || '',
      email:     body.email      || body.contact_email                            || '',
      phone:     body.phone      || body.phone_number || body.contact_phone       || '',
      address:   body.address    || body.address1     || body.full_address        || '',
      city:      body.city                                                         || '',
      state:     body.state                                                        || '',
      zip:       body.zip        || body.postal_code                               || '',
      ghlContactId: body.contact_id || body.contactId || body.id || '',
    }
    const { error } = await sb.from('pending_contacts').insert({ payload, consumed: false })
    if (error) return res.status(500).json({ error: 'Webhook write failed' })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'GET') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' })
    const { data } = await sb
      .from('pending_contacts')
      .select('id, payload')
      .eq('consumed', false)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return res.status(200).json({ contact: null })
    // Mark consumed so we only return a contact once
    await sb.from('pending_contacts').update({ consumed: true }).eq('id', data.id)
    return res.status(200).json({ contact: data.payload })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
