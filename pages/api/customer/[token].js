/**
 * GET /api/customer/[token]  — public customer timeline data (v3.5/v3.6).
 *
 * The token (a uuid) IS the auth — unguessable, scoped to one customer.
 * Returns the customer's display name, current stage, project milestones,
 * and any rep message. Used by the public /c/[token] page.
 */

import { serverClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'token required' })

  const sb = serverClient()
  const { data, error } = await sb
    .from('customer_tokens')
    .select('token, display_name, customer_stage, project_milestones, rep_message, updated_at')
    .eq('token', token)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Not found' })
  res.status(200).json(data)
}
