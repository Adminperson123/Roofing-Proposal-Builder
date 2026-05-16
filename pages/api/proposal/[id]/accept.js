import { serverClient } from '../../../../lib/supabase'

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
    .select('id, prop_num, customer_name, selected_tier')
    .single()

  if (error) return res.status(500).json({ error: 'Accept failed' })
  res.status(200).json({ ok: true, proposal: data })
}
