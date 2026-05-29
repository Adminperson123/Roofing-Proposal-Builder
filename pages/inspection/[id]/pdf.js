import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const getIdFromUrl = () => {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/\/inspection\/([^\/?#]+)\/pdf/)
  return m ? decodeURIComponent(m[1]) : null
}

const URGENCY_BADGE = {
  low:       { label: 'LOW — Monitor', color: '#10B981' },
  medium:    { label: 'MEDIUM — Within season', color: '#F59E0B' },
  high:      { label: 'HIGH — Within 30 days', color: '#F97316' },
  emergency: { label: 'EMERGENCY — Active leak', color: '#DC2626' },
}

const DAMAGE_LABEL = {
  missing_shingles: 'Missing shingles',
  broken_tiles: 'Broken / cracked tiles',
  granule_loss: 'Granule loss',
  hail_strikes: 'Hail strikes',
  wind_damage: 'Wind lift / blow-off',
  exposed_nails: 'Exposed nails',
  flashing_failure: 'Flashing failure',
  underlayment: 'Underlayment exposed',
}

const ATTIC_FINDING_LABEL = {
  mold: 'Mold / mildew',
  light: 'Light leaks',
  water_stain: 'Water staining',
  rot: 'Wood rot',
  pests: 'Pest activity',
  poor_vent: 'Poor ventilation',
  none: 'No issues found',
}

export default function InspectionReport() {
  const router = useRouter()
  const id = router.query.id || getIdFromUrl()
  const [insp, setInsp] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/inspection/${id}`).then(async r => {
      if (!r.ok) { setErr('Inspection not found.'); return }
      setInsp(await r.json())
    }).catch(e => setErr(e.message))
  }, [id])

  if (err) return <div style={{padding:30,fontFamily:'system-ui',color:'#991B1B'}}>{err}</div>
  if (!insp) return <div style={{padding:30,fontFamily:'system-ui',color:'#4A5568'}}>Loading report…</div>

  const s = insp.sections || {}
  const photos = insp.photos || []
  const urg = URGENCY_BADGE[insp.urgency] || { label: 'Not set', color: '#9CA3AF' }
  const date = new Date(insp.submitted_at || insp.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  return (
    <>
      <Head>
        <title>Inspection Report — {insp.inspection_num}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="report no-print-fixed-header" style={{position:'sticky',top:0,zIndex:10,background:'#0C1C38',color:'#fff',padding:'10px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:13,fontWeight:700}}>📄 Inspection Report</span>
        <span>
          <button onClick={() => window.print()} style={{background:'#B01E17',color:'#fff',border:'none',padding:'8px 16px',borderRadius:6,fontWeight:700,cursor:'pointer',marginRight:8}}>🖨 Print / Save PDF</button>
          <a href={`/inspection/${insp.id}`} style={{color:'#fff',textDecoration:'none',fontSize:12,opacity:.7}}>← back to form</a>
        </span>
      </div>

      <div className="report-page">

        <header className="r-hero">
          <div className="r-hero-left">
            <img src="/logo.png" alt="GPR" className="r-logo" />
            <div>
              <div className="r-eyebrow">GOOD PEOPLE ROOFING</div>
              <div className="r-title">SITE INSPECTION REPORT</div>
            </div>
          </div>
          <div className="r-hero-right">
            <div className="r-num">{insp.inspection_num}</div>
            <div className="r-date">{date}</div>
            <span className="r-urgency" style={{background: urg.color}}>{urg.label}</span>
          </div>
        </header>

        <section className="r-customer">
          <div className="r-block">
            <div className="r-lbl">CUSTOMER</div>
            <div className="r-val r-val-lg">{insp.customer_name}</div>
            <div className="r-val">{insp.customer_address}</div>
            {insp.customer_phone && <div className="r-val">{insp.customer_phone}</div>}
            {insp.customer_email && <div className="r-val">{insp.customer_email}</div>}
          </div>
          <div className="r-block">
            <div className="r-lbl">INSPECTED BY</div>
            <div className="r-val r-val-lg">{insp.rep_name || '—'}</div>
            <div className="r-val">CA Lic. C39 #1126880</div>
          </div>
        </section>

        {insp.recommendation_summary && (
          <section className="r-summary">
            <div className="r-section-title">RECOMMENDED SCOPE</div>
            <p>{insp.recommendation_summary}</p>
          </section>
        )}

        <section>
          <div className="r-section-title">1. ROOF ACCESS & GENERAL CONDITION</div>
          <div className="r-grid">
            <div className="r-cell"><div className="r-cell-lbl">Access method</div><div className="r-cell-val">{s.access?.access_method || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Hazards</div><div className="r-cell-val">{s.access?.hazards || '—'}</div></div>
            <div className="r-cell r-cell-full"><div className="r-cell-lbl">Ground observation</div><div className="r-cell-val">{s.access?.ground_observation || '—'}</div></div>
          </div>
        </section>

        <section>
          <div className="r-section-title">2. ROOF SYSTEM</div>
          <div className="r-grid">
            <div className="r-cell"><div className="r-cell-lbl">Material</div><div className="r-cell-val">{s.system?.material || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Brand</div><div className="r-cell-val">{s.system?.brand || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Est. age</div><div className="r-cell-val">{s.system?.age_years ? `${s.system.age_years} years` : '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Layers</div><div className="r-cell-val">{s.system?.layers || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Decking (above)</div><div className="r-cell-val">{s.system?.decking || '—'}</div></div>
          </div>
        </section>

        <section>
          <div className="r-section-title">3. MEASUREMENTS</div>
          <div className="r-grid">
            <div className="r-cell"><div className="r-cell-lbl">Squares</div><div className="r-cell-val">{s.measure?.squares || '—'} sq</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Pitch</div><div className="r-cell-val">{s.measure?.pitch || '—'}/12</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Planes</div><div className="r-cell-val">{s.measure?.planes || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Stories</div><div className="r-cell-val">{s.measure?.stories || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Home sqft</div><div className="r-cell-val">{s.measure?.home_sqft ? Number(s.measure.home_sqft).toLocaleString() : '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Method</div><div className="r-cell-val">{s.measure?.method || '—'}</div></div>
          </div>
        </section>

        <section>
          <div className="r-section-title">4. DAMAGE SURVEY</div>
          <div className="r-grid">
            <div className="r-cell"><div className="r-cell-lbl">Severity</div><div className="r-cell-val">{s.damage?.severity || '—'}</div></div>
            <div className="r-cell r-cell-full">
              <div className="r-cell-lbl">Types observed</div>
              <div className="r-pills">
                {(s.damage?.types || []).map(t => <span key={t} className="r-pill">{DAMAGE_LABEL[t] || t}</span>)}
                {!(s.damage?.types || []).length && <span className="r-val">None noted</span>}
              </div>
            </div>
            <div className="r-cell r-cell-full"><div className="r-cell-lbl">Details</div><div className="r-cell-val">{s.damage?.details || '—'}</div></div>
          </div>
        </section>

        <section>
          <div className="r-section-title">5. PENETRATIONS & FLASHINGS</div>
          <table className="r-table">
            <thead><tr><th>Area</th><th>Condition</th></tr></thead>
            <tbody>
              {Object.entries(s.penetrations?.conditions || {}).map(([area, cond]) => (
                <tr key={area}><td>{area}</td><td className={`r-cond-${cond}`}>{cond}</td></tr>
              ))}
              {!Object.keys(s.penetrations?.conditions || {}).length && <tr><td colSpan={2} style={{color:'#9CA3AF'}}>No areas inspected</td></tr>}
            </tbody>
          </table>
          {s.penetrations?.pipe_boots && <p className="r-note"><strong>Pipe boots:</strong> {s.penetrations.pipe_boots}</p>}
        </section>

        <section className="r-attic">
          <div className="r-section-title">6. ATTIC INSPECTION</div>
          <div className="r-grid">
            <div className="r-cell"><div className="r-cell-lbl">Accessed</div><div className="r-cell-val">{s.attic?.accessed || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Decking confirmed</div><div className="r-cell-val">{s.attic?.decking_confirmed || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Insulation</div><div className="r-cell-val">{s.attic?.insulation || '—'}</div></div>
            <div className="r-cell r-cell-full">
              <div className="r-cell-lbl">Findings</div>
              <div className="r-pills">
                {(s.attic?.findings || []).map(f => <span key={f} className="r-pill">{ATTIC_FINDING_LABEL[f] || f}</span>)}
                {!(s.attic?.findings || []).length && <span className="r-val">—</span>}
              </div>
            </div>
            <div className="r-cell r-cell-full"><div className="r-cell-lbl">Notes</div><div className="r-cell-val">{s.attic?.notes || '—'}</div></div>
          </div>
        </section>

        <section>
          <div className="r-section-title">7. VENTILATION & GUTTERS</div>
          <div className="r-grid">
            <div className="r-cell r-cell-full">
              <div className="r-cell-lbl">Ventilation types</div>
              <div className="r-pills">
                {(s.ventilation?.types || []).map(t => <span key={t} className="r-pill">{t}</span>)}
                {!(s.ventilation?.types || []).length && <span className="r-val">—</span>}
              </div>
            </div>
            <div className="r-cell"><div className="r-cell-lbl">Adequacy</div><div className="r-cell-val">{s.ventilation?.adequacy || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Gutters</div><div className="r-cell-val">{s.ventilation?.gutters || '—'}</div></div>
            <div className="r-cell"><div className="r-cell-lbl">Fascia</div><div className="r-cell-val">{s.ventilation?.fascia || '—'}</div></div>
          </div>
        </section>

        {photos.length > 0 && (
          <section className="r-photos">
            <div className="r-section-title">📸 PHOTOS ({photos.length})</div>
            <div className="r-photo-grid">
              {photos.map((p, i) => (
                <figure key={i}>
                  <img src={p.url} alt={p.section || ''} loading="lazy" decoding="async" />
                  {p.section && <figcaption>{p.section}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        <footer className="r-footer">
          Good People Roofing Inc. &nbsp;·&nbsp; CA Lic. C39 #1126880 &nbsp;·&nbsp; (844) ROOFS-09 &nbsp;·&nbsp; goodpeopleroofinginc.com
        </footer>
      </div>

      <style jsx global>{`
        body{margin:0;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1A1A2E;background:#E5E7EB}
        .report-page{max-width:850px;margin:24px auto;background:#fff;padding:42px 48px;box-shadow:0 8px 32px rgba(0,0,0,.08);border-radius:8px}
        .r-hero{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #B01E17;padding-bottom:18px;margin-bottom:24px;gap:14px;flex-wrap:wrap}
        .r-hero-left{display:flex;align-items:center;gap:14px}
        .r-logo{height:60px;width:auto}
        .r-eyebrow{font-size:11px;font-weight:900;color:#0C1C38;letter-spacing:2px}
        .r-title{font-size:22px;font-weight:900;color:#0C1C38;letter-spacing:1px;margin-top:2px}
        .r-hero-right{text-align:right}
        .r-num{font-size:20px;font-weight:900;color:#B01E17;letter-spacing:1px}
        .r-date{font-size:12px;color:#4A5568;margin-top:2px}
        .r-urgency{display:inline-block;color:#fff;font-size:10px;font-weight:900;letter-spacing:1.2px;padding:5px 12px;border-radius:20px;margin-top:8px}
        .r-customer{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;background:#F7F6F3;border-left:5px solid #D4960E;padding:16px 20px;border-radius:8px}
        .r-block{display:flex;flex-direction:column;gap:2px}
        .r-lbl{font-size:10px;font-weight:900;color:#4A5568;letter-spacing:1.4px;margin-bottom:4px}
        .r-val{font-size:13px;color:#1A1A2E;line-height:1.5}
        .r-val-lg{font-size:17px;font-weight:900;color:#0C1C38;margin-bottom:2px}
        .r-summary{background:#FFFBEB;border:1px solid #FCD34D;border-left:5px solid #F59E0B;border-radius:8px;padding:14px 18px;margin-bottom:24px}
        .r-summary p{font-size:14px;line-height:1.55;color:#1A1A2E;margin-top:6px;white-space:pre-wrap}
        section{margin-bottom:22px;page-break-inside:avoid}
        .r-section-title{font-size:13px;font-weight:900;color:#0C1C38;letter-spacing:1.6px;border-bottom:1px solid #E2E0DB;padding-bottom:6px;margin-bottom:12px}
        .r-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
        .r-cell{background:#FAFAF8;border:1px solid #E2E0DB;border-radius:6px;padding:10px 12px}
        .r-cell-full{grid-column:1/-1}
        .r-cell-lbl{font-size:9px;font-weight:900;color:#4A5568;letter-spacing:1.2px;margin-bottom:3px}
        .r-cell-val{font-size:13px;font-weight:600;color:#1A1A2E;line-height:1.45;white-space:pre-wrap}
        .r-pills{display:flex;flex-wrap:wrap;gap:5px}
        .r-pill{display:inline-block;padding:3px 10px;background:#fff;border:1px solid #0C1C38;color:#0C1C38;font-size:11px;font-weight:700;border-radius:20px}
        .r-table{width:100%;border-collapse:collapse;font-size:13px}
        .r-table th{background:#0C1C38;color:#fff;text-align:left;font-size:10px;font-weight:900;letter-spacing:1px;padding:7px 12px}
        .r-table td{padding:7px 12px;border-bottom:1px solid #E2E0DB;text-transform:capitalize}
        .r-cond-good{color:#10B981;font-weight:800}
        .r-cond-worn{color:#F59E0B;font-weight:800}
        .r-cond-failing{color:#DC2626;font-weight:800}
        .r-cond-na{color:#9CA3AF}
        .r-note{font-size:12px;color:#4A5568;margin-top:8px;font-style:italic}
        .r-attic{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px}
        .r-photos{}
        .r-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .r-photo-grid figure{margin:0;border:1px solid #E2E0DB;border-radius:6px;overflow:hidden}
        .r-photo-grid img{width:100%;height:140px;object-fit:cover;display:block}
        .r-photo-grid figcaption{font-size:10px;color:#4A5568;padding:4px 8px;text-align:center;text-transform:capitalize;background:#FAFAF8}
        .r-footer{text-align:center;font-size:10px;color:#9CA3AF;border-top:2px solid #0C1C38;padding-top:14px;margin-top:24px;letter-spacing:.4px}
        @media print {
          .no-print-fixed-header{display:none !important}
          body{background:#fff}
          .report-page{max-width:none;margin:0;padding:14px 18px;box-shadow:none;border-radius:0}
          .r-photo-grid img{height:110px}
        }
        @media(max-width:700px){
          .report-page{padding:22px 18px;margin:12px auto}
          .r-customer{grid-template-columns:1fr}
          .r-grid{grid-template-columns:1fr 1fr}
          .r-photo-grid{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>
    </>
  )
}
