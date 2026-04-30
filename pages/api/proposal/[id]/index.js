import { serverClient } from '../../../../lib/supabase'

export default async function handler(req, res) {
  const { id } = req.query
  const sb = serverClient()

  if (req.method === 'GET') {
    const { data, error } = await sb.from('proposals').select('*').eq('id', id).single()
    if (error) return res.status(404).json({ error: 'Not found' })

    // Mark first view
    if (!data.viewed_at) {
      await sb.from('proposals').update({ viewed_at: new Date().toISOString(), status: 'viewed' }).eq('id', id)
      data.viewed_at = new Date().toISOString()
      data.status = 'viewed'
    }
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { error } = await sb.from('proposals').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
