/**
 * Presentation mode — /present/[id]
 *
 * Turns a proposal into a full-screen, swipeable slide deck so a rep can
 * present in-home: Cover → Good → Better → Best → Close. Navigate with the
 * on-screen arrows, keyboard arrows, or touch swipe. Dots show progress.
 */
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

const TIERS = ['good', 'better', 'best']
const TIER_COLOR = { good: '#4A5568', better: '#B01E17', best: '#D4960E' }

export default function Present() {
  const router = useRouter()
  const { id } = router.query
  const [p, setP]   = useState(null)
  const [err, setErr] = useState('')
  const [i, setI]   = useState(0)
  const touch = useRef(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/proposal/${id}`)
      .then(async r => {
        if (!r.ok) { setErr('Proposal not found.'); return }
        setP(await r.json())
      })
      .catch(e => setErr(e.message))
  }, [id])

  // Build the slide list once the proposal loads.
  const tiers = p?.tiers || {}
  const slides = []
  if (p) {
    slides.push({ type: 'cover' })
    for (const k of TIERS) if (tiers[k]) slides.push({ type: 'tier', k })
    slides.push({ type: 'close' })
  }

  const go = (d) => setI(v => Math.max(0, Math.min(slides.length - 1, v + d)))

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

  if (err)  return <Center>{err}</Center>
  if (!p)   return <Center>Loading presentation…</Center>

  const slide = slides[i] || slides[0]

  return (
    <>
      <Head><title>Presentation — {p.customer_name}</title></Head>
      <div
        className="pr-stage"
        onTouchStart={e => { touch.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
          touch.current = null
        }}
      >
        {slide.type === 'cover' && (
          <div className="pr-slide pr-cover">
            <img src="/logo.png" alt="Good People Roofing" className="pr-logo" />
            <div className="pr-eyebrow">ROOFING PROPOSAL PREPARED FOR</div>
            <h1 className="pr-cover-name">{p.customer_name}</h1>
            <div className="pr-cover-addr">{p.customer_address}</div>
            <div className="pr-cover-meta">Proposal #{p.prop_num} · {p.squares} squares · {p.roof_type === 'tile' ? 'Tile' : 'Architectural Shingle'}</div>
          </div>
        )}

        {slide.type === 'tier' && (() => {
          const t = tiers[slide.k]; const c = TIER_COLOR[slide.k]
          return (
            <div className="pr-slide">
              <div className="pr-tier-badge" style={{ background: c }}>{(t.name || slide.k).toUpperCase()}</div>
              <h1 className="pr-tier-name">{t.name}</h1>
              <div className="pr-tier-tag">{t.tagline}</div>
              <div className="pr-tier-price" style={{ color: c }}>${(t.price || 0).toLocaleString()}</div>
              {t.warranty && <div className="pr-tier-warr" style={{ color: c }}>🛡 {t.warranty}</div>}
              {t.material && <div className="pr-tier-mat">{t.material}{t.brand ? ` · ${t.brand}` : ''}</div>}
              <ul className="pr-feats">
                {(t.features || []).slice(0, 8).map((f, idx) => (
                  <li key={idx}><span style={{ color: c }}>✓</span> {f}</li>
                ))}
              </ul>
            </div>
          )
        })()}

        {slide.type === 'close' && (
          <div className="pr-slide pr-close">
            <div className="pr-close-mark">✓</div>
            <h1 className="pr-close-title">Ready to protect your home?</h1>
            <p className="pr-close-sub">Pick the package that fits — we'll handle the rest. Licensed, insured, and local. CA Lic. C39 #1126880.</p>
            <a className="pr-close-cta" href={`/p/${p.id}`} target="_blank" rel="noreferrer">Open the signable proposal →</a>
          </div>
        )}

        {/* nav */}
        {i > 0 && <button className="pr-nav pr-prev" onClick={() => go(-1)}>‹</button>}
        {i < slides.length - 1 && <button className="pr-nav pr-next" onClick={() => go(1)}>›</button>}
        <div className="pr-dots">
          {slides.map((_, idx) => (
            <button key={idx} className={`pr-dot ${idx === i ? 'on' : ''}`} onClick={() => setI(idx)} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#__next{height:100%}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
        .pr-stage{height:100vh;background:#0C1C38;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;user-select:none}
        .pr-slide{max-width:760px;width:100%;padding:48px 40px;text-align:center;color:#fff}
        .pr-logo{height:80px;width:auto;background:#fff;border-radius:14px;padding:8px;margin-bottom:30px}
        .pr-eyebrow{font-size:13px;font-weight:800;color:#D4960E;letter-spacing:2.5px;margin-bottom:12px}
        .pr-cover-name{font-size:48px;font-weight:900;line-height:1.1;margin-bottom:10px}
        .pr-cover-addr{font-size:17px;color:rgba(255,255,255,.65)}
        .pr-cover-meta{font-size:14px;color:rgba(255,255,255,.45);margin-top:18px}
        .pr-tier-badge{display:inline-block;color:#fff;font-size:13px;font-weight:900;letter-spacing:2px;padding:7px 16px;border-radius:7px;margin-bottom:16px}
        .pr-tier-name{font-size:44px;font-weight:900}
        .pr-tier-tag{font-size:16px;color:rgba(255,255,255,.6);font-style:italic;margin-bottom:18px}
        .pr-tier-price{font-size:64px;font-weight:900;line-height:1}
        .pr-tier-warr{font-size:16px;font-weight:800;margin-top:10px}
        .pr-tier-mat{font-size:14px;color:rgba(255,255,255,.6);margin-top:6px}
        .pr-feats{list-style:none;margin-top:24px;display:inline-block;text-align:left}
        .pr-feats li{font-size:15px;color:rgba(255,255,255,.85);line-height:1.5;margin-bottom:9px}
        .pr-feats li span{font-weight:900;margin-right:8px}
        .pr-close-mark{width:90px;height:90px;border-radius:50%;background:#10B981;color:#fff;font-size:50px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
        .pr-close-title{font-size:40px;font-weight:900}
        .pr-close-sub{font-size:16px;color:rgba(255,255,255,.65);max-width:480px;margin:14px auto 28px;line-height:1.6}
        .pr-close-cta{display:inline-block;background:#D4960E;color:#0C1C38;font-weight:900;font-size:16px;padding:15px 28px;border-radius:11px;text-decoration:none}
        .pr-nav{position:fixed;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:50%;border:none;background:rgba(255,255,255,.12);color:#fff;font-size:30px;cursor:pointer;line-height:1}
        .pr-nav:hover{background:rgba(255,255,255,.25)}
        .pr-prev{left:20px}
        .pr-next{right:20px}
        .pr-dots{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:9px}
        .pr-dot{width:10px;height:10px;border-radius:50%;border:none;background:rgba(255,255,255,.25);cursor:pointer;padding:0}
        .pr-dot.on{background:#D4960E}
        @media(max-width:600px){
          .pr-cover-name{font-size:34px}.pr-tier-name{font-size:32px}.pr-tier-price{font-size:46px}
          .pr-close-title{font-size:30px}.pr-slide{padding:32px 22px}
        }
      `}</style>
    </>
  )
}

function Center({ children }) {
  return <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0C1C38',color:'rgba(255,255,255,.7)',fontFamily:'system-ui'}}>{children}</div>
}
