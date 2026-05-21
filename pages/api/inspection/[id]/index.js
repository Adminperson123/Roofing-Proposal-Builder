import { serverClient } from '../../../../lib/supabase'
import { requireAuth } from '../../../../lib/auth'

async function handler(req, res) {
  const { id } = req.query
  const sb = serverClient()

  if (req.method === 'GET') {
    const { data, error } = await sb.from('inspections').select('*').eq('id', id).single()
    if (error || !data) return res.status(404).json({ error: 'Not found' })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { sections, step_completed, status, recommendation_summary, urgency, rep_name } = req.body || {}
    const patch = { updated_at: new Date().toISOString() }
    if (sections !== undefined) patch.sections = sections
    if (typeof step_completed === 'number') patch.step_completed = step_completed
    if (status === 'submitted') { patch.status = 'submitted'; patch.submitted_at = new Date().toISOString() }
    else if (status === 'draft') patch.status = 'draft'
    if (recommendation_summary !== undefined) patch.recommendation_summary = recommendation_summary
    if (urgency !== undefined) patch.urgency = urgency
    if (rep_name !== undefined) patch.rep_name = rep_name

    const { data, error } = await sb.from('inspections').update(patch).eq('id', id).select().single()
    if (error) return res.status(500).json({ error: 'Update failed: ' + error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await sb.from('inspections').delete().eq('id', id)
    if (error) return res.status(500).json({ error: 'Delete failed' })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

export default requireAuth(handler)
