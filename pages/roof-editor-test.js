/**
 * /roof-editor-test — isolated harness for the roof line editor.
 *
 * Loads RoofEditor directly with a fixed seed measurement (real Yucaipa coords
 * + a few facets), bypassing the dashboard / measure flow entirely. Lets a
 * human (or Playwright) verify drag-recompute, add-corner, add/remove-plane in
 * one click without the SPA's dashboard load getting in the way.
 *
 * Auth-gated like the rest of the admin (middleware covers it — not in the
 * public allow-list). Safe to keep; it touches no data and saves nowhere.
 */
import { useState } from 'react'
import RoofEditor from '../components/RoofEditor'

const SEED = {
  available: true,
  squares: 21, pitch: 4, planes: 3, areaSqft: 2116,
  imageryQuality: 'HIGH', imageryYear: 2015,
  lat: 34.0328375, lng: -117.0301133,
  segments: [
    { areaSqft: 1100, pitch: 4, azimuthDeg: 90,  orientation: 'E', center: { lat: 34.0328375, lng: -117.0301133 }, boundingBox: { sw: { lat: 34.032740, lng: -117.030230 }, ne: { lat: 34.032930, lng: -117.029990 } } },
    { areaSqft: 700,  pitch: 4, azimuthDeg: 270, orientation: 'W', center: { lat: 34.032770, lng: -117.030240 }, boundingBox: { sw: { lat: 34.032700, lng: -117.030330 }, ne: { lat: 34.032840, lng: -117.030150 } } },
    { areaSqft: 316,  pitch: 5, azimuthDeg: 180, orientation: 'S', center: { lat: 34.032880, lng: -117.030060 }, boundingBox: { sw: { lat: 34.032830, lng: -117.030120 }, ne: { lat: 34.032930, lng: -117.030000 } } },
  ],
}

export default function RoofEditorTest() {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(null)
  return (
    <div style={{ minHeight: '100vh', background: '#0C1C38', color: '#fff', fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900 }}>Roof Editor — test harness</h1>
      <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 14, maxWidth: 560, lineHeight: 1.5 }}>
        Seed: 3 facets, 21 squares, 2,116 sqft. Open the editor and try: drag a red corner (sqft should change),
        tap a gold <b>+</b> on an edge (a corner appears), double-tap a corner to remove, “+ Add plane”.
      </p>
      <button onClick={() => setOpen(true)} style={{ background: '#D4960E', color: '#0C1C38', fontWeight: 900, fontSize: 15, padding: '12px 22px', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
        ✏️ Open roof editor
      </button>
      {saved && (
        <pre style={{ marginTop: 18, background: 'rgba(255,255,255,.06)', padding: 14, borderRadius: 10, fontSize: 12, maxWidth: 560, overflow: 'auto' }}>
          saved → squares {saved.squares} · sqft {saved.areaSqft?.toLocaleString()} · planes {saved.planes} · edited {String(saved.edited)}
        </pre>
      )}
      {open && (
        <RoofEditor
          roof={SEED}
          onClose={() => setOpen(false)}
          onSave={(updated) => { setSaved(updated); setOpen(false) }}
        />
      )}
    </div>
  )
}
