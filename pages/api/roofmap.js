/**
 * Annotated roof map — Google Static Maps satellite with each facet drawn.
 *
 * Reads the stored roof measurement (by inspection or proposal id) and streams
 * a satellite image with each roof plane drawn as an ANGLED rectangle oriented
 * to that facet's direction (so it reads like a hand-traced roof plan, not flat
 * boxes) plus a numbered crimson pin. The drawn shapes are a VISUAL — the real
 * areas/pitch come from the measurement data and are shown in the report table.
 *
 *   GET /api/roofmap?inspection=<id>   |   GET /api/roofmap?proposal=<id>
 *
 * Server-proxied (key hidden). 404 when no key / no measurement so the client
 * <img> hides. Facet count capped for the Static Maps URL length limit.
 */
import { serverClient } from '../../lib/supabase'

const MAX_FACETS = 12
const M_PER_DEG_LAT = 111320

// Four corners of a rectangle centered at `center`, sized to `areaM2`, elongated
// by `aspect` (ridge:slope), and rotated to face `azimuthDeg`. Flat-earth offset
// math — plenty accurate at a single roof's scale. Returns "lat,lng" strings.
function orientedRectCorners(center, azimuthDeg, areaM2, aspect) {
  const ratio = Math.min(Math.max(aspect || 1.4, 1), 2.6)
  const slope = Math.sqrt(areaM2 / ratio)
  const ridge = ratio * slope
  const dS = slope / 2, dR = ridge / 2
  const az = (azimuthDeg || 0) * Math.PI / 180
  const azp = az + Math.PI / 2
  const mPerDegLng = M_PER_DEG_LAT * Math.cos(center.lat * Math.PI / 180)
  const order = [[1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]]
  return order.map(([s, r]) => {
    const north = s * dS * Math.cos(az) + r * dR * Math.cos(azp)
    const east = s * dS * Math.sin(az) + r * dR * Math.sin(azp)
    const lat = center.lat + north / M_PER_DEG_LAT
    const lng = center.lng + east / mPerDegLng
    return `${lat.toFixed(7)},${lng.toFixed(7)}`
  })
}

function bboxElongation(bb, lat) {
  if (!bb?.sw || !bb?.ne) return 1.4
  const h = Math.abs(bb.ne.lat - bb.sw.lat) * M_PER_DEG_LAT
  const w = Math.abs(bb.ne.lng - bb.sw.lng) * M_PER_DEG_LAT * Math.cos(lat * Math.PI / 180)
  if (!h || !w) return 1.4
  return Math.max(w / h, h / w)
}

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(404).end()

  const { inspection, proposal } = req.query
  try {
    const sb = serverClient()
    let roof = null
    if (inspection) {
      const { data } = await sb.from('inspections').select('sections').eq('id', inspection).single()
      roof = data?.sections?.measure?.solar || null
    } else if (proposal) {
      const { data } = await sb.from('proposals').select('roof_measurements').eq('id', proposal).single()
      roof = data?.roof_measurements || null
    } else {
      return res.status(400).end()
    }
    if (!roof || (!roof.lat && !roof.segments?.length)) return res.status(404).end()

    const segs = (roof.segments || []).filter(s => s.center || s.boundingBox).slice(0, MAX_FACETS)
    const centers = segs.map(s => s.center).filter(Boolean)
    const ctr = centers.length
      ? { lat: centers.reduce((a, c) => a + c.lat, 0) / centers.length, lng: centers.reduce((a, c) => a + c.lng, 0) / centers.length }
      : { lat: roof.lat, lng: roof.lng }

    const params = new URLSearchParams({ size: '640x420', scale: '2', maptype: 'satellite', center: `${ctr.lat},${ctr.lng}`, zoom: '20', key })

    segs.forEach((s, i) => {
      const areaM2 = (s.areaSqft || 0) / 10.7639
      if (s.center && areaM2 > 0) {
        const corners = orientedRectCorners(s.center, s.azimuthDeg, areaM2, bboxElongation(s.boundingBox, s.center.lat))
        params.append('path', `color:0xF5B301dd|weight:3|fillcolor:0xF5B30130|${corners.join('|')}`)
      } else if (s.boundingBox?.sw && s.boundingBox?.ne) {
        const { sw, ne } = s.boundingBox
        params.append('path', `color:0xF5B301dd|weight:3|fillcolor:0xF5B30130|${sw.lat},${sw.lng}|${ne.lat},${sw.lng}|${ne.lat},${ne.lng}|${sw.lat},${ne.lng}|${sw.lat},${sw.lng}`)
      }
      if (s.center) {
        const label = i < 9 ? `label:${i + 1}|` : ''
        params.append('markers', `size:mid|color:0xB01E17|${label}${s.center.lat},${s.center.lng}`)
      }
    })

    if (![...params.keys()].includes('path') && ![...params.keys()].includes('markers')) {
      if (!roof.lat || !roof.lng) return res.status(404).end()
      params.append('markers', `color:0xB01E17|${roof.lat},${roof.lng}`)
    }

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
