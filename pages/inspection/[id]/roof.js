/**
 * Roof Measurements report — /inspection/[id]/roof
 *
 * A standalone, branded 1–3 page document of the roof breakdown built from the
 * inspection's stored Google Solar measurement (sections.measure.solar):
 *   annotated aerial (numbered facet boxes) + summary + per-facet table.
 * Print/Save-PDF like the inspection report. Also surfaced in the proposal.
 */
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const getIdFromUrl = () => {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/\/inspection\/([^\/?#]+)\/roof/)
  return m ? decodeURIComponent(m[1]) : null
}

const QUALITY_COLOR = { HIGH: '#10B981', MEDIUM: '#F59E0B', LOW: '#9CA3AF' }

export default function RoofReport() {
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

  if (err) return <div style={{ padding: 30, fontFamily: 'system-ui', color: '#991B1B' }}>{err}</div>
  if (!insp) return <div style={{ padding: 30, fontFamily: 'system-ui', color: '#4A5568' }}>Loading roof measurements…</div>

  const solar = insp.sections?.measure?.solar
  const segments = solar?.segments || []
  const date = new Date(insp.submitted_at || insp.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const qColor = QUALITY_COLOR[solar?.imageryQuality] || '#9CA3AF'

  return (
    <>
      <Head>
        <title>Roof Measurements — {insp.inspection_num}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="no-print-fixed-header" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0C1C38', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>📐 Roof Measurements</span>
        <span>
          <button onClick={() => window.print()} style={{ background: '#B01E17', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 700, cursor: 'pointer', marginRight: 8 }}>🖨 Print / Save PDF</button>
          <a href={`/inspection/${insp.id}`} style={{ color: '#fff', textDecoration: 'none', fontSize: 12, opacity: .7 }}>← back to form</a>
        </span>
      </div>

      <div className="report-page">
        <header className="r-hero">
          <div className="r-hero-left">
            <img src="/logo.png" alt="GPR" className="r-logo" />
            <div>
              <div className="r-eyebrow">GOOD PEOPLE ROOFING</div>
              <div className="r-title">ROOF MEASUREMENTS</div>
            </div>
          </div>
          <div className="r-hero-right">
            <div className="r-num">{insp.inspection_num}</div>
            <div className="r-date">{date}</div>
          </div>
        </header>

        <section className="r-customer">
          <div className="r-block">
            <div className="r-lbl">PROPERTY</div>
            <div className="r-val r-val-lg">{insp.customer_name}</div>
            <div className="r-val">{insp.customer_address}</div>
          </div>
          <div className="r-block">
            <div className="r-lbl">SOURCE</div>
            <div className="r-val r-val-lg">Aerial imagery</div>
            <div className="r-val">Google Solar{solar?.imageryYear ? ` · ${solar.imageryYear}` : ''}</div>
          </div>
        </section>

        {!solar ? (
          <div className="r-empty">No aerial measurement on file. Open the inspection → Measurements → “📐 Estimate from aerial (Google Solar)” to generate it.</div>
        ) : (
          <>
            <div className="r-disclaimer">
              Aerial estimate from Google Solar imagery
              {solar.imageryQuality && <> · <span style={{ color: qColor, fontWeight: 800 }}>{solar.imageryQuality} confidence</span></>}.
              Measured roof surface (no waste factor). Verify on-site before ordering.
            </div>

            <section>
              <div className="r-section-title">ROOF OVERVIEW</div>
              <img className="r-aerial" src={`/api/roofmap?inspection=${insp.id}`} alt="Annotated roof aerial" />
              <div className="r-cap">Numbered planes correspond to the breakdown below.</div>
            </section>

            <section className="r-summary-grid">
              <div className="r-kpi"><div className="r-kpi-n">{solar.squares ?? '—'}</div><div className="r-kpi-l">SQUARES</div></div>
              <div className="r-kpi"><div className="r-kpi-n">{solar.pitch != null ? `${solar.pitch}/12` : '—'}</div><div className="r-kpi-l">DOMINANT PITCH</div></div>
              <div className="r-kpi"><div className="r-kpi-n">{solar.planes ?? (segments.length || '—')}</div><div className="r-kpi-l">ROOF PLANES</div></div>
              <div className="r-kpi"><div className="r-kpi-n">{solar.areaSqft ? solar.areaSqft.toLocaleString() : '—'}</div><div className="r-kpi-l">ROOF SQFT</div></div>
            </section>

            <section>
              <div className="r-section-title">PLANE-BY-PLANE BREAKDOWN</div>
              <table className="r-table">
                <thead><tr><th>#</th><th>Area (sqft)</th><th>Squares</th><th>Pitch</th><th>Facing</th></tr></thead>
                <tbody>
                  {segments.map((s, i) => (
                    <tr key={i}>
                      <td><span className="r-facet-num">{i + 1}</span></td>
                      <td>{s.areaSqft?.toLocaleString() || '—'}</td>
                      <td>{s.areaSqft ? (s.areaSqft / 100).toFixed(1) : '—'}</td>
                      <td>{s.pitch != null ? `${s.pitch}/12` : '—'}</td>
                      <td>{s.orientation || '—'}</td>
                    </tr>
                  ))}
                  {!segments.length && <tr><td colSpan={5} style={{ color: '#9CA3AF' }}>No facet detail available.</td></tr>}
                </tbody>
                {segments.length > 0 && (
                  <tfoot><tr><td>Total</td><td>{solar.areaSqft?.toLocaleString() || '—'}</td><td>{solar.squares ?? '—'}</td><td colSpan={2}></td></tr></tfoot>
                )}
              </table>
            </section>
          </>
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
        .r-customer{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;background:#F7F6F3;border-left:5px solid #D4960E;padding:16px 20px;border-radius:8px}
        .r-block{display:flex;flex-direction:column;gap:2px}
        .r-lbl{font-size:10px;font-weight:900;color:#4A5568;letter-spacing:1.4px;margin-bottom:4px}
        .r-val{font-size:13px;color:#1A1A2E;line-height:1.5}
        .r-val-lg{font-size:17px;font-weight:900;color:#0C1C38;margin-bottom:2px}
        .r-disclaimer{font-size:12px;color:#4A5568;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:10px 14px;margin-bottom:20px;line-height:1.5}
        section{margin-bottom:22px;page-break-inside:avoid}
        .r-section-title{font-size:13px;font-weight:900;color:#0C1C38;letter-spacing:1.6px;border-bottom:1px solid #E2E0DB;padding-bottom:6px;margin-bottom:12px}
        .r-aerial{width:100%;border-radius:10px;border:1px solid #E2E0DB;display:block}
        .r-cap{font-size:11px;color:#9CA3AF;margin-top:6px;text-align:center}
        .r-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        .r-kpi{background:#0C1C38;color:#fff;border-radius:10px;padding:16px 12px;text-align:center}
        .r-kpi-n{font-size:24px;font-weight:900;color:#D4960E;line-height:1}
        .r-kpi-l{font-size:9px;font-weight:800;letter-spacing:1px;color:rgba(255,255,255,.65);margin-top:6px}
        .r-table{width:100%;border-collapse:collapse;font-size:13px}
        .r-table th{background:#0C1C38;color:#fff;text-align:left;font-size:10px;font-weight:900;letter-spacing:1px;padding:8px 12px}
        .r-table td{padding:8px 12px;border-bottom:1px solid #E2E0DB}
        .r-table tfoot td{font-weight:900;color:#0C1C38;border-top:2px solid #0C1C38;background:#FAFAF8}
        .r-facet-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#B01E17;color:#fff;font-size:11px;font-weight:900}
        .r-empty{background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:20px;text-align:center;color:#92400E;font-size:14px;line-height:1.6}
        .r-footer{text-align:center;font-size:10px;color:#9CA3AF;border-top:2px solid #0C1C38;padding-top:14px;margin-top:24px;letter-spacing:.4px}
        @media print {
          .no-print-fixed-header{display:none !important}
          body{background:#fff}
          .report-page{max-width:none;margin:0;padding:14px 18px;box-shadow:none;border-radius:0}
        }
        @media(max-width:700px){
          .report-page{padding:22px 18px;margin:12px auto}
          .r-customer{grid-template-columns:1fr}
          .r-summary-grid{grid-template-columns:repeat(2,1fr)}
        }
      `}</style>
    </>
  )
}
