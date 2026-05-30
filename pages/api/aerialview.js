/**
 * Aerial View 3D flyover — Google Aerial View API (server-proxied).
 *
 * Returns a cinematic orbiting 3D video URL for a property to embed in the
 * presentation/proposal. Aerial View is render-on-demand:
 *   - lookupVideo by address → state ACTIVE returns video URIs
 *   - state PROCESSING means Google is still rendering (try again later)
 *   - 404 / no metadata means no coverage for that address (mostly metros)
 *
 *   GET /api/aerialview?address=...
 *
 * Returns { state, mp4?, reason? } as JSON (NOT a video stream) — the client
 * decides whether to show the player, a "rendering…" note, or hide. Server-
 * proxied so the key stays hidden; reuses GOOGLE_MAPS_API_KEY.
 */
export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(200).json({ state: 'unavailable', reason: 'Maps not configured' })

  const address = (req.query.address || '').toString().trim()
  if (!address) return res.status(400).json({ state: 'unavailable', reason: 'address required' })

  try {
    const r = await fetch(`https://aerialview.googleapis.com/v1/videos:lookupVideo?address=${encodeURIComponent(address)}&key=${key}`)
    const data = await r.json()

    // No metadata yet → either not requested before, or no coverage. Kick off a
    // render so a later lookup can succeed, then report "processing".
    if (!r.ok || data.error) {
      // renderVideo creates the job for this address (idempotent per address).
      await fetch(`https://aerialview.googleapis.com/v1/videos:renderVideo?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      }).catch(() => {})
      return res.status(200).json({ state: 'processing', reason: 'Flyover is rendering — check back shortly.' })
    }

    if (data.state === 'ACTIVE' && data.uris) {
      // Prefer a directly-embeddable MP4 (landscape) when present.
      const mp4 = data.uris?.MP4_HIGH?.landscapeUri || data.uris?.MP4_MEDIUM?.landscapeUri || data.uris?.MP4_LOW?.landscapeUri || null
      const image = data.uris?.IMAGE?.landscapeUri || null
      return res.status(200).json({ state: 'active', mp4, image })
    }

    // PROCESSING / STATE_UNSPECIFIED
    return res.status(200).json({ state: 'processing', reason: 'Flyover is rendering — check back shortly.' })
  } catch (e) {
    return res.status(200).json({ state: 'unavailable', reason: e.message })
  }
}
