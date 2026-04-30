import { serverClient } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const sb = serverClient()
  const { data, error } = await sb
    .from('proposals')
    .select('id, prop_num, status, customer_name, customer_address, rep_name, roof_type, squares, selected_tier, tiers, created_at, viewed_at, accepted_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json({ proposals: data || [] })
}
