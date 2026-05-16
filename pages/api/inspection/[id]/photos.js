import { serverClient } from '../../../../lib/supabase'
import { requireAuth } from '../../../../lib/auth'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } }, maxDuration: 30 }

async function handler(req, res) {
  const { id } = req.query
  const sb = serverClient()

  if (req.method === 'POST') {
    const { files } = req.body || {}
    if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: 'files[] required' })

    const uploaded = []
    for (const f of files) {
      if (!f?.base64 || !f?.mime) continue
      const ext  = (f.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const path = `inspection-${id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
      const buf  = Buffer.from(f.base64, 'base64')
      const { error: upErr } = await sb.storage.from('proposal-photos').upload(path, buf, {
        contentType: f.mime, upsert: false,
      })
      if (upErr) { console.error('inspection photo upload err', upErr); continue }
      const { data: pub } = sb.storage.from('proposal-photos').getPublicUrl(path)
      uploaded.push({ url: pub.publicUrl, name: f.name || path, section: f.section || null, caption: f.caption || null, uploaded_at: new Date().toISOString() })
    }

    const { data: cur } = await sb.from('inspections').select('photos').eq('id', id).single()
    const next = [...(cur?.photos || []), ...uploaded]
    await sb.from('inspections').update({ photos: next, updated_at: new Date().toISOString() }).eq('id', id)
    return res.status(200).json({ ok: true, photos: uploaded, total: next.length })
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {}
    if (!url) return res.status(400).json({ error: 'url required' })
    const { data: cur } = await sb.from('inspections').select('photos').eq('id', id).single()
    const next = (cur?.photos || []).filter(p => p.url !== url)
    await sb.from('inspections').update({ photos: next, updated_at: new Date().toISOString() }).eq('id', id)
    try {
      const path = url.split('/proposal-photos/')[1]
      if (path) await sb.storage.from('proposal-photos').remove([path])
    } catch {}
    return res.status(200).json({ ok: true, total: next.length })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

export default requireAuth(handler)
