import { serverClient } from '../../lib/supabase'
import { requireAuth } from '../../lib/auth'
import { DEFAULT_SETTINGS } from '../../lib/pricing'

async function handler(req, res) {
  const sb = serverClient()
  if (req.method === 'GET') {
    const { data } = await sb.from('settings').select('payload').eq('id', 'global').single()
    return res.status(200).json({ settings: data?.payload || DEFAULT_SETTINGS })
  }
  if (req.method === 'PUT') {
    const { settings } = req.body || {}
    if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings object required' })
    const { error } = await sb.from('settings').upsert({ id: 'global', payload: settings, updated_at: new Date().toISOString() })
    if (error) return res.status(500).json({ error: 'Save failed' })
    return res.status(200).json({ ok: true })
  }
  res.status(405).json({ error: 'Method not allowed' })
}

export default requireAuth(handler)
