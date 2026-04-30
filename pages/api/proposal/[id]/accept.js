import { serverClient } from '../../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query
  const { tier, signature } = req.body || {}

  if (!['good', 'better', 'best'].includes(tier)) {
    return res.status(400).json({ error: 'tier must be good|better|best' })
  }

  const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim()
  const sb = serverClient()
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

  if (error) return res.status(500).json({ error: error.message })

  // TODO: when GHL_API_TOKEN is set, also POST PDF to the contact's documents here.
  res.status(200).json({ ok: true, proposal: data })
}
