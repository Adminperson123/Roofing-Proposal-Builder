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
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const orientationOf = (azimuthDeg) => COMPASS[Math.round(((azimuthDeg || 0) % 360) / 45) % 8]
const pitchOf = (deg) => Math.max(0, Math.round(Math.tan((deg || 0) * Math.PI / 180) * 12))

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
    const rawSegs = Array.isArray(sp.roofSegmentStats) ? sp.roofSegmentStats : []
    const roofM2 = sp.wholeRoofStats?.areaMeters2 || rawSegs.reduce((s, x) => s + (x.stats?.areaMeters2 || 0), 0)
    const squares = roofM2 ? Math.round(roofM2 / SQ_METERS_PER_SQUARE) : null

    // Per-facet breakdown (largest first) for the visual + table.
    const segments = rawSegs
      .map(s => {
        const m2 = s.stats?.areaMeters2 || 0
        const bb = s.boundingBox || {}
        return {
          areaSqft: Math.round(m2 * SQFT_PER_SQM),
          pitch: pitchOf(s.pitchDegrees),
          pitchDeg: s.pitchDegrees != null ? Math.round(s.pitchDegrees) : null,
          azimuthDeg: s.azimuthDegrees != null ? Math.round(s.azimuthDegrees) : null,
          orientation: orientationOf(s.azimuthDegrees),
          center: s.center ? { lat: s.center.latitude, lng: s.center.longitude } : null,
          boundingBox: (bb.sw && bb.ne) ? { sw: { lat: bb.sw.latitude, lng: bb.sw.longitude }, ne: { lat: bb.ne.latitude, lng: bb.ne.longitude } } : null,
        }
      })
      .sort((a, b) => b.areaSqft - a.areaSqft)

    // Dominant pitch = pitch of the largest facet (segments already sorted desc).
    const pitch = segments.length ? segments[0].pitch : null

    return res.status(200).json({
      available: true,
      squares,
      pitch,
      planes: segments.length || null,
      areaSqft: roofM2 ? Math.round(roofM2 * SQFT_PER_SQM) : null,
      imageryQuality: data.imageryQuality || null,   // HIGH | MEDIUM | LOW
      imageryYear: data.imageryDate?.year || null,
      lat: Number(lat), lng: Number(lng),
      segments,
    })
  } catch (e) {
    return res.status(200).json({ available: false, reason: e.message })
  }
}
