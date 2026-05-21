// Photo upload endpoint. Accepts multipart-style base64 payloads (small files only)
// or returns a presigned URL for larger uploads. To keep it simple for v1, we accept
// JSON: { files: [{ name, mime, base64 }, ...] } and upload via service_role.
import { serverClient } from '../../../../lib/supabase'
import { isAuthed, verifyFieldToken } from '../../../../lib/auth'

export const config = { api: { bodyParser: { sizeLimit: '12mb' } }, maxDuration: 30 }

export default async function handler(req, res) {
  const { id, t } = req.query
  const sb = serverClient()

  // Auth gate: admin cookie OR valid field token for this proposal id.
  // DELETE is admin-only — field users can add but never destroy.
  const admin = isAuthed(req)
  const fieldOk = typeof t === 'string' && verifyFieldToken(id, t)
  if (!admin && !(req.method === 'POST' && fieldOk)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method === 'POST') {
    const { files } = req.body || {}
    if (!Array.isArray(files) || !files.length) return res.status(400).json({ error: 'files[] required' })

    const uploaded = []
    for (const f of files) {
      if (!f?.base64 || !f?.mime) continue
      const ext  = (f.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
      const buf  = Buffer.from(f.base64, 'base64')
      const { error: upErr } = await sb.storage.from('proposal-photos').upload(path, buf, {
        contentType: f.mime, upsert: false,
      })
      if (upErr) { console.error('upload err', upErr); continue }
      const { data: pub } = sb.storage.from('proposal-photos').getPublicUrl(path)
      uploaded.push({ url: pub.publicUrl, name: f.name || path })
    }

    // Append to proposal's photo_urls
    const { data: cur } = await sb.from('proposals').select('photo_urls').eq('id', id).single()
    const next = [...(cur?.photo_urls || []), ...uploaded]
    await sb.from('proposals').update({ photo_urls: next }).eq('id', id)
    return res.status(200).json({ ok: true, photos: uploaded, total: next.length })
  }

  if (req.method === 'DELETE') {
    const { url } = req.body || {}
    if (!url) return res.status(400).json({ error: 'url required' })
    const { data: cur } = await sb.from('proposals').select('photo_urls').eq('id', id).single()
    const next = (cur?.photo_urls || []).filter(p => p.url !== url)
    await sb.from('proposals').update({ photo_urls: next }).eq('id', id)
    // Best-effort delete from storage too
    try {
      const path = url.split('/proposal-photos/')[1]
      if (path) await sb.storage.from('proposal-photos').remove([path])
    } catch {}
    return res.status(200).json({ ok: true, total: next.length })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
