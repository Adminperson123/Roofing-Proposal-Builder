/**
 * GET /api/change-orders — public list of customer-toggleable change orders.
 *
 * Change orders are optional upgrades a customer can add to their own proposal
 * on the public /p/[id] page (v3.4). Admins curate the list in Settings; it is
 * stored in settings.payload.changeOrders. This route is whitelisted as public
 * in middleware.js — it only ever returns curated upgrade copy + prices.
 */

import { serverClient } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const sb = serverClient()
  const { data } = await sb.from('settings').select('payload').eq('id', 'global').single()
  const all = Array.isArray(data?.payload?.changeOrders) ? data.payload.changeOrders : []

  // Only surface change orders usable to a customer: a real label and a price > 0.
  const changeOrders = all
    .filter(c => c && c.label && Number(c.price) > 0)
    .map(c => ({
      id:          String(c.id || ''),
      label:       String(c.label),
      price:       Number(c.price) || 0,
      description: String(c.description || ''),
    }))

  res.status(200).json({ changeOrders })
}
