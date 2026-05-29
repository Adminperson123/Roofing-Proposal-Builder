/**
 * Roof measurement estimate — Google Solar API (buildingInsights:findClosest).
 *
 * Given a property address (or lat/lng), returns an aerial-derived roof
 * measurement the rep can drop into an inspection's Measurements section:
 *   { available, squares, pitch, planes, areaSqft, imageryQuality, imageryYear }
 *
 * It's an ESTIMATE, not a stamped report — Solar coverage has gaps (rural / new
 * construction / very complex roofs), so `available:false` with a reason is a
 * normal, expected response the UI handles, not an error. Server-proxied so the
 * Google key stays out of the browser; shares the same GOOGLE_MAPS_API_KEY.
 *
 * Conversions:
 *   1 roofing square = 100 sqft = 9.290304 m²  → squares = roofArea_m² / 9.290304
 *   pitch x/12 = tan(pitchDegrees) * 12        (dominant = largest roof segment)
 */
const SQ_METERS_PER_SQUARE = 9.290304
const SQFT_PER_SQM = 10.7639

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(200).json({ available: false, reason: 'Maps not configured' })

  let { lat, lng, address } = req.query
  try {
    // 1. Resolve coordinates — geocode the address when no coords were passed.
    if ((!lat || !lng) && address) {
      const g = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`).then(r => r.json())
      const loc = g.results?.[0]?.geometry?.location
      if (!loc) return res.status(200).json({ available: false, reason: 'Could not locate that address' })
      lat = loc.lat; lng = loc.lng
    }
    if (!lat || !lng) return res.status(400).json({ available: false, reason: 'address or lat/lng required' })

    // 2. Closest building's roof data. requiredQuality=LOW widens coverage.
    const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat}&location.longitude=${lng}&requiredQuality=LOW&key=${key}`
    const r = await fetch(url)
    const data = await r.json()
    if (!r.ok || !data.solarPotential) {
      return res.status(200).json({ available: false, reason: data?.error?.message || 'No aerial roof data for this address', lat, lng })
    }

    const sp = data.solarPotential
    const segs = Array.isArray(sp.roofSegmentStats) ? sp.roofSegmentStats : []
    const roofM2 = sp.wholeRoofStats?.areaMeters2 || segs.reduce((s, x) => s + (x.stats?.areaMeters2 || 0), 0)
    const squares = roofM2 ? Math.round(roofM2 / SQ_METERS_PER_SQUARE) : null

    // Dominant pitch = the pitch of the largest roof segment.
    let pitch = null
    if (segs.length) {
      const dom = segs.reduce((a, b) => (b.stats?.areaMeters2 || 0) > (a.stats?.areaMeters2 || 0) ? b : a)
      pitch = Math.max(0, Math.round(Math.tan((dom.pitchDegrees || 0) * Math.PI / 180) * 12))
    }

    return res.status(200).json({
      available: true,
      squares,
      pitch,
      planes: segs.length || null,
      areaSqft: roofM2 ? Math.round(roofM2 * SQFT_PER_SQM) : null,
      imageryQuality: data.imageryQuality || null,   // HIGH | MEDIUM | LOW
      imageryYear: data.imageryDate?.year || null,
      lat, lng,
    })
  } catch (e) {
    return res.status(200).json({ available: false, reason: e.message })
  }
}
