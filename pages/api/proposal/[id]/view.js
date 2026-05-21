// Logs a customer view event. Idempotent via DB INSERT (one row per view).
// On the FIRST view (sent -> viewed) it also texts the rep so they can call
// while the proposal is still open on the customer's screen.
import { serverClient } from '../../../../lib/supabase'
import { ensureContactAndSendSms } from '../../../../lib/ghl'

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
  const { data: cur } = await sb
    .from('proposals')
    .select('viewed_at, view_count, status, prop_num, customer_name')
    .eq('id', id)
    .single()
  const upd = {
    view_count: (cur?.view_count || 0) + 1,
    viewed_at: cur?.viewed_at || new Date().toISOString(),
  }
  const isFirstView = cur?.status === 'sent'
  if (isFirstView) upd.status = 'viewed'
  await sb.from('proposals').update(upd).eq('id', id)

  // First view only — ping the rep. Fire-and-forget; never block the response.
  if (isFirstView) {
    notifyRepOfView({ id, propNum: cur?.prop_num, customer: cur?.customer_name })
      .catch(err => console.error('rep notification threw unexpectedly:', err))
  }

  res.status(200).json({ ok: true })
}

/**
 * Text the rep (shared sales number) the moment a customer first opens a proposal.
 * Uses REP_NOTIFICATION_PHONE — if unset, quietly skips, so the feature is
 * opt-in without a code change.
 */
async function notifyRepOfView({ id, propNum, customer }) {
  const repPhone = process.env.REP_NOTIFICATION_PHONE
  if (!repPhone) return

  const base = process.env.NEXT_PUBLIC_SITE_URL || ''
  const link = base ? `${base.replace(/\/$/, '')}/p/${id}` : `/p/${id}`
  const message =
    `🔥 ${customer || 'A customer'} just opened proposal #${propNum || id}. ` +
    `Call them NOW while it's open on their screen. ${link}`

  const result = await ensureContactAndSendSms({
    phone: repPhone,
    name: 'Sales Rep — Notifications',
    message,
  })
  if (!result.ok) console.error('Rep notification SMS failed:', result.error)
}
