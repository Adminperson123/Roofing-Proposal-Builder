/**
 * Presentation mode — /present/[id]
 *
 * Full-screen, swipeable slide deck for in-home presenting. The deck now
 * mirrors the ENTIRE web proposal (/p/[id]) section-for-section so the rep
 * walks the customer through exactly what the proposal and PDF contain:
 *
 *   Cover → A note from your rep → About → Families → Materials →
 *   Understanding your roof → Photos → Same workmanship (3 levels) →
 *   Essential / Performance / Signature → Optional upgrades → Benefits →
 *   Cost of doing nothing → Next steps → Experience → Guarantee →
 *   Licensed & insured → What's not included → Payment → Your rep → FAQ →
 *   Terms → Close
 *
 * All narrative copy comes from lib/content.js — the single source of truth
 * shared with the proposal page and the PDF. Edit the words there, once.
 * Navigate with the on-screen arrows, keyboard arrows/space, or touch swipe.
 */
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import {
  COMPANY, TIER_LABELS, TIER_COLORS, monthly,
  ABOUT, FAMILIES, TESTIMONIALS, MATERIALS_SECTION, MATERIALS, PARTNERS, SCOPE,
  QUALITY, BENEFITS_SECTION, BENEFITS, COST, PROCESS_SECTION, PROCESS_STEPS,
  EXPERIENCE, GUARANTEE, LICENSE_SECTION, LICENSE_BADGES, NOT_INCLUDED_SECTION, NOT_INCLUDED,
  REP, FAQ_SECTION, FAQS, TERMS, PAYMENT,
} from '../../lib/content'

const TIER_ORDER = ['good', 'better', 'best']

