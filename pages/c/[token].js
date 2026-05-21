/**
 * Public customer project timeline — /c/[token]  (v3.5 + v3.6)
 *
 * A customer-facing status page (separate from the proposal at /p/[id]).
 * Shows where their roof project stands: milestones, what's next, and any
 * message from their rep. The uuid token in the URL is the only auth.
 */
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

// Normalize a milestone's status into one of: done | current | upcoming.
function normStatus(s) {
  const v = String(s || '').toLowerCase()
  if (['done', 'complete', 'completed'].includes(v)) return 'done'
  if (['current', 'in_progress', 'in-progress', 'active', 'expected'].includes(v)) return 'current'
  return 'upcoming'
}

export default function CustomerTimeline() {
  const router = useRouter()
  const { token } = router.query
  const [data, setData] = useState(null)
  const [err, setErr]   = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/customer/${token}`)
      .then(async r => {
        if (!r.ok) { setErr('We could not find this project link.'); return }
        setData(await r.json())
      })
      .catch(e => setErr(e.message))
  }, [token])

  if (err)   return <Center>{err}</Center>
  if (!data) return <Center>Loading your project…</Center>

  const milestones = Array.isArray(data.project_milestones) ? data.project_milestones : []
  const norm = milestones.map(m => ({
    label:  m.label || m.name || m.title || 'Milestone',
    status: normStatus(m.status || m.state),
    date:   m.date || m.expected_date || m.completed_at || m.eta || '',
    note:   m.note || m.detail || '',
  }))
  const current = norm.find(m => m.status === 'current')
  const firstName = (data.display_name || 'there').split(/\s+/)[0]

  return (
    <>
      <Head><title>Your Roof Project — Good People Roofing</title></Head>
      <div className="ct-wrap">
        <header className="ct-hero">
          <img src="/logo.png" alt="Good People Roofing" className="ct-logo" />
          <div className="ct-hero-title">YOUR PROJECT</div>
        </header>

        <main className="ct-main">
          <div className="ct-eyebrow">PROJECT STATUS FOR</div>
          <h1 className="ct-name">{data.display_name || 'Your Home'}</h1>
          {data.customer_stage && <div className="ct-stage">Current stage: <strong>{data.customer_stage}</strong></div>}

          {data.rep_message && (
            <div className="ct-repmsg">
              <div className="ct-repmsg-label">A NOTE FROM YOUR REP</div>
              <div>{data.rep_message}</div>
            </div>
          )}

          {current && (
            <div className="ct-next">
              <div className="ct-next-label">WHAT'S NEXT</div>
              <div className="ct-next-title">{current.label}</div>
              {current.date && <div className="ct-next-date">Expected: {current.date}</div>}
              {current.note && <div className="ct-next-note">{current.note}</div>}
            </div>
          )}

          <div className="ct-tl-title">PROJECT TIMELINE</div>
          {norm.length === 0 ? (
            <div className="ct-empty">Your project timeline will appear here once your install is scheduled.</div>
          ) : (
            <div className="ct-timeline">
              {norm.map((m, i) => (
                <div key={i} className={`ct-step ${m.status}`}>
                  <div className="ct-dot">{m.status === 'done' ? '✓' : m.status === 'current' ? '●' : ''}</div>
                  <div className="ct-step-body">
                    <div className="ct-step-label">{m.label}</div>
                    <div className="ct-step-meta">
                      {m.status === 'done' ? 'Done' : m.status === 'current' ? 'In progress' : 'Coming up'}
                      {m.date ? ` · ${m.date}` : ''}
                    </div>
                    {m.note && <div className="ct-step-note">{m.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        <footer className="ct-footer">
          Good People Roofing Inc. · goodpeopleroofinginc.com · (844) ROOFS-09 · CA Lic. C39 #1126880
        </footer>
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:#F7F6F3;color:#1A1A2E}
        .ct-wrap{max-width:680px;margin:0 auto;min-height:100vh}
        .ct-hero{background:#0C1C38;border-bottom:4px solid #B01E17;padding:22px 26px;display:flex;align-items:center;gap:16px}
        .ct-logo{height:52px;width:auto;background:#fff;border-radius:9px;padding:5px}
        .ct-hero-title{color:#D4960E;font-weight:900;font-size:14px;letter-spacing:2px}
        .ct-main{padding:30px 26px 50px}
        .ct-eyebrow{font-size:11px;font-weight:800;color:#4A5568;letter-spacing:1.5px;margin-bottom:5px}
        .ct-name{font-size:30px;font-weight:900;color:#0C1C38;line-height:1.15}
        .ct-stage{font-size:13px;color:#4A5568;margin-top:6px}
        .ct-repmsg{background:#fff;border-left:5px solid #D4960E;border-radius:10px;padding:15px 18px;margin:22px 0;font-size:14px;line-height:1.6;color:#1A1A2E}
        .ct-repmsg-label{font-size:10px;font-weight:900;color:#4A5568;letter-spacing:1.3px;margin-bottom:6px}
        .ct-next{background:linear-gradient(135deg,#0C1C38,#16305E);border-radius:13px;padding:20px 22px;margin:22px 0}
        .ct-next-label{font-size:10px;font-weight:900;color:#F0B429;letter-spacing:1.5px;margin-bottom:6px}
        .ct-next-title{font-size:20px;font-weight:900;color:#fff}
        .ct-next-date{font-size:13px;color:rgba(255,255,255,.7);margin-top:4px}
        .ct-next-note{font-size:13px;color:rgba(255,255,255,.85);margin-top:8px;line-height:1.5}
        .ct-tl-title{font-size:12px;font-weight:900;color:#4A5568;letter-spacing:1.5px;margin:28px 0 14px}
        .ct-empty{background:#fff;border-radius:10px;padding:20px;font-size:13px;color:#9CA3AF;text-align:center}
        .ct-timeline{position:relative}
        .ct-step{display:flex;gap:14px;padding-bottom:20px;position:relative}
        .ct-step:not(:last-child)::before{content:'';position:absolute;left:13px;top:28px;bottom:0;width:2px;background:#E2E0DB}
        .ct-step.done:not(:last-child)::before{background:#10B981}
        .ct-dot{width:28px;height:28px;border-radius:50%;border:2px solid #E2E0DB;background:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0;z-index:1}
        .ct-step.done .ct-dot{background:#10B981;border-color:#10B981}
        .ct-step.current .ct-dot{background:#B01E17;border-color:#B01E17;box-shadow:0 0 0 4px rgba(176,30,23,.15)}
        .ct-step-label{font-size:15px;font-weight:800;color:#0C1C38}
        .ct-step.upcoming .ct-step-label{color:#9CA3AF}
        .ct-step-meta{font-size:12px;color:#4A5568;margin-top:2px}
        .ct-step-note{font-size:12px;color:#4A5568;margin-top:5px;line-height:1.5}
        .ct-footer{background:#0C1C38;color:#94a3b8;text-align:center;padding:18px 26px;font-size:11px}
      `}</style>
    </>
  )
}

function Center({ children }) {
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'system-ui',color:'#4A5568',padding:'20px',textAlign:'center'}}>{children}</div>
}
