/**
 * RoofEditor — the "human touch" layer.
 *
 * Renders a clean satellite of the property (server-proxied /api/staticmap, no
 * Google JS in the browser → no key exposed) with each roof facet as a
 * draggable SVG polygon seeded from the measurement. The rep drags vertices /
 * whole facets to hug the real roof; area + squares recompute live via
 * Web-Mercator pixel↔GPS math. On Save it returns an updated measurement blob
 * (edited polygons + recomputed totals, edited:true) that flows into the
 * proposal. The headline numbers still START from the aerial engine — this just
 * lets a human perfect them.
 *
 * Coordinate model: /api/staticmap returns a 640×360 (logical) satellite at a
 * given center+zoom. We project GPS→logical pixels with the canonical Google
 * tile math so the seed polygons land exactly on the imaged roof.
 */
import { useMemo, useRef, useState } from 'react'

const W = 640, H = 360, ZOOM = 20
const TILE = 256
const SQM_PER_SQUARE = 9.290304
const SQFT_PER_SQM = 10.7639
const M_PER_DEG_LAT = 111320

const project = (lat, lng) => {
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999)
  return { x: TILE * (lng + 180) / 360, y: TILE * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI)) }
}
const unproject = (wx, wy) => {
  const lng = (wx / TILE) * 360 - 180
  const n = Math.PI - (2 * Math.PI * wy) / TILE
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return { lat, lng }
}

// Seed an oriented rectangle for a facet (matches the static roofmap look).
function seedCorners(center, azimuthDeg, areaM2, aspect) {
  const ratio = Math.min(Math.max(aspect || 1.4, 1), 2.6)
  const slope = Math.sqrt(areaM2 / ratio), ridge = ratio * slope
  const dS = slope / 2, dR = ridge / 2
  const az = (azimuthDeg || 0) * Math.PI / 180, azp = az + Math.PI / 2
  const mLng = M_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180)
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([s, r]) => {
    const north = s * dS * Math.cos(az) + r * dR * Math.cos(azp)
    const east = s * dS * Math.sin(az) + r * dR * Math.sin(azp)
    return { lat: center.lat + north / M_PER_DEG_LAT, lng: center.lng + east / mLng }
  })
}

