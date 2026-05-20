/**
 * GET /api/reps  — rep performance aggregation.
 *
 * Query params:
 *   window = "30d" | "90d" | "all"   (default "all")
 *
 * Groups every proposal by rep_name and computes, per rep:
 *   sent                 total proposals created
 *   viewed               how many the customer opened
 *   accepted             how many got signed
 *   viewRate             viewed / sent
 *   acceptRate           accepted / sent
 *   revenue              sum of accepted proposal values
 *   avgTicket            revenue / accepted
 *   avgHoursToAccept     mean (accepted_at - created_at) over accepted proposals
 *
 * Reps are sorted by accepted deal count (descending) — the leaderboard metric.
 *
 * Aggregation runs in JS rather than SQL: proposal volume is low and computing
 * ticket value needs to read into the tiers jsonb, which is far cleaner here.
 */

import { serverClient } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const window = ['30d', '90d', 'all'].includes(req.query.window) ? req.query.window : 'all'

  const sb = serverClient()
  let query = sb
    .from('proposals')
    .select('rep_name, status, selected_tier, tiers, accepted_total, created_at, viewed_at, accepted_at')

  // Apply the time window on created_at
  if (window !== 'all') {
    const days = window === '30d' ? 30 : 90
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    query = query.gte('created_at', since)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Group by rep. Key on the lowercased name so "alex beltran" and "Alex Beltran"
  // (the rep_name field is free-text and casing drifts) collapse into one rep.
  const byRep = new Map()
  for (const p of data || []) {
    const repRaw = (p.rep_name || '').trim() || 'Unassigned'
    const key = repRaw.toLowerCase()
    if (!byRep.has(key)) {
      byRep.set(key, { rep_name: titleCase(repRaw), sent: 0, viewed: 0, accepted: 0, revenue: 0, _acceptHours: [] })
    }
    const r = byRep.get(key)
    r.sent++
    if (p.viewed_at) r.viewed++
    if (p.status === 'accepted' || p.status === 'signed') {
      r.accepted++
      r.revenue += ticketValue(p)
      const hrs = hoursBetween(p.created_at, p.accepted_at)
      if (hrs != null) r._acceptHours.push(hrs)
    }
  }

  // Finalize derived metrics
  const reps = [...byRep.values()].map(r => {
    const avgHours = r._acceptHours.length
      ? r._acceptHours.reduce((a, b) => a + b, 0) / r._acceptHours.length
      : null
    const { _acceptHours, ...clean } = r
    return {
      ...clean,
      viewRate:         r.sent ? r.viewed / r.sent : 0,
      acceptRate:       r.sent ? r.accepted / r.sent : 0,
      avgTicket:        r.accepted ? Math.round(r.revenue / r.accepted) : 0,
      avgHoursToAccept: avgHours != null ? Math.round(avgHours) : null,
    }
  })

  // Leaderboard sort: accepted count desc, then revenue desc as tiebreaker
  reps.sort((a, b) => b.accepted - a.accepted || b.revenue - a.revenue)

  // Company-wide totals
  const totals = reps.reduce(
    (t, r) => ({
      sent:     t.sent + r.sent,
      viewed:   t.viewed + r.viewed,
      accepted: t.accepted + r.accepted,
      revenue:  t.revenue + r.revenue,
    }),
    { sent: 0, viewed: 0, accepted: 0, revenue: 0 }
  )
  totals.acceptRate = totals.sent ? totals.accepted / totals.sent : 0

  return res.status(200).json({ window, reps, totals })
}

/** Dollar value of an accepted proposal: prefer accepted_total, fall back to the selected tier's price. */
function ticketValue(p) {
  if (p.accepted_total) return Number(p.accepted_total) || 0
  const tier = p.tiers?.[p.selected_tier]
  if (tier?.price) return Number(tier.price) || 0
  return 0
}

/** Title-case a free-text name: "alex beltran" -> "Alex Beltran". */
function titleCase(s) {
  return String(s).replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Whole hours between two timestamps, or null if either is missing/invalid. */
function hoursBetween(startIso, endIso) {
  if (!startIso || !endIso) return null
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  return ms / 3600_000
}
