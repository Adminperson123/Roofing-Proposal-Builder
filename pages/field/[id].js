import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

function getIdFromUrl() {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/\/field\/([^\/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}
function getTokenFromUrl() {
  if (typeof window === 'undefined') return null
  const u = new URLSearchParams(window.location.search)
  return u.get('t')
}

export default function FieldUpload() {
  const router = useRouter()
  // URL fallbacks for statically-optimized dynamic routes (router.query empty pre-isReady).
  const id = router.query.id || getIdFromUrl()
  const t  = router.query.t  || getTokenFromUrl()
  const [proposal, setProposal] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploaded, setUploaded] = useState([])
  const [toast, setToast] = useState('')
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/proposal/${id}`).then(async r => {
      if (!r.ok) { setErr('Proposal not found.'); return }
      const data = await r.json()
      setProposal(data)
      setUploaded(Array.isArray(data.photo_urls) ? data.photo_urls : [])
    }).catch(e => setErr(e.message))
  }, [id])

  async function onFiles(fileList) {
    if (!fileList?.length || !t) return
    setBusy(true); setToast('')
    try {
      const items = []
      for (const f of fileList) {
        if (!/^image\//.test(f.type)) continue
        if (f.size > 10 * 1024 * 1024) { setToast(`${f.name} skipped (>10MB)`); continue }
        const b64 = await fileToBase64(f)
        items.push({ name: f.name, mime: f.type, base64: b64 })
      }
      if (!items.length) { setBusy(false); return }

      const CHUNK = 3
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK)
        const r = await fetch(`/api/proposal/${id}/photos?t=${encodeURIComponent(t)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files: slice }),
        })
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || `Upload failed (${r.status})`)
        }
        const d = await r.json()
        setUploaded(prev => [...prev, ...(d.photos || [])])
      }
      setToast(`✓ ${items.length} photo${items.length > 1 ? 's' : ''} uploaded`)
    } catch (e) {
      setToast('⚠️ ' + e.message)
    } finally {
      setBusy(false)
      if (cameraRef.current)  cameraRef.current.value  = ''
      if (libraryRef.current) libraryRef.current.value = ''
    }
  }

  if (err) {
    return <Centered><div className="fld-err">⚠️ {err}</div></Centered>
  }
  if (!proposal) {
    return <Centered><div className="fld-loading">Loading proposal…</div></Centered>
  }
  if (!t) {
    return <Centered><div className="fld-err">⚠️ Missing access token. Open this link from your Field Link button or SMS.</div></Centered>
  }

  return (
    <>
      <Head>
        <title>Field Upload — {proposal.customer_name}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </Head>

      <div className="fld-wrap">
        <header className="fld-hero">
          <img src="/logo.png" alt="Good People Roofing" className="fld-logo" />
          <div className="fld-hero-text">
            <div className="fld-hero-eyebrow">FIELD UPLOAD</div>
            <div className="fld-hero-num">PROPOSAL {proposal.prop_num}</div>
          </div>
        </header>

        <main className="fld-main">
          <section className="fld-customer">
            <div className="fld-customer-lbl">CUSTOMER</div>
            <div className="fld-customer-name">{proposal.customer_name}</div>
            <div className="fld-customer-addr">{proposal.customer_address}</div>
          </section>

          <section className="fld-actions">
            <button className="fld-btn fld-btn-primary" onClick={() => cameraRef.current?.click()} disabled={busy}>
              <span className="fld-btn-icon">📸</span>
              <span className="fld-btn-text">
                <strong>Take Photos</strong>
                <span>Opens your camera</span>
              </span>
            </button>

            <button className="fld-btn fld-btn-outline" onClick={() => libraryRef.current?.click()} disabled={busy}>
              <span className="fld-btn-icon">🖼</span>
              <span className="fld-btn-text">
                <strong>From Library</strong>
                <span>Pick existing photos</span>
              </span>
            </button>

            <input
              ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
              style={{ display: 'none' }}
              onChange={e => onFiles(e.target.files)}
            />
            <input
              ref={libraryRef} type="file" accept="image/*" multiple
              style={{ display: 'none' }}
              onChange={e => onFiles(e.target.files)}
            />
          </section>

          {busy && <div className="fld-status">⏳ Uploading…</div>}
          {toast && !busy && <div className="fld-status fld-toast">{toast}</div>}

          {uploaded.length > 0 && (
            <section className="fld-thumbs-section">
              <div className="fld-thumbs-head">
                <span>Attached to this proposal</span>
                <strong>{uploaded.length}</strong>
              </div>
              <div className="fld-thumbs">
                {uploaded.map((ph, i) => (
                  <a key={i} href={ph.url} target="_blank" rel="noreferrer" className="fld-thumb">
                    <img src={ph.url} alt={ph.name || `Photo ${i + 1}`} loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <a className="fld-view-link" href={`/p/${proposal.id}`} target="_blank" rel="noreferrer">
            View the proposal page →
          </a>
        </main>
      </div>

      <style jsx global>{`
        :root{--navy:#0C1C38;--crimson:#B01E17;--gold:#D4960E;--cream:#F7F6F3;--text:#1A1A2E;--mute:#4A5568;--bord:#E2E0DB;--success:#10B981}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--cream);color:var(--text);min-height:100vh;-webkit-text-size-adjust:100%}
        .fld-wrap{max-width:520px;margin:0 auto;padding-bottom:40px}
        .fld-hero{background:var(--navy);padding:18px 20px;display:flex;align-items:center;gap:14px;border-bottom:4px solid var(--crimson)}
        .fld-logo{height:48px;width:auto;background:#fff;border-radius:8px;padding:5px;flex-shrink:0}
        .fld-hero-text{flex:1;min-width:0}
        .fld-hero-eyebrow{color:var(--gold);font-size:10px;font-weight:900;letter-spacing:1.5px}
        .fld-hero-num{color:#fff;font-size:14px;font-weight:900;margin-top:3px;letter-spacing:.8px}
        .fld-main{padding:22px 18px;display:flex;flex-direction:column;gap:20px}
        .fld-customer{background:#fff;border-radius:14px;padding:18px 20px;border-left:5px solid var(--gold);box-shadow:0 2px 12px rgba(0,0,0,.04)}
        .fld-customer-lbl{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.5px;margin-bottom:6px}
        .fld-customer-name{font-size:20px;font-weight:900;color:var(--navy);line-height:1.2;margin-bottom:4px}
        .fld-customer-addr{font-size:13px;color:var(--mute);line-height:1.4}
        .fld-actions{display:flex;flex-direction:column;gap:10px}
        .fld-btn{display:flex;align-items:center;gap:14px;background:#fff;border:none;border-radius:14px;padding:18px 20px;text-align:left;cursor:pointer;font-family:inherit;color:inherit;min-height:72px;transition:transform .12s,box-shadow .15s}
        .fld-btn:disabled{opacity:.5;cursor:not-allowed}
        .fld-btn:active:not(:disabled){transform:scale(.98)}
        .fld-btn-primary{background:var(--crimson);color:#fff;box-shadow:0 4px 18px rgba(176,30,23,.25)}
        .fld-btn-primary:hover:not(:disabled){background:#D4251C}
        .fld-btn-outline{background:#fff;border:2.5px solid var(--bord)}
        .fld-btn-outline:hover:not(:disabled){border-color:var(--crimson)}
        .fld-btn-icon{font-size:32px;flex-shrink:0;width:48px;text-align:center}
        .fld-btn-text{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
        .fld-btn-text strong{font-size:17px;font-weight:900;letter-spacing:.3px}
        .fld-btn-text span{font-size:12px;opacity:.8}
        .fld-status{padding:12px 16px;background:#fff;border-radius:10px;font-size:13px;color:var(--mute);text-align:center;font-weight:600}
        .fld-toast{background:#ECFDF5;border:1px solid var(--success);color:#065F46}
        .fld-thumbs-section{background:#fff;border-radius:14px;padding:16px 18px;border:1px solid var(--bord)}
        .fld-thumbs-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--bord);font-size:12px;font-weight:700;color:var(--mute);letter-spacing:.5px;text-transform:uppercase}
        .fld-thumbs-head strong{background:var(--navy);color:#fff;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:900}
        .fld-thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
        .fld-thumb{display:block;aspect-ratio:1;border-radius:9px;overflow:hidden;border:2px solid var(--bord);text-decoration:none}
        .fld-thumb img{width:100%;height:100%;object-fit:cover;display:block}
        .fld-view-link{display:block;text-align:center;color:var(--crimson);font-size:13px;font-weight:700;padding:14px;text-decoration:none}
        .fld-view-link:hover{text-decoration:underline}
        .fld-err,.fld-loading{padding:24px;background:#fff;border-radius:12px;text-align:center;color:var(--mute);font-size:14px;font-weight:600;max-width:420px;margin:0 16px}
        .fld-err{border:1px solid #FCA5A5;color:#991B1B}
      `}</style>
    </>
  )
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = r.result
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function Centered({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F7F6F3', fontFamily: 'system-ui,sans-serif' }}>
      {children}
    </div>
  )
}