export default function RoofEditor({ roof, onSave, onClose }) {
  const segsIn = Array.isArray(roof?.segments) ? roof.segments : []
  // Center the frame on the facet centroid (fallback to the property point).
  const center = useMemo(() => {
    const cs = segsIn.map(s => s.center).filter(Boolean)
    if (cs.length) return { lat: cs.reduce((a, c) => a + c.lat, 0) / cs.length, lng: cs.reduce((a, c) => a + c.lng, 0) / cs.length }
    return { lat: roof?.lat, lng: roof?.lng }
  }, [])
  const Z = 2 ** ZOOM
  const cw = useMemo(() => project(center.lat, center.lng), [center])
  const mPerPx = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Z
  const toPx = (lat, lng) => { const w = project(lat, lng); return { x: W / 2 + (w.x - cw.x) * Z, y: H / 2 + (w.y - cw.y) * Z } }
  const toLL = (px, py) => unproject(cw.x + (px - W / 2) / Z, cw.y + (py - H / 2) / Z)

  // Seed editable facets: existing edited polygons (corners) win; else build a
  // rectangle from center+azimuth+area so the seed matches what they saw.
  const [facets, setFacets] = useState(() => segsIn.map((s, i) => {
    const corners = Array.isArray(s.corners) && s.corners.length >= 3
      ? s.corners
      : (s.center ? seedCorners(s.center, s.azimuthDeg, (s.areaSqft || 100) / SQFT_PER_SQM, aspectOf(s.boundingBox, s.center?.lat)) : null)
    return { id: i, pitch: s.pitch ?? roof?.pitch ?? 0, orientation: s.orientation || '', pts: (corners || []).map(c => toPx(c.lat, c.lng)) }
  }).filter(f => f.pts.length >= 3))

  const [drag, setDrag] = useState(null) // {fi, vi} vertex | {fi, move:true, ox, oy}
  const [sel, setSel] = useState(0)
  const svgRef = useRef(null)

  // px polygon area (shoelace) → pitch-corrected surface → squares/sqft.
  const measure = (pts, pitch) => {
    let a = 0
    for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y }
    const planM2 = Math.abs(a / 2) * mPerPx * mPerPx
    const surfaceM2 = planM2 * Math.sqrt(1 + Math.pow((pitch || 0) / 12, 2))
    return { sqft: Math.round(surfaceM2 * SQFT_PER_SQM), squares: surfaceM2 / SQM_PER_SQUARE }
  }
  const totals = useMemo(() => {
    let sqft = 0, sq = 0
    facets.forEach(f => { const m = measure(f.pts, f.pitch); sqft += m.sqft; sq += m.squares })
    return { sqft: Math.round(sqft), squares: Math.round(sq) }
  }, [facets])

  const evtToSvg = (e) => {
    const r = svgRef.current.getBoundingClientRect()
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top
    return { x: (cx / r.width) * W, y: (cy / r.height) * H }
  }
  const onMove = (e) => {
    if (!drag) return
    e.preventDefault()
    const p = evtToSvg(e)
    setFacets(fs => fs.map((f, fi) => {
      if (fi !== drag.fi) return f
      if (drag.vi != null) { const pts = f.pts.map((pt, vi) => vi === drag.vi ? p : pt); return { ...f, pts } }
      const dx = p.x - drag.ox, dy = p.y - drag.oy
      return { ...f, pts: drag.start.map(pt => ({ x: pt.x + dx, y: pt.y + dy })) }
    }))
  }
  const addFacet = () => setFacets(fs => [...fs, { id: Date.now(), pitch: roof?.pitch ?? 4, orientation: '', pts: [{ x: W / 2 - 40, y: H / 2 - 30 }, { x: W / 2 + 40, y: H / 2 - 30 }, { x: W / 2 + 40, y: H / 2 + 30 }, { x: W / 2 - 40, y: H / 2 + 30 }] }])
  const delFacet = (fi) => setFacets(fs => fs.filter((_, i) => i !== fi))
  // Insert a vertex at the midpoint of edge `ei` (between vi ei and ei+1) so a
  // rectangle can become an L, a hex, follow a real ridgeline — the fix for
  // "blocky". The new point starts at the edge midpoint, then is grabbed to drag.
  const addPointOnEdge = (fi, ei) => setFacets(fs => fs.map((f, i) => {
    if (i !== fi) return f
    const a = f.pts[ei], b = f.pts[(ei + 1) % f.pts.length]
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const pts = [...f.pts.slice(0, ei + 1), mid, ...f.pts.slice(ei + 1)]
    return { ...f, pts }
  }))
  // Remove a vertex (a polygon needs ≥3).
  const delVertex = (fi, vi) => setFacets(fs => fs.map((f, i) => (i !== fi || f.pts.length <= 3) ? f : { ...f, pts: f.pts.filter((_, v) => v !== vi) }))
  const reset = () => setFacets(segsIn.map((s, i) => ({ id: i, pitch: s.pitch ?? roof?.pitch ?? 0, orientation: s.orientation || '', pts: (s.center ? seedCorners(s.center, s.azimuthDeg, (s.areaSqft || 100) / SQFT_PER_SQM, aspectOf(s.boundingBox, s.center?.lat)) : []).map(c => toPx(c.lat, c.lng)) })).filter(f => f.pts.length >= 3))

  const save = () => {
    const segments = facets.map(f => {
      const ll = f.pts.map(p => toLL(p.x, p.y))
      const m = measure(f.pts, f.pitch)
      const cLat = ll.reduce((a, c) => a + c.lat, 0) / ll.length
      const cLng = ll.reduce((a, c) => a + c.lng, 0) / ll.length
      const lats = ll.map(c => c.lat), lngs = ll.map(c => c.lng)
      return {
        areaSqft: m.sqft, pitch: f.pitch, orientation: f.orientation,
        center: { lat: cLat, lng: cLng },
        corners: ll,
        boundingBox: { sw: { lat: Math.min(...lats), lng: Math.min(...lngs) }, ne: { lat: Math.max(...lats), lng: Math.max(...lngs) } },
      }
    })
    onSave({ ...roof, segments, squares: totals.squares, areaSqft: totals.sqft, planes: segments.length, edited: true })
  }

  return (
    <div style={ov} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={head}>
          <div><strong style={{ fontSize: 16 }}>✏️ Adjust roof lines</strong><div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Drag red dots to move corners · tap a gold <b>+</b> to add one · double-tap a corner to remove it. Totals update live.</div></div>
          <button onClick={onClose} style={xBtn}>×</button>
        </div>

        <div style={{ position: 'relative', width: '100%', background: '#000', borderRadius: 10, overflow: 'hidden' }}>
          <img src={`/api/staticmap?lat=${center.lat}&lng=${center.lng}&zoom=${ZOOM}&pin=0`} alt="" style={{ width: '100%', display: 'block' }} draggable={false} />
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
            onMouseMove={onMove} onMouseUp={() => setDrag(null)} onMouseLeave={() => setDrag(null)}
            onTouchMove={onMove} onTouchEnd={() => setDrag(null)}>
            {facets.map((f, fi) => (
              <g key={f.id}>
                <polygon points={f.pts.map(p => `${p.x},${p.y}`).join(' ')}
                  fill={fi === sel ? 'rgba(245,179,1,.28)' : 'rgba(245,179,1,.16)'} stroke="#F5B301" strokeWidth={fi === sel ? 2.5 : 1.8}
                  style={{ cursor: 'move' }}
                  onMouseDown={e => { const p = evtToSvg(e); setSel(fi); setDrag({ fi, ox: p.x, oy: p.y, start: f.pts }) }}
                  onTouchStart={e => { const p = evtToSvg(e); setSel(fi); setDrag({ fi, ox: p.x, oy: p.y, start: f.pts }) }} />
                <text x={f.pts.reduce((a, p) => a + p.x, 0) / f.pts.length} y={f.pts.reduce((a, p) => a + p.y, 0) / f.pts.length} fill="#fff" fontSize="13" fontWeight="900" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none', textShadow: '0 1px 3px #000' }}>{fi + 1}</text>
                {/* Edge midpoints — small gold "+" handles; tap to add a corner there. */}
                {fi === sel && f.pts.map((p, vi) => {
                  const b = f.pts[(vi + 1) % f.pts.length]
                  const mx = (p.x + b.x) / 2, my = (p.y + b.y) / 2
                  return (
                    <g key={`e${vi}`} style={{ cursor: 'copy' }}
                      onMouseDown={e => { e.stopPropagation(); addPointOnEdge(fi, vi); setDrag({ fi, vi: vi + 1 }) }}
                      onTouchStart={e => { e.stopPropagation(); addPointOnEdge(fi, vi); setDrag({ fi, vi: vi + 1 }) }}>
                      <circle cx={mx} cy={my} r="6" fill="#F5B301" stroke="#fff" strokeWidth="1.5" opacity="0.85" />
                      <text x={mx} y={my} fill="#0C1C38" fontSize="11" fontWeight="900" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: 'none' }}>+</text>
                    </g>
                  )
                })}
                {/* Corner handles — drag to move; double-tap to delete (≥3 kept). */}
                {fi === sel && f.pts.map((p, vi) => (
                  <circle key={vi} cx={p.x} cy={p.y} r="7" fill="#B01E17" stroke="#fff" strokeWidth="2" style={{ cursor: 'grab' }}
                    onMouseDown={e => { e.stopPropagation(); setDrag({ fi, vi }) }}
                    onTouchStart={e => { e.stopPropagation(); setDrag({ fi, vi }) }}
                    onDoubleClick={e => { e.stopPropagation(); delVertex(fi, vi) }} />
                ))}
              </g>
            ))}
          </svg>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <div style={kpi}><b>{totals.squares}</b> squares</div>
          <div style={kpi}><b>{totals.sqft.toLocaleString()}</b> sqft</div>
          <div style={kpi}><b>{facets.length}</b> planes</div>
          <div style={{ flex: 1 }} />
          <button onClick={addFacet} style={ghost}>+ Add plane</button>
          <button onClick={() => delFacet(sel)} style={ghost} disabled={facets.length === 0}>🗑 Delete #{sel + 1}</button>
          <button onClick={reset} style={ghost}>↺ Reset</button>
        </div>

        {sel != null && facets[sel] && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
            <span style={{ color: '#64748b' }}>Plane #{sel + 1} pitch</span>
            <input type="number" min="0" max="24" value={facets[sel].pitch}
              onChange={e => setFacets(fs => fs.map((f, i) => i === sel ? { ...f, pitch: +e.target.value } : f))}
              style={{ width: 60, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6 }} />
            <span style={{ color: '#64748b' }}>/12</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ ...btn, background: '#fff', color: '#475569', border: '1.5px solid #cbd5e1' }}>Cancel</button>
          <button onClick={save} style={{ ...btn, background: '#B01E17', color: '#fff', flex: 1 }}>Save adjusted measurements</button>
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>Aerial estimate — final measurements confirmed on-site.</div>
      </div>
    </div>
  )
}

function aspectOf(bb, lat) {
  if (!bb?.sw || !bb?.ne || lat == null) return 1.4
  const h = Math.abs(bb.ne.lat - bb.sw.lat) * M_PER_DEG_LAT
  const w = Math.abs(bb.ne.lng - bb.sw.lng) * M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  if (!h || !w) return 1.4
  return Math.max(w / h, h / w)
}

const ov = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
const modal = { background: '#fff', borderRadius: 16, padding: 20, maxWidth: 720, width: '100%', maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.3)', fontFamily: "'Segoe UI',system-ui,sans-serif" }
const head = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }
const xBtn = { background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }
const kpi = { background: '#0C1C38', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 13 }
const ghost = { background: '#fff', border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#334155' }
const btn = { borderRadius: 10, padding: '13px 18px', fontSize: 15, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit' }
