// Logs a customer view event. Idempotent via DB INSERT (one row per view).
import { serverClient } from '../../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query

  const sb = serverClient()
  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim()
  const ua = (req.headers['user-agent'] || '').slice(0, 500)
  const ref = (req.headers.referer || req.headers.referrer || '').toString().slice(0, 500)

  // Insert event
  await sb.from('proposal_views').insert({ proposal_id: id, ip, user_agent: ua, referrer: ref })
  // Bump count + first viewed_at + status -> viewed (only if still 'sent')
  const { data: cur } = await sb.from('proposals').select('viewed_at, view_count, status').eq('id', id).single()
  const upd = {
    view_count: (cur?.view_count || 0) + 1,
    viewed_at: cur?.viewed_at || new Date().toISOString(),
  }
  if (cur?.status === 'sent') upd.status = 'viewed'
  await sb.from('proposals').update(upd).eq('id', id)
  res.status(200).json({ ok: true })
}
