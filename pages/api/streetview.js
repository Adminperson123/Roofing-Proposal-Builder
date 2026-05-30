/**
 * Street View curb shot — Google Street View Static API (server-proxied).
 *
 * Returns a ground-level photo of the property for the proposal ("we see your
 * home"). Accepts lat/lng (preferred) or a free-text address.
 *
 *   GET /api/streetview?lat=..&lng=..   |   ?address=..   |   ?proposal=<id>
 *
 * Returns 404 when no key OR no Street View coverage at that location, so the
 * client <img> hides gracefully (many rural/new addresses have no panorama).
 * We check the metadata endpoint first (free, no image quota) to avoid serving
 * Google's grey "no imagery" placeholder.
 */
import { serverClient } from '../../lib/supabase'

export const config = { api: { responseLimit: false } }

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(404).end()

  let { lat, lng, address, proposal } = req.query
  // Public /p/[id] passes a proposal id (not raw coords) — resolve server-side.
  if ((!lat || !lng) && !address && proposal) {
    const { data } = await serverClient().from('proposals').select('roof_measurements, customer_address').eq('id', proposal).single()
    const rm = data?.roof_measurements
    if (rm?.lat && rm?.lng) { lat = rm.lat; lng = rm.lng }
    else if (data?.customer_address) { address = data.customer_address }
  }
  const location = (lat && lng) ? `${lat},${lng}` : (address ? address.toString() : '')
  if (!location) return res.status(400).end()

  try {
    // 1. Metadata probe — confirms a panorama exists before spending image quota.
    const meta = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(location)}&source=outdoor&key=${key}`).then(r => r.json())
    if (meta.status !== 'OK') return res.status(404).end() // ZERO_RESULTS / NOT_FOUND → hide

    // 2. The image itself. fov 75 + a slight downward pitch frames a house well.
    const params = new URLSearchParams({
      location, size: '640x360', fov: '75', pitch: '8', source: 'outdoor', return_error_code: 'true', key,
    })
    const img = await fetch(`https://maps.googleapis.com/maps/api/streetview?${params.toString()}`)
    if (!img.ok) return res.status(404).end()
    const buf = Buffer.from(await img.arrayBuffer())
    res.setHeader('Content-Type', img.headers.get('content-type') || 'image/jpeg')
    res.setHeader('Cache-Control', 'private, max-age=86400')
    return res.status(200).send(buf)
  } catch {
    return res.status(502).end()
  }
}
