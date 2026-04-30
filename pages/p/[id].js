import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

export default function PublicProposal() {
  const router = useRouter()
  const { id } = router.query
  const [p, setP] = useState(null)
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState(null)
  const [accepted, setAccepted] = useState(null)
  const sigRef = useRef(null)
  const sigCtxRef = useRef(null)
  const [sigFilled, setSigFilled] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch(`/api/proposal/${id}`).then(async r => {
      if (!r.ok) { setErr('Proposal not found.'); return }
      const data = await r.json()
      setP(data)
      if (data.selected_tier) setAccepted({ tier: data.selected_tier, at: data.accepted_at })
    }).catch(e => setErr(e.message))
  }, [id])

  function initSig(canvas) {
    if (!canvas || sigCtxRef.current) return
    const r = canvas.getBoundingClientRect()
    canvas.width = r.width * (window.devicePixelRatio || 1)
    canvas.height = r.height * (window.devicePixelRatio || 1)
    const ctx = canvas.getContext('2d')
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
    ctx.strokeStyle = '#0C1C38'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    sigCtxRef.current = ctx
    let drawing = false
    const pt = e => {
      const b = canvas.getBoundingClientRect()
      return e.touches ? { x: e.touches[0].clientX - b.left, y: e.touches[0].clientY - b.top } : { x: e.clientX - b.left, y: e.clientY - b.top }
    }
    canvas.addEventListener('mousedown', e => { drawing = true; const p = pt(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) })
    canvas.addEventListener('mousemove', e => { if (!drawing) return; const p = pt(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setSigFilled(true) })
    canvas.addEventListener('mouseup', () => drawing = false); canvas.addEventListener('mouseleave', () => drawing = false)
    canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; const p = pt(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }, { passive: false })
    canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!drawing) return; const p = pt(e); ctx.lineTo(p.x, p.y); ctx.stroke(); setSigFilled(true) }, { passive: false })
    canvas.addEventListener('touchend', () => drawing = false)
  }
  function clearSig() {
    const c = sigRef.current; if (!c || !sigCtxRef.current) return
    sigCtxRef.current.clearRect(0, 0, c.width, c.height); setSigFilled(false)
  }

  async function accept() {
    if (!picking || !sigFilled) return
    const dataUrl = sigRef.current?.toDataURL('image/png')
    const r = await fetch(`/api/proposal/${id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: picking, signature: dataUrl }),
    })
    if (!r.ok) { alert('Failed to accept'); return }
    setAccepted({ tier: picking, at: new Date().toISOString() })
    setPicking(null)
  }

  if (err) return <Center>{err}</Center>
  if (!p) return <Center>Loading proposal…</Center>

  const tiers = p.tiers || {}
  const COLORS = { good: '#4A5568', better: '#B01E17', best: '#D4960E' }
  const date = new Date(p.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  const expires = new Date(p.expires_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })

  return (
    <>
      <Head><title>Your Proposal — Good People Roofing</title></Head>
      <div className="pub-wrap">
        <header className="pub-hero">
          <img src="/logo.png" alt="Good People Roofing" className="pub-logo" />
          <div className="pub-hero-sub">
            <div className="pub-hero-num">PROPOSAL {p.prop_num}</div>
            <div className="pub-hero-meta">{date} · valid until {expires}</div>
          </div>
        </header>

        <main className="pub-main">
          <section className="pub-intro">
            <div className="pub-eyebrow">PREPARED FOR</div>
            <h1 className="pub-name">{p.customer_name}</h1>
            <div className="pub-addr">{p.customer_address}</div>
            {p.rep_name && <div className="pub-rep">Your rep: <strong>{p.rep_name}</strong></div>}
          </section>

          <section className="pub-scope">
            <div className="pub-scope-title">YOUR PROJECT AT A GLANCE</div>
            <div className="pub-scope-grid">
              <div><span>Roof type</span><strong>{p.roof_type === 'tile' ? `Tile${p.tile_subtype ? ' (' + p.tile_subtype + ')' : ''}` : 'Architectural Shingle'}</strong></div>
              <div><span>Squares</span><strong>{p.squares} sq (~{(p.squares * 100).toLocaleString()} sqft)</strong></div>
              <div><span>Pitch</span><strong>{p.pitch}/12{p.pitch >= 7 ? ' (steep)' : ''}</strong></div>
              <div><span>Stories</span><strong>{p.stories}</strong></div>
            </div>
            {Array.isArray(p.addons) && p.addons.length > 0 && (
              <div className="pub-addons">Add-ons: <strong>{p.addons.join(' · ')}</strong></div>
            )}
          </section>

          {accepted ? (
            <section className="pub-accepted">
              <div className="pub-accepted-icon">✓</div>
              <h2>You picked the {tiers[accepted.tier]?.name} package</h2>
              <p>We received your acceptance on {new Date(accepted.at).toLocaleString()}. Your rep will be in touch within 24 hours to schedule the install.</p>
              <a className="pub-btn-outline" href={`/api/proposal/${p.id}/pdf`} target="_blank" rel="noreferrer">Download PDF copy</a>
            </section>
          ) : (
            <>
              <section>
                <h2 className="pub-section-title">CHOOSE YOUR PACKAGE</h2>
                <p className="pub-section-sub">Three honest options. Same workmanship, different materials and warranties. Pick the one that fits your home and your budget.</p>
                <div className="pub-tiers">
                  {['good','better','best'].map(k => {
                    const t = tiers[k]; if (!t) return null
                    const c = COLORS[k]; const popular = k === 'better'
                    return (
                      <article key={k} className={`pub-tier ${popular ? 'pop' : ''}`} style={{ borderColor: c }}>
                        {popular && <div className="pub-tier-pop">★ MOST POPULAR</div>}
                        <div className="pub-tier-badge" style={{ background: c }}>{(t.name || k).toUpperCase()}</div>
                        <h3 className="pub-tier-name">{t.name}</h3>
                        <div className="pub-tier-tag">{t.tagline}</div>
                        <div className="pub-tier-price" style={{ color: c }}>${(t.price || 0).toLocaleString()}</div>
                        <div className="pub-tier-psf">${t.psf}/sq · {p.squares} squares</div>
                        <div className="pub-tier-mat-box">
                          <div className="pub-tier-mat-lbl">MATERIAL</div>
                          <div className="pub-tier-mat">{t.material}</div>
                          <div className="pub-tier-brand">{t.brand}</div>
                        </div>
                        <div className="pub-tier-warr" style={{ color: c }}>🛡 {t.warranty}</div>
                        <p className="pub-tier-narrative">{t.narrative}</p>
                        <ul className="pub-tier-feats">
                          {(t.features || []).map((f, i) => <li key={i}><span style={{ color: c }}>✓</span>{f}</li>)}
                        </ul>
                        <button className="pub-tier-cta" style={{ background: c }} onClick={() => setPicking(k)}>
                          Select {t.name}
                        </button>
                      </article>
                    )
                  })}
                </div>
              </section>

              <section className="pub-terms">
                <h3>Terms</h3>
                <p>This proposal is valid for 14 days. Deposit: $1,000 or 10% (whichever is less) due upon signing · 50% at start · balance upon completion. Wood repairs, extra layers, and permit costs added via signed Change Order. CA Lic. C39 #1126880. Fully licensed and insured.</p>
              </section>
            </>
          )}
        </main>

        <footer className="pub-footer">
          Good People Roofing Inc. &nbsp;·&nbsp; goodpeopleroofinginc.com &nbsp;·&nbsp; (844) ROOFS-09 &nbsp;·&nbsp; CA Lic. C39 #1126880
        </footer>
      </div>

      {picking && tiers[picking] && (
        <div className="pub-modal-overlay" onClick={() => setPicking(null)}>
          <div className="pub-modal" onClick={e => e.stopPropagation()}>
            <h3>Sign to accept the {tiers[picking].name} package</h3>
            <div className="pub-modal-sum">
              <strong>{tiers[picking].name}</strong> — ${(tiers[picking].price || 0).toLocaleString()}<br />
              <span>{tiers[picking].material}</span>
            </div>
            <div className="pub-sig-wrap">
              <canvas ref={el => { sigRef.current = el; if (el) initSig(el) }} className="pub-sig" />
              <div className="pub-sig-bar">
                <span>Sign with your finger or mouse</span>
                <button onClick={clearSig}>Clear</button>
              </div>
            </div>
            <div className="pub-modal-btns">
              <button className="pub-btn-back" onClick={() => setPicking(null)}>Cancel</button>
              <button className="pub-btn-primary" onClick={accept} disabled={!sigFilled}>Accept &amp; Sign</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        :root{--navy:#0C1C38;--crimson:#B01E17;--gold:#D4960E;--cream:#F7F6F3;--text:#1A1A2E;--mute:#4A5568;--bord:#E2E0DB}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--cream);color:var(--text);min-height:100vh}
        .pub-wrap{max-width:1180px;margin:0 auto}
        .pub-hero{background:var(--navy);padding:24px 32px;display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid var(--crimson)}
        .pub-logo{height:64px;width:auto;background:#fff;border-radius:10px;padding:6px}
        .pub-hero-sub{text-align:right}
        .pub-hero-num{color:var(--gold);font-weight:900;font-size:14px;letter-spacing:1.5px}
        .pub-hero-meta{color:#94a3b8;font-size:11px;margin-top:3px}
        .pub-main{padding:36px 28px 60px}
        .pub-intro{margin-bottom:30px}
        .pub-eyebrow{font-size:11px;font-weight:800;color:var(--mute);letter-spacing:1.5px;margin-bottom:6px}
        .pub-name{font-size:36px;font-weight:900;color:var(--navy);line-height:1.1;margin-bottom:6px}
        .pub-addr{font-size:14px;color:var(--mute)}
        .pub-rep{font-size:13px;color:var(--mute);margin-top:4px}
        .pub-scope{background:#fff;border-radius:14px;padding:22px 26px;margin-bottom:34px;border-left:5px solid var(--gold);box-shadow:0 2px 12px rgba(0,0,0,.04)}
        .pub-scope-title{font-size:11px;font-weight:800;color:var(--mute);letter-spacing:1.5px;margin-bottom:14px}
        .pub-scope-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        .pub-scope-grid div{display:flex;flex-direction:column;gap:3px}
        .pub-scope-grid span{font-size:10px;font-weight:700;color:var(--mute);letter-spacing:1px}
        .pub-scope-grid strong{font-size:14px;font-weight:800;color:var(--navy)}
        .pub-addons{margin-top:14px;font-size:13px;color:var(--mute);padding-top:12px;border-top:1px solid var(--bord)}
        .pub-section-title{font-size:14px;font-weight:900;color:var(--navy);letter-spacing:2px;margin-bottom:6px}
        .pub-section-sub{font-size:14px;color:var(--mute);margin-bottom:24px;max-width:680px}
        .pub-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:34px}
        .pub-tier{background:#fff;border:3px solid var(--bord);border-radius:16px;padding:22px 22px 26px;display:flex;flex-direction:column;position:relative;transition:transform .15s,box-shadow .15s}
        .pub-tier:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.08)}
        .pub-tier.pop{transform:scale(1.025);box-shadow:0 8px 26px rgba(176,30,23,.12)}
        .pub-tier-pop{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--crimson);color:#fff;font-size:10px;font-weight:900;letter-spacing:1.5px;padding:5px 12px;border-radius:20px}
        .pub-tier-badge{display:inline-block;color:#fff;font-size:10px;font-weight:900;letter-spacing:1.5px;padding:5px 11px;border-radius:5px;margin-bottom:10px;align-self:flex-start}
        .pub-tier-name{font-size:24px;font-weight:900;color:var(--navy)}
        .pub-tier-tag{font-size:12px;color:var(--mute);font-style:italic;margin-bottom:14px}
        .pub-tier-price{font-size:38px;font-weight:900;line-height:1}
        .pub-tier-psf{font-size:11px;color:var(--mute);margin-bottom:14px}
        .pub-tier-mat-box{background:var(--cream);border-radius:9px;padding:11px 13px;margin-bottom:10px}
        .pub-tier-mat-lbl{font-size:9px;font-weight:800;color:var(--mute);letter-spacing:1.2px;margin-bottom:2px}
        .pub-tier-mat{font-size:12px;font-weight:700;color:var(--navy)}
        .pub-tier-brand{font-size:11px;color:var(--mute);margin-top:1px}
        .pub-tier-warr{font-size:12px;font-weight:800;margin-bottom:12px}
        .pub-tier-narrative{font-size:12px;color:var(--mute);line-height:1.55;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--bord)}
        .pub-tier-feats{list-style:none;margin-bottom:16px;flex:1}
        .pub-tier-feats li{font-size:12px;color:var(--mute);line-height:1.5;margin-bottom:5px;display:flex;gap:7px}
        .pub-tier-feats li span{font-weight:900;flex-shrink:0}
        .pub-tier-cta{color:#fff;border:none;border-radius:10px;padding:13px 18px;font-size:14px;font-weight:800;letter-spacing:.5px;cursor:pointer;font-family:inherit;transition:filter .15s}
        .pub-tier-cta:hover{filter:brightness(1.1)}
        .pub-terms{margin-top:24px;padding:18px 22px;background:#fff;border-radius:12px;border:1px solid var(--bord)}
        .pub-terms h3{font-size:13px;font-weight:800;color:var(--navy);margin-bottom:8px;letter-spacing:1px}
        .pub-terms p{font-size:11.5px;color:var(--mute);line-height:1.6}
        .pub-accepted{background:#fff;border:3px solid #10B981;border-radius:18px;padding:36px 28px;text-align:center;margin-bottom:34px}
        .pub-accepted-icon{width:64px;height:64px;border-radius:50%;background:#10B981;color:#fff;font-size:36px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
        .pub-accepted h2{font-size:24px;color:#065F46;font-weight:900;margin-bottom:8px}
        .pub-accepted p{color:var(--mute);max-width:520px;margin:0 auto 18px;font-size:14px}
        .pub-btn-outline{display:inline-block;color:var(--crimson);background:none;border:2px solid var(--crimson);border-radius:9px;padding:11px 22px;font-weight:800;text-decoration:none;font-size:13px}
        .pub-btn-outline:hover{background:var(--crimson);color:#fff}
        .pub-footer{background:var(--navy);color:#94a3b8;text-align:center;padding:20px 28px;font-size:11px;letter-spacing:.5px}
        .pub-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px}
        .pub-modal{background:#fff;border-radius:16px;padding:28px 30px;max-width:480px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.3)}
        .pub-modal h3{font-size:18px;font-weight:900;color:var(--navy);margin-bottom:14px}
        .pub-modal-sum{background:var(--cream);border-radius:10px;padding:13px 15px;margin-bottom:18px;font-size:14px}
        .pub-modal-sum span{font-size:12px;color:var(--mute)}
        .pub-sig-wrap{margin-bottom:18px}
        .pub-sig{width:100%;height:140px;border:2px solid var(--bord);border-radius:9px;background:#fff;cursor:crosshair;touch-action:none;display:block}
        .pub-sig-bar{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;color:var(--mute)}
        .pub-sig-bar button{background:none;border:none;color:var(--crimson);font-weight:700;cursor:pointer;font-size:11px}
        .pub-modal-btns{display:flex;gap:10px}
        .pub-modal-btns button{flex:1;padding:12px;border-radius:9px;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit}
        .pub-btn-primary{background:var(--crimson);color:#fff}
        .pub-btn-primary:disabled{background:#ccc;cursor:not-allowed}
        .pub-btn-back{background:transparent;color:var(--mute);border:1.5px solid var(--bord) !important}
        @media(max-width:780px){
          .pub-tiers{grid-template-columns:1fr}
          .pub-tier.pop{transform:none}
          .pub-scope-grid{grid-template-columns:repeat(2,1fr)}
          .pub-name{font-size:26px}
          .pub-hero{flex-direction:column;gap:14px;align-items:flex-start}
          .pub-hero-sub{text-align:left}
        }
      `}</style>
    </>
  )
}

function Center({ children }) {
  return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', color:'#4A5568' }}>{children}</div>
}
