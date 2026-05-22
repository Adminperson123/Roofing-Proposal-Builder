/**
 * /api/customer-tokens — admin CRUD for customer project-timeline tokens (v3.6).
 *
 * Each customer_tokens row powers one public /c/[token] timeline page.
 * Rows are keyed by customer_key: the same lowercased email → phone → name
 * key the Customers tab groups proposals by, so one customer = one timeline.
 *
 *   GET                          → list all timelines
 *   POST   { customer_key, ... }  → create-or-update by customer_key
 *   PUT    { token, ... }         → update one timeline's milestones / stage / message
 *   DELETE ?token=...             → remove a timeline
 *
 * Auth: requireAuth (admin only). The public read path is /api/customer/[token].
 */

import { serverClient } from '../../lib/supabase'
import { requireAuth } from '../../lib/auth'

const SELECT = 'token, customer_key, display_name, customer_stage, project_milestones, rep_message, updated_at'

// Milestones are free-form JSON, so normalize before persisting: the public
// /c/[token] page only understands { label, status, date, note }.
function cleanMilestones(input) {
  if (!Array.isArray(input)) return []
  return input
    .map(m => ({
      label:  String(m?.label || '').trim(),
      status: ['done', 'current', 'upcoming'].includes(m?.status) ? m.status : 'upcoming',
      date:   String(m?.date || '').trim(),
      note:   String(m?.note || '').trim(),
    }))
    .filter(m => m.label)
}

async function handler(req, res) {
  const sb = serverClient()

  if (req.method === 'GET') {
    const { data, error } = await sb
      .from('customer_tokens')
      .select(SELECT)
      .order('updated_at', { ascending: false })
    if (error) return res.status(500).json({ error: 'Failed to load timelines' })
    return res.status(200).json({ tokens: data || [] })
  }

  if (req.method === 'POST') {
    const b = req.body || {}
    const customer_key = String(b.customer_key || '').trim().toLowerCase()
    if (!customer_key) return res.status(400).json({ error: 'customer_key required' })
    const row = {
      customer_key,
      display_name:       b.display_name || null,
      customer_stage:     b.customer_stage || 'sent',
      rep_message:        b.rep_message || null,
      project_milestones: cleanMilestones(b.project_milestones),
      updated_at:         new Date().toISOString(),
    }
    const { data, error } = await sb
      .from('customer_tokens')
      .upsert(row, { onConflict: 'customer_key' })
      .select(SELECT)
      .single()
    if (error) return res.status(500).json({ error: 'Failed to create timeline' })
    return res.status(200).json({ token: data })
  }

  if (req.method === 'PUT') {
    const b = req.body || {}
    const token = String(b.token || '').trim()
    if (!token) return res.status(400).json({ error: 'token required' })
    const updates = { updated_at: new Date().toISOString() }
    if ('display_name' in b)       updates.display_name = b.display_name || null
    if ('customer_stage' in b)     updates.customer_stage = b.customer_stage || 'sent'
    if ('rep_message' in b)        updates.rep_message = b.rep_message || null
    if ('project_milestones' in b) updates.project_milestones = cleanMilestones(b.project_milestones)
    const { data, error } = await sb
      .from('customer_tokens')
      .update(updates)
      .eq('token', token)
      .select(SELECT)
      .single()
    if (error || !data) return res.status(404).json({ error: 'Timeline not found' })
    return res.status(200).json({ token: data })
  }

  if (req.method === 'DELETE') {
    const token = String(req.query.token || '').trim()
    if (!token) return res.status(400).json({ error: 'token required' })
    const { error } = await sb.from('customer_tokens').delete().eq('token', token)
    if (error) return res.status(500).json({ error: 'Failed to delete timeline' })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

export default requireAuth(handler)
