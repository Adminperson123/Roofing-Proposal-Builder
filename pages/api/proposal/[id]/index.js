import { serverClient } from '../../../../lib/supabase'
import { isAuthed } from '../../../../lib/auth'

export default async function handler(req, res) {
  const { id } = req.query
  const sb = serverClient()

  if (req.method === 'GET') {
    const { data, error } = await sb.from('proposals').select('*').eq('id', id).single()
    if (error || !data) return res.status(404).json({ error: 'Not found' })

    if (isAuthed(req)) return res.status(200).json(data)
    return res.status(200).json(redact(data))
  }

  if (req.method === 'PUT') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' })
    // Admin-only status flip. 'expired' = customer not moving forward (paused /
    // declined); 'sent' = reactivated. Pulls it out of the active pipeline math.
    const next = req.body?.status
    if (!['sent', 'expired'].includes(next)) {
      return res.status(400).json({ error: "status must be 'sent' or 'expired'" })
    }
    const { error } = await sb.from('proposals').update({ status: next }).eq('id', id)
    if (error) return res.status(500).json({ error: 'Update failed' })
    return res.status(200).json({ ok: true, status: next })
  }

  if (req.method === 'DELETE') {
    if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' })
    const { error } = await sb.from('proposals').delete().eq('id', id)
    if (error) return res.status(500).json({ error: 'Delete failed' })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

function redact(p) {
  // Customer-facing endpoint should not leak admin metadata
  const { ghl_contact_id, accepted_signature, accepted_ip, ...safe } = p
  return safe
}