export default function Present() {
  const router = useRouter()
  const { id } = router.query
  const [p, setP]   = useState(null)
  const [changeOrders, setChangeOrders] = useState([])
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
    fetch('/api/change-orders').then(r => r.json()).then(d => setChangeOrders(d.changeOrders || [])).catch(() => {})
  }, [id])

  // Build the slide list once the proposal loads — mirrors the proposal order.
  const tiers = p?.tiers || {}
  const visibleTiers = Array.isArray(tiers._visible) && tiers._visible.length
    ? TIER_ORDER.filter(k => tiers._visible.includes(k))
    : TIER_ORDER
  const photos = Array.isArray(p?.photo_urls) ? p.photo_urls : []
  const slides = []
  if (p) {
    slides.push({ type: 'cover' })
    if (p.cover_letter) slides.push({ type: 'coverletter' })
    slides.push({ type: 'about' })
    slides.push({ type: 'families' })
    slides.push({ type: 'materials' })
    slides.push({ type: 'understand' })
    if (photos.length) slides.push({ type: 'photos' })
    slides.push({ type: 'quality' })
    for (const k of visibleTiers) if (tiers[k]) slides.push({ type: 'tier', k })
    if (changeOrders.length) slides.push({ type: 'upgrades' })
    slides.push({ type: 'benefits' })
    slides.push({ type: 'cost' })
    slides.push({ type: 'nextsteps' })
    slides.push({ type: 'experience' })
    slides.push({ type: 'guarantee' })
    slides.push({ type: 'license' })
    slides.push({ type: 'notincluded' })
    slides.push({ type: 'payment' })
    if (p.rep_name) slides.push({ type: 'rep' })
    slides.push({ type: 'faq' })
    slides.push({ type: 'terms' })
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

  // A new slide should always start scrolled to the top, not wherever the
  // previous (possibly tall) slide left the stage.
  const stageRef = useRef(null)
  useEffect(() => { if (stageRef.current) stageRef.current.scrollTop = 0 }, [i])

  if (err)  return <Center>{err}</Center>
  if (!p)   return <Center>Loading presentation…</Center>

  const slide = slides[i] || slides[0]
  const manyDots = slides.length > 12

  return (
    <>
      <Head><title>Presentation — {p.customer_name}</title></Head>
      <div
        className="pr-stage"
        ref={stageRef}
        onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => {
          if (touch.current == null) return
          const dx = e.changedTouches[0].clientX - touch.current.x
          const dy = e.changedTouches[0].clientY - touch.current.y
          // Only treat it as a slide swipe when it's clearly horizontal — a
          // mostly-vertical drag is the user scrolling a tall slide.
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
          touch.current = null
        }}
      >
        <div className="pr-slide">{renderSlide(slide, p, tiers, changeOrders, photos)}</div>

        {/* nav */}
        {i > 0 && <button className="pr-nav pr-prev" onClick={() => go(-1)}>‹</button>}
        {i < slides.length - 1 && <button className="pr-nav pr-next" onClick={() => go(1)}>›</button>}

        {/* progress — dots for short decks, a counter pill once there are many */}
        {manyDots ? (
          <div className="pr-counter">{i + 1} / {slides.length}</div>
        ) : (
          <div className="pr-dots">
            {slides.map((_, idx) => (
              <button key={idx} className={`pr-dot ${idx === i ? 'on' : ''}`} onClick={() => setI(idx)} />
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#__next{height:100%}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif}
        /* Stage scrolls vertically — content-heavy slides exceed a phone's usable
           height, so clipping (overflow:hidden) is not acceptable. */
        .pr-stage{min-height:100vh;background:#0C1C38;position:relative;overflow-y:auto;overflow-x:hidden;user-select:none}
        /* min-height (not height) lets a tall slide grow past the viewport so the
           stage scrolls; short slides stay 100vh and stay vertically centered.
           padding-bottom clears the fixed bottom control bar (dots + arrows). */
        .pr-slide{min-height:100vh;max-width:880px;margin:0 auto;padding:54px 44px 100px;display:flex;flex-direction:column;justify-content:center;text-align:center;color:#fff}
        .pr-logo{height:78px;width:auto;background:#fff;border-radius:14px;padding:8px;margin:0 auto 28px}
        .pr-eyebrow{font-size:12px;font-weight:900;color:#D4960E;letter-spacing:2.6px;margin-bottom:10px}
        .pr-title{font-size:32px;font-weight:900;line-height:1.15;margin-bottom:8px}
        .pr-lede{font-size:15px;color:rgba(255,255,255,.72);line-height:1.6;max-width:620px;margin:0 auto 22px}
        /* cover */
        .pr-cover-name{font-size:46px;font-weight:900;line-height:1.1;margin-bottom:10px}
        .pr-cover-addr{font-size:17px;color:rgba(255,255,255,.65)}
        .pr-cover-meta{font-size:14px;color:rgba(255,255,255,.45);margin-top:18px}
        /* generic card grids */
        .pr-grid{display:grid;gap:12px;margin-top:6px}
        .pr-g2{grid-template-columns:1fr 1fr}
        .pr-g3{grid-template-columns:repeat(3,1fr)}
        .pr-g4{grid-template-columns:repeat(4,1fr)}
        .pr-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:13px;padding:16px 18px;text-align:left}
        .pr-card-ic{font-size:26px;margin-bottom:7px}
        .pr-card-t{font-size:14.5px;font-weight:900;color:#fff;margin-bottom:4px}
        .pr-card-b{font-size:12.5px;color:rgba(255,255,255,.7);line-height:1.5}
        .pr-card-warr{font-size:11px;font-weight:800;color:#D4960E;margin-top:8px;letter-spacing:.4px}
        /* stats */
        .pr-stat{background:rgba(255,255,255,.06);border-radius:12px;padding:16px;text-align:center}
        .pr-stat-n{font-size:26px;font-weight:900;color:#D4960E}
        .pr-stat-l{font-size:11px;font-weight:700;color:rgba(255,255,255,.6);letter-spacing:.5px;margin-top:4px}
        /* testimonials */
        .pr-testi-stars{color:#D4960E;font-size:13px;letter-spacing:2px;margin-bottom:7px}
        .pr-testi-text{font-size:12.5px;font-style:italic;color:rgba(255,255,255,.85);line-height:1.55;flex:1}
        .pr-testi-name{font-size:11.5px;color:rgba(255,255,255,.6);margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.12)}
        .pr-testi-name strong{color:#fff}
        /* understand-your-roof */
        .pr-scope-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:8px}
        .pr-scope-grid div{background:rgba(255,255,255,.06);border-radius:12px;padding:16px 10px}
        .pr-scope-grid span{display:block;font-size:10px;font-weight:800;color:rgba(255,255,255,.5);letter-spacing:1px;margin-bottom:5px}
        .pr-scope-grid strong{font-size:17px;font-weight:900;color:#fff}
        .pr-addons{margin-top:14px;font-size:13px;color:rgba(255,255,255,.7)}
        .pr-addons strong{color:#fff}
        /* photos */
        .pr-photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
        .pr-photo-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:11px;display:block}
        /* numbered process steps */
        .pr-steps{display:flex;flex-direction:column;gap:9px;margin-top:6px}
        .pr-step{display:flex;align-items:center;gap:13px;background:rgba(255,255,255,.06);border-radius:11px;padding:12px 15px;text-align:left}
        .pr-step-n{width:28px;height:28px;border-radius:50%;background:#B01E17;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .pr-step-t{font-size:14px;font-weight:900;color:#fff}
        .pr-step-b{font-size:12px;color:rgba(255,255,255,.65);margin-top:1px}
        /* tier slide */
        .pr-tier-badge{display:inline-block;color:#fff;font-size:13px;font-weight:900;letter-spacing:2px;padding:7px 16px;border-radius:7px;margin-bottom:14px;align-self:center}
        .pr-tier-name{font-size:42px;font-weight:900}
        .pr-tier-tag{font-size:15px;color:rgba(255,255,255,.6);font-style:italic;margin-bottom:14px}
        .pr-tier-price{font-size:58px;font-weight:900;line-height:1}
        .pr-tier-psf{font-size:13px;color:rgba(255,255,255,.5);margin-top:6px}
        .pr-tier-fin{font-size:13px;color:rgba(255,255,255,.75);margin-top:8px}
        .pr-tier-fin strong{color:#D4960E;font-weight:900}
        .pr-tier-warr{font-size:15px;font-weight:800;margin-top:12px}
        .pr-tier-mat{font-size:13px;color:rgba(255,255,255,.6);margin-top:5px}
        .pr-tier-narr{font-size:13px;color:rgba(255,255,255,.6);line-height:1.55;max-width:560px;margin:14px auto 0}
        .pr-feats{list-style:none;margin-top:18px;display:inline-block;text-align:left}
        .pr-feats li{font-size:14px;color:rgba(255,255,255,.85);line-height:1.5;margin-bottom:8px}
        .pr-feats li span{font-weight:900;margin-right:8px}
        /* optional upgrades */
        .pr-up-list{display:flex;flex-direction:column;gap:9px;margin-top:6px}
        .pr-up{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:13px 16px;text-align:left}
        .pr-up-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .pr-up-label{font-size:14px;font-weight:800;color:#fff}
        .pr-up-desc{font-size:12px;color:rgba(255,255,255,.6);line-height:1.45}
        .pr-up-price{font-size:15px;font-weight:900;color:#D4960E;flex-shrink:0;white-space:nowrap}
        /* cost of doing nothing */
        .pr-cost-card{background:rgba(176,30,23,.16);border:1px solid rgba(176,30,23,.5);border-radius:12px;padding:15px 16px;text-align:left}
        .pr-cost-year{font-size:11px;font-weight:900;color:#FCA5A5;letter-spacing:1px;margin-bottom:6px}
        .pr-cost-b{font-size:12.5px;color:rgba(255,255,255,.82);line-height:1.5}
        .pr-cost-cta{margin-top:16px;background:#B01E17;border-radius:11px;padding:13px 18px;font-size:14px;font-weight:700}
        .pr-cost-cta strong{color:#FDE68A}
        /* experience */
        .pr-exp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:6px}
        .pr-exp-promise{margin-top:18px;font-size:15px;font-style:italic;font-weight:800;color:#D4960E}
        /* guarantee seal */
        .pr-seal{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,#D4960E,#A8730B);color:#fff;font-size:24px;font-weight:900;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 0 0 4px #D4960E;margin:0 auto 22px}
        /* not-included */
        .pr-not{display:flex;gap:10px;align-items:flex-start;background:rgba(255,255,255,.06);border-radius:11px;padding:13px 15px;text-align:left;font-size:12.5px;color:rgba(255,255,255,.82);line-height:1.5}
        .pr-not span{color:#FCA5A5;font-weight:900;font-size:15px;flex-shrink:0;line-height:1.2}
        /* payment */
        .pr-pay-amt{font-size:24px;font-weight:900;color:#fff;margin:4px 0 6px}
        /* rep */
        .pr-rep-avatar{width:84px;height:84px;border-radius:50%;background:linear-gradient(135deg,#B01E17,#7c1410);color:#fff;font-size:34px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
        .pr-rep-cta{display:flex;gap:10px;justify-content:center;margin-top:18px}
        .pr-rep-btn{background:#D4960E;color:#0C1C38;font-weight:900;font-size:15px;padding:13px 24px;border-radius:11px;text-decoration:none}
        .pr-rep-btn.outline{background:transparent;color:#D4960E;border:2px solid #D4960E}
        /* faq */
        .pr-faq-list{display:flex;flex-direction:column;gap:9px;margin-top:6px}
        .pr-faq{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:13px 16px;text-align:left}
        .pr-faq-q{font-size:14px;font-weight:900;color:#fff;margin-bottom:5px}
        .pr-faq-a{font-size:12.5px;color:rgba(255,255,255,.7);line-height:1.55}
        /* terms */
        .pr-terms{font-size:13px;color:rgba(255,255,255,.6);line-height:1.7;max-width:660px;margin:0 auto}
        /* close */
        .pr-close-mark{width:88px;height:88px;border-radius:50%;background:#10B981;color:#fff;font-size:48px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 22px}
        .pr-close-cta{display:inline-block;background:#D4960E;color:#0C1C38;font-weight:900;font-size:16px;padding:15px 28px;border-radius:11px;text-decoration:none;margin-top:8px}
        /* nav */
        .pr-nav{position:fixed;top:50%;transform:translateY(-50%);width:56px;height:56px;border-radius:50%;border:none;background:rgba(255,255,255,.12);color:#fff;font-size:30px;cursor:pointer;line-height:1;z-index:5}
        .pr-nav:hover{background:rgba(255,255,255,.25)}
        .pr-prev{left:20px}
        .pr-next{right:20px}
        /* Dots sit in a pinned pill so they stay legible over scrolled content. */
        .pr-dots{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:5px;flex-wrap:nowrap;justify-content:center;background:rgba(12,28,56,.92);padding:9px 13px;border-radius:22px;border:1px solid rgba(255,255,255,.12);z-index:6}
        .pr-dot{width:6px;height:6px;border-radius:50%;border:none;background:rgba(255,255,255,.3);cursor:pointer;padding:0}
        .pr-dot.on{background:#D4960E}
        /* Counter pill for long decks — scales to any slide count. */
        .pr-counter{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(12,28,56,.92);color:rgba(255,255,255,.85);font-size:13px;font-weight:800;letter-spacing:.5px;padding:9px 18px;border-radius:22px;border:1px solid rgba(255,255,255,.12);z-index:6}
        @media(max-width:680px){
          .pr-slide{padding:34px 18px 96px}
          .pr-title{font-size:25px}
          .pr-cover-name{font-size:32px}
          .pr-tier-name{font-size:31px}
          .pr-tier-price{font-size:44px}
          .pr-g3,.pr-g4,.pr-scope-grid,.pr-exp-grid,.pr-photo-grid{grid-template-columns:1fr 1fr}
          /* On a phone the side arrows would cover content — move them into the
             bottom control bar, flanking the dots/counter. */
          .pr-nav{width:42px;height:42px;font-size:23px;top:auto;bottom:13px;transform:none}
          .pr-prev{left:14px}
          .pr-next{right:14px}
          .pr-dots{bottom:18px;max-width:48vw}
          .pr-counter{bottom:20px}
        }
      `}</style>
    </>
  )
}

function renderSlide(slide, p, tiers, changeOrders, photos) {
  const financingOn = p.financing_enabled !== false
  switch (slide.type) {
    case 'cover':
      return (
        <>
          <img src="/logo.png" alt="Good People Roofing" className="pr-logo" />
          <div className="pr-eyebrow">ROOFING PROPOSAL PREPARED FOR</div>
          <h1 className="pr-cover-name">{p.customer_name}</h1>
          <div className="pr-cover-addr">{p.customer_address}</div>
          <div className="pr-cover-meta">Proposal #{p.prop_num} · {p.squares} squares · {p.roof_type === 'tile' ? 'Tile' : 'Architectural Shingle'}</div>
        </>
      )

    case 'coverletter':
      return (
        <>
          <div className="pr-eyebrow">A NOTE FROM YOUR REP</div>
          <p className="pr-lede" style={{ fontStyle: 'italic', fontSize: 18, color: 'rgba(255,255,255,.9)', maxWidth: 680 }}>{p.cover_letter}</p>
          {p.rep_name && <div className="pr-cover-meta">— {p.rep_name}, {COMPANY.name}</div>}
        </>
      )

    case 'about':
      return (
        <>
          <div className="pr-eyebrow">{ABOUT.eyebrow}</div>
          <h1 className="pr-title">{ABOUT.title}</h1>
          <p className="pr-lede">{ABOUT.body}</p>
          <div className="pr-grid pr-g4">
            {ABOUT.stats.map((st, idx) => (
              <div key={idx} className="pr-stat"><div className="pr-stat-n">{st.n}</div><div className="pr-stat-l">{st.l}</div></div>
            ))}
          </div>
        </>
      )

    case 'families':
      return (
        <>
          <div className="pr-eyebrow">{FAMILIES.eyebrow}</div>
          <h1 className="pr-title">{FAMILIES.title}</h1>
          <div className="pr-grid pr-g3" style={{ marginTop: 18 }}>
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="pr-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="pr-testi-stars">{'★'.repeat(t.stars)}</div>
                <div className="pr-testi-text">“{t.text}”</div>
                <div className="pr-testi-name"><strong>{t.name}</strong> · {t.city}</div>
              </div>
            ))}
          </div>
        </>
      )

    case 'materials':
      return (
        <>
          <div className="pr-eyebrow">{MATERIALS_SECTION.eyebrow}</div>
          <h1 className="pr-title">{MATERIALS_SECTION.title}</h1>
          <div className="pr-grid pr-g3" style={{ marginTop: 14 }}>
            {MATERIALS.map((m, idx) => (
              <div key={idx} className="pr-card">
                <div className="pr-card-t">{m.name}</div>
                <div className="pr-card-b">{m.tag}</div>
                <div className="pr-card-warr">🛡 {m.warr}</div>
              </div>
            ))}
          </div>
          <div className="pr-eyebrow" style={{ marginTop: 22 }}>DISTRIBUTOR PARTNERSHIPS</div>
          <div className="pr-grid pr-g2" style={{ marginTop: 8 }}>
            {PARTNERS.map((pt, idx) => (
              <div key={idx} className="pr-card"><div className="pr-card-t">{pt.name}</div><div className="pr-card-b">{pt.tag}</div></div>
            ))}
          </div>
        </>
      )

    case 'understand': {
      const steep = p.pitch >= 7 ? ' (steep)' : ''
      return (
        <>
          <div className="pr-eyebrow">{SCOPE.eyebrow}</div>
          <h1 className="pr-title">{SCOPE.title}</h1>
          <p className="pr-lede">{SCOPE.sub}</p>
          <div className="pr-scope-grid">
            <div><span>ROOF TYPE</span><strong>{p.roof_type === 'tile' ? `Tile${p.tile_subtype ? ' · ' + p.tile_subtype : ''}` : 'Shingle'}</strong></div>
            <div><span>SQUARES</span><strong>{p.squares} sq (~{(p.squares * 100).toLocaleString()} sqft)</strong></div>
            <div><span>PITCH</span><strong>{p.pitch}/12{steep}</strong></div>
            <div><span>STORIES</span><strong>{p.stories}</strong></div>
          </div>
          {Array.isArray(p.addons) && p.addons.length > 0 && (
            <div className="pr-addons">Add-ons: <strong>{p.addons.join(' · ')}</strong></div>
          )}
        </>
      )
    }

    case 'photos':
      return (
        <>
          <div className="pr-eyebrow">PHOTOS FROM YOUR INSPECTION</div>
          <h1 className="pr-title">A look at your roof today</h1>
          <div className="pr-photo-grid">
            {photos.map((ph, idx) => (
              <img key={idx} src={ph.url} alt={ph.name || `Photo ${idx + 1}`} loading="lazy" />
            ))}
          </div>
        </>
      )

    case 'quality':
      return (
        <>
          <div className="pr-eyebrow">{QUALITY.eyebrow}</div>
          <h1 className="pr-title">{QUALITY.title}</h1>
          <p className="pr-lede">{QUALITY.body}</p>
          <div className="pr-grid pr-g3">
            {QUALITY.pillars.map((q, idx) => (
              <div key={idx} className="pr-card"><div className="pr-card-t">{q.t}</div><div className="pr-card-b">{q.b}</div></div>
            ))}
          </div>
        </>
      )

    case 'tier': {
      const t = tiers[slide.k] || {}
      const c = TIER_COLORS[slide.k]
      return (
        <>
          <div className="pr-tier-badge" style={{ background: c }}>{TIER_LABELS[slide.k]}</div>
          <h1 className="pr-tier-name">{t.name}</h1>
          <div className="pr-tier-tag">{t.tagline}</div>
          <div className="pr-tier-price" style={{ color: c }}>${(t.price || 0).toLocaleString()}</div>
          {t.psf != null && <div className="pr-tier-psf">${t.psf}/sq · {p.squares} squares</div>}
          {financingOn && <div className="pr-tier-fin">or about <strong>${monthly(t.price || 0).toLocaleString()}/mo</strong> with financing</div>}
          {t.warranty && <div className="pr-tier-warr" style={{ color: c }}>🛡 {t.warranty}</div>}
          {t.material && <div className="pr-tier-mat">{t.material}{t.brand ? ` · ${t.brand}` : ''}</div>}
          {t.narrative && <p className="pr-tier-narr">{t.narrative}</p>}
          <ul className="pr-feats">
            {(t.features || []).slice(0, 8).map((f, idx) => (
              <li key={idx}><span style={{ color: c }}>✓</span>{f}</li>
            ))}
          </ul>
        </>
      )
    }

    case 'upgrades':
      return (
        <>
          <div className="pr-eyebrow">OPTIONAL UPGRADES</div>
          <h1 className="pr-title">Ways to get even more from your roof</h1>
          <p className="pr-lede">Add any of these when you sign — no pressure, pick only what you want.</p>
          <div className="pr-up-list">
            {changeOrders.map((co, idx) => (
              <div key={idx} className="pr-up">
                <span className="pr-up-body">
                  <span className="pr-up-label">{co.label}</span>
                  {co.description && <span className="pr-up-desc">{co.description}</span>}
                </span>
                <span className="pr-up-price">+${(Number(co.price) || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )

    case 'benefits':
      return (
        <>
          <div className="pr-eyebrow">{BENEFITS_SECTION.eyebrow}</div>
          <h1 className="pr-title">{BENEFITS_SECTION.title}</h1>
          <div className="pr-grid pr-g3" style={{ marginTop: 14 }}>
            {BENEFITS.map((b, idx) => (
              <div key={idx} className="pr-card">
                <div className="pr-card-ic">{b.icon}</div>
                <div className="pr-card-t">{b.t}</div>
                <div className="pr-card-b">{b.b}</div>
              </div>
            ))}
          </div>
        </>
      )

    case 'cost':
      return (
        <>
          <div className="pr-eyebrow" style={{ color: '#FCA5A5' }}>{COST.eyebrow}</div>
          <h1 className="pr-title">{COST.title}</h1>
          <p className="pr-lede">{COST.subShort}</p>
          <div className="pr-grid pr-g3">
            {COST.steps.map((cst, idx) => (
              <div key={idx} className="pr-cost-card"><div className="pr-cost-year">{cst.year}</div><div className="pr-cost-b">{cst.b}</div></div>
            ))}
          </div>
          <div className="pr-cost-cta">{COST.cta}</div>
        </>
      )

    case 'nextsteps':
      return (
        <>
          <div className="pr-eyebrow">{PROCESS_SECTION.eyebrow}</div>
          <h1 className="pr-title">{PROCESS_SECTION.title}</h1>
          <div className="pr-steps">
            {PROCESS_STEPS.map((st, idx) => (
              <div key={idx} className="pr-step">
                <div className="pr-step-n">{idx + 1}</div>
                <div><div className="pr-step-t">{st.icon} {st.title}</div><div className="pr-step-b">{st.body}</div></div>
              </div>
            ))}
          </div>
        </>
      )

    case 'experience':
      return (
        <>
          <div className="pr-eyebrow">{EXPERIENCE.eyebrow}</div>
          <h1 className="pr-title">{EXPERIENCE.title}</h1>
          <p className="pr-lede">{EXPERIENCE.intro}</p>
          <div className="pr-exp-grid">
            {EXPERIENCE.options.map((o, idx) => (
              <div key={idx} className="pr-card">
                <div className="pr-card-ic">{o.icon}</div>
                <div className="pr-card-t">{o.t}</div>
                <div className="pr-card-b">{o.b}</div>
              </div>
            ))}
          </div>
          <div className="pr-exp-promise">{EXPERIENCE.promise}</div>
        </>
      )

    case 'guarantee':
      return (
        <>
          <div className="pr-seal">{GUARANTEE.seal}</div>
          <div className="pr-eyebrow">{GUARANTEE.eyebrow}</div>
          <h1 className="pr-title">{GUARANTEE.title}</h1>
          <p className="pr-lede">{GUARANTEE.body}</p>
        </>
      )

    case 'license':
      return (
        <>
          <div className="pr-eyebrow">{LICENSE_SECTION.eyebrow}</div>
          <h1 className="pr-title">Protected from the first nail to the last sweep</h1>
          <div className="pr-grid pr-g2">
            {LICENSE_BADGES.map((b, idx) => (
              <div key={idx} className="pr-card"><div className="pr-card-t">{b.title}</div><div className="pr-card-b">{b.sub}</div></div>
            ))}
          </div>
        </>
      )

    case 'notincluded':
      return (
        <>
          <div className="pr-eyebrow">{NOT_INCLUDED_SECTION.eyebrow}</div>
          <h1 className="pr-title">What this proposal does not cover</h1>
          <p className="pr-lede">{NOT_INCLUDED_SECTION.sub}</p>
          <div className="pr-grid pr-g2">
            {NOT_INCLUDED.map((line, idx) => (
              <div key={idx} className="pr-not"><span>×</span>{line}</div>
            ))}
          </div>
        </>
      )

    case 'payment':
      return (
        <>
          <div className="pr-eyebrow">{PAYMENT.eyebrow}</div>
          <h1 className="pr-title">Three simple milestones</h1>
          <p className="pr-lede">{PAYMENT.sub} Numbers scale to whichever package you select.</p>
          <div className="pr-grid pr-g3">
            {PAYMENT.milestones.map((m, idx) => (
              <div key={idx} className="pr-card" style={{ textAlign: 'center' }}>
                <div className="pr-card-t" style={{ color: '#D4960E', fontSize: 11, letterSpacing: 1 }}>{m.step}</div>
                <div className="pr-pay-amt">{m.fallback}</div>
                <div className="pr-card-b" style={{ textAlign: 'center' }}>{m.when}</div>
              </div>
            ))}
          </div>
        </>
      )

    case 'rep':
      return (
        <>
          <div className="pr-eyebrow">{REP.eyebrow}</div>
          <div className="pr-rep-avatar">{(p.rep_name || 'G').trim().charAt(0).toUpperCase()}</div>
          <h1 className="pr-tier-name" style={{ fontSize: 34 }}>{p.rep_name}</h1>
          <div className="pr-tier-tag">{COMPANY.name}</div>
          <div className="pr-rep-cta">
            <a className="pr-rep-btn" href={`tel:${COMPANY.phoneTel}`}>📞 Call</a>
            <a className="pr-rep-btn outline" href={`sms:${COMPANY.phoneTel}`}>💬 Text</a>
          </div>
        </>
      )

    case 'faq':
      return (
        <>
          <div className="pr-eyebrow">{FAQ_SECTION.eyebrow}</div>
          <h1 className="pr-title">Frequently asked questions</h1>
          <div className="pr-faq-list">
            {FAQS.map((f, idx) => (
              <div key={idx} className="pr-faq">
                <div className="pr-faq-q">{f.q}</div>
                <div className="pr-faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </>
      )

    case 'terms':
      return (
        <>
          <div className="pr-eyebrow">THE FINE PRINT</div>
          <h1 className="pr-title">{TERMS.title}</h1>
          <p className="pr-terms">{TERMS.body}</p>
        </>
      )

    case 'close':
      return (
        <>
          <div className="pr-close-mark">✓</div>
          <h1 className="pr-title">Ready to protect your home?</h1>
          <p className="pr-lede">Pick the package that fits — we'll handle the rest. Licensed, insured, and local. {COMPANY.license}.</p>
          <a className="pr-close-cta" href={`/p/${p.id}`} target="_blank" rel="noreferrer">Open the signable proposal →</a>
        </>
      )

    default:
      return null
  }
}

function Center({ children }) {
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0C1C38',color:'rgba(255,255,255,.7)',fontFamily:'system-ui',padding:'24px',textAlign:'center'}}>{children}</div>
}
