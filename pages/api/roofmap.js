/**
 * Annotated roof map — Google Static Maps satellite with each Solar facet drawn.
 *
 * Reads the stored Solar measurement (by inspection or proposal id), then
 * streams a satellite image with every roof plane outlined as a gold rectangle
 * (its bounding box) and a numbered crimson pin at its center — matching the
 * facet table in the Roof Measurements report.
 *
 *   GET /api/roofmap?inspection=<id>
 *   GET /api/roofmap?proposal=<id>
 *
 * Server-proxied (key hidden). Returns 404 when no key / no stored measurement,
 * so the client <img> hides gracefully. Facet count is capped to stay within
 * the Static Maps URL length limit; numbered labels only go 1–9 (Static Maps
 * marker labels are a single char), boxes still draw beyond that.
 */
import { serverClient } from '../../lib/supabase'

const MAX_FACETS = 12

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return res.status(404).end()

  const { inspection, proposal } = req.query
  try {
    // 1. Load the stored Solar blob from whichever record was referenced.
    const sb = serverClient()
    let solar = null
    if (inspection) {
      const { data } = await sb.from('inspections').select('sections').eq('id', inspection).single()
      solar = data?.sections?.measure?.solar || null
    } else if (proposal) {
      const { data } = await sb.from('proposals').select('roof_measurements').eq('id', proposal).single()
      solar = data?.roof_measurements || null
    } else {
      return res.status(400).end()
    }
    if (!solar || (!solar.lat && !solar.segments?.length)) return res.status(404).end()

    // 2. Build the Static Maps URL — satellite, framed on the building.
    // Center on the roof centroid (robust against a stray facet coordinate;
    // auto-fit zooms out to include outliers, which framed the whole block).
    const segs = (solar.segments || []).filter(s => s.boundingBox || s.center).slice(0, MAX_FACETS)
    const centers = segs.map(s => s.center).filter(Boolean)
    const ctr = centers.length
      ? { lat: centers.reduce((a, c) => a + c.lat, 0) / centers.length, lng: centers.reduce((a, c) => a + c.lng, 0) / centers.length }
      : { lat: solar.lat, lng: solar.lng }
    const params = new URLSearchParams({ size: '640x420', scale: '2', maptype: 'satellite', center: `${ctr.lat},${ctr.lng}`, zoom: '20', key })

    segs.forEach((s, i) => {
      const bb = s.boundingBox
      if (bb?.sw && bb?.ne) {
        const { sw, ne } = bb
        // Rectangle path (gold outline, faint fill) tracing the facet bbox.
        params.append('path', `color:0xF5B301cc|weight:3|fillcolor:0xF5B30126|${sw.lat},${sw.lng}|${ne.lat},${sw.lng}|${ne.lat},${ne.lng}|${sw.lat},${ne.lng}|${sw.lat},${sw.lng}`)
      }
      if (s.center) {
        const label = i < 9 ? `label:${i + 1}|` : '' // Static Maps labels: single char
        params.append('markers', `size:mid|color:0xB01E17|${label}${s.center.lat},${s.center.lng}`)
      }
    })

    // If we somehow have no drawable facets, at least center on the building.
    if (![...params.keys()].includes('path') && ![...params.keys()].includes('markers')) {
      if (!solar.lat || !solar.lng) return res.status(404).end()
      params.set('center', `${solar.lat},${solar.lng}`)
      params.set('zoom', '20')
      params.append('markers', `color:0xB01E17|${solar.lat},${solar.lng}`)
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
