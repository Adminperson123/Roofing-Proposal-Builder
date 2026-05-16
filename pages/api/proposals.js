import { serverClient } from '../../lib/supabase'
import { requireAuth } from '../../lib/auth'

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const sb = serverClient()
  // Only show "head of chain" — proposals not superseded by a newer version.
  const { data, error } = await sb
    .from('proposals')
    .select('id, prop_num, status, customer_name, customer_phone, customer_email, customer_address, rep_name, roof_type, squares, selected_tier, tiers, version_num, parent_id, superseded_by_id, view_count, created_at, viewed_at, accepted_at, expires_at, photo_urls')
    .is('superseded_by_id', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('proposals list error:', error)
    return res.status(500).json({ error: 'Failed to load proposals' })
  }
  res.status(200).json({ proposals: data || [] })
}

export default requireAuth(handler)
