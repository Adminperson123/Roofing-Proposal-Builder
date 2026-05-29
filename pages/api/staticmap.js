/**
 * Satellite map proxy — Google Maps Static API.
 *
 * Streams a satellite/aerial image of a property for the admin builder so the
 * rep can confirm they found the right roof. Accepts either coordinates
 * (lat,lng — exact, preferred) or a free-text address (Google geocodes it).
 *
 * Returns 404 when GOOGLE_MAPS_API_KEY is unset so the client's <img> onError
 * simply hides the map — no key, no broken image, no console noise.
 *
 * Roofing-specific defaults: maptype=satellite and a tight zoom so the roof
 * plane fills the frame; scale=2 for a crisp retina image.
 */
export const config = { api: { responseLimit: false } }

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(404).end()

  const { lat, lng, address } = req.query
  const center = (lat && lng) ? `${lat},${lng}` : (address ? address.toString() : '')
  if (!center) return res.status(400).end()

  const zoom = (req.query.zoom || '20').toString()
  const params = new URLSearchParams({
    center,
    zoom,
    size: '640x360',
    scale: '2',
    maptype: 'satellite',
    key,
  })
  // Gold marker (brand color) pinning the property.
  params.append('markers', `color:0xD4960E|${center}`)

  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`)
    if (!r.ok) return res.status(502).end()
    const buf = Buffer.from(await r.arrayBuffer())
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/png')
    res.setHeader('Cache-Control', 'private, max-age=3600')
    return res.status(200).send(buf)
  } catch {
    return res.status(502).end()
  }
}
