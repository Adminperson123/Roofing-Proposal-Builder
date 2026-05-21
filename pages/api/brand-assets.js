// Brand assets endpoint:
//   GET  /api/brand-assets         → public — returns all uploaded brand asset URLs
//   POST /api/brand-assets         → admin — upload one image, save URL keyed by `slot`
//   DELETE /api/brand-assets       → admin — remove an asset by slot
//
// Storage: Supabase 'brand-assets' bucket (public read).
// Catalog: stored in settings.payload.brandAssets keyed by slot id, e.g.
//   { gaf:'https://...', owens_corning:'https://...', cslb:'https://...', ... }

import { serverClient } from '../../lib/supabase'
import { isAuthed } from '../../lib/auth'

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } }

const SLOTS = new Set([
  'gaf','owens_corning','eagle','boral','westlake',
  'cslb','liability','workers_comp','gaf_certified','bbb','energy_star',
  // free-form custom slots are also allowed via prefix custom_
])

function isValidSlot(s) {
  return typeof s === 'string' && (SLOTS.has(s) || /^custom_[a-z0-9_-]{1,32}$/i.test(s))
}

export default async function handler(req, res) {
  const sb = serverClient()

  if (req.method === 'GET') {
    const { data } = await sb.from('settings').select('payload').eq('id','global').single()
    const assets = data?.payload?.brandAssets || {}
    return res.status(200).json({ assets })
  }

  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'POST') {
    const { slot, name, mime, base64 } = req.body || {}
    if (!isValidSlot(slot)) return res.status(400).json({ error: 'invalid slot' })
    if (!base64 || !mime)   return res.status(400).json({ error: 'base64 + mime required' })

    const ext  = (mime.split('/')[1] || 'png').replace('jpeg','jpg').replace('svg+xml','svg')
    const path = `${slot}/${Date.now()}.${ext}`
    const buf  = Buffer.from(base64, 'base64')
    const { error: upErr } = await sb.storage.from('brand-assets').upload(path, buf, {
      contentType: mime, upsert: true,
    })
    if (upErr) { console.error(upErr); return res.status(500).json({ error: 'upload failed' }) }
    const { data: pub } = sb.storage.from('brand-assets').getPublicUrl(path)

    // Merge into settings.payload.brandAssets
    const { data: cur } = await sb.from('settings').select('payload').eq('id','global').single()
    const payload = cur?.payload || {}
    payload.brandAssets = { ...(payload.brandAssets || {}), [slot]: { url: pub.publicUrl, name: name || slot, updatedAt: new Date().toISOString() } }
    await sb.from('settings').upsert({ id: 'global', payload, updated_at: new Date().toISOString() })

    return res.status(200).json({ ok: true, slot, url: pub.publicUrl })
  }

  if (req.method === 'DELETE') {
    const { slot } = req.body || {}
    if (!isValidSlot(slot)) return res.status(400).json({ error: 'invalid slot' })
    const { data: cur } = await sb.from('settings').select('payload').eq('id','global').single()
    const payload = cur?.payload || {}
    const target = payload.brandAssets?.[slot]
    if (target) {
      delete payload.brandAssets[slot]
      await sb.from('settings').upsert({ id: 'global', payload, updated_at: new Date().toISOString() })
      // best-effort delete from storage
      try {
        const path = target.url.split('/brand-assets/')[1]
        if (path) await sb.storage.from('brand-assets').remove([path])
      } catch {}
    }
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
