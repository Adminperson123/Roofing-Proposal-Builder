/**
 * Presentation mode — /present/[id]
 *
 * Full-screen, swipeable slide deck for in-home presenting. The deck follows
 * the Good People Roofing proposal framework, top-to-bottom:
 *
 *   Cover → About us → Families we've helped → Materials & partnerships →
 *   Understanding your roof → Same workmanship / 3 quality levels →
 *   Essential → Performance → Signature → Benefits of a new roof →
 *   Cost of doing nothing → Next steps → It's an experience → Close
 *
 * This mirrors the section order of the web proposal (/p/[id]) and the PDF so
 * all three formats present the same story. Navigate with the on-screen
 * arrows, keyboard arrows/space, or touch swipe. Dots show progress.
 */
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

const TIERS = ['good', 'better', 'best']
const TIER_COLOR = { good: '#4A5568', better: '#B01E17', best: '#D4960E' }
const TIER_LABEL = { good: 'ESSENTIAL', better: 'PERFORMANCE', best: 'SIGNATURE' }

const ABOUT_STATS = [
  { n: '1,200+', l: 'Roofs installed' },
  { n: '4.9★', l: 'Average review' },
  { n: '10+',    l: 'Years serving SoCal' },
  { n: '100%',   l: 'Cleanup guarantee' },
]
const TESTIMONIALS = [
  { name: 'Maria S.',   city: 'Yucaipa, CA',    text: 'Crew showed up on time, treated my home like their own, and finished a full tear-off in two days.' },
  { name: 'Daniel R.',  city: 'Redlands, CA',   text: 'Honest pricing, no surprises, and they walked me through every option. Easiest contractor experience ever.' },
  { name: 'Carolyn P.', city: 'San Bernardino', text: 'Wind storm took out half my ridge. They had a crew here within a week and the workmanship was flawless.' },
]
const MATERIALS = [
  { name: 'GAF',            tag: 'Timberline HDZ / UHDZ shingles' },
  { name: 'Owens Corning',  tag: 'Duration / Duration COOL series' },
  { name: 'Westlake Royal', tag: 'Concrete & clay tile' },
  { name: 'Eagle Roofing',  tag: 'Concrete tile — flat & S-type' },
  { name: 'Titanium',       tag: 'Synthetic underlayments' },
  { name: 'Boral',          tag: 'Specialty tile & accessories' },
]
const PARTNERS = [
  { name: 'QXO',              tag: 'National roofing distributor — preferred pricing & faster delivery.' },
  { name: 'SRS Distribution', tag: 'Largest US roofing distributor — full inventory & warranty support.' },
]
const QUALITY_PILLARS = [
  { t: 'Same crew, every tier', b: 'Installed by our W-2 employees — never day-laborers.' },
  { t: 'Same standards',        b: 'Same safety practices, same flashing details, same final sweep.' },
  { t: 'Different materials',   b: 'Shingle composition, tile weight, granule mix, warranty class.' },
]
const BENEFITS = [
  { icon: '🛡', t: 'Protection for decades',  b: 'No more worry about leaks or ceiling stains — 30-year to lifetime warranties.' },
  { icon: '💰', t: 'Higher resale value',     b: 'A recent roof is a top-three improvement that moves appraisal numbers.' },
  { icon: '⚡', t: 'Lower energy bills',            b: 'Cool-rated shingles drop attic temps up to 20°F and trim summer A/C costs.' },
  { icon: '📋', t: 'Insurance peace of mind', b: 'Many SoCal insurers require a roof under 20 years old to keep coverage.' },
  { icon: '🏡', t: 'Curb appeal',             b: 'Modern color palettes update the whole look of the home from the street.' },
  { icon: '🌬', t: 'Wind & storm rated',      b: 'Installs rated up to 130 mph wind with ridge vents and drip-edge upgrades.' },
]
const PROCESS_STEPS = [
  { icon: '✍️', t: 'Sign your proposal',         b: 'Pick a tier, sign, and your project is officially scheduled.' },
  { icon: '📅', t: 'Pre-install walkthrough',    b: 'Your rep confirms colors, pulls permits, and locks the install date.' },
  { icon: '🚚', t: 'Materials delivered',        b: 'Manufacturer-fresh materials delivered 1–2 days before install.' },
  { icon: '🔨', t: 'Tear-off & install',         b: 'Old layers off, decking inspected, new system on — most homes in 1–2 days.' },
  { icon: '✅', t: 'Final inspection & cleanup',       b: 'Magnetic sweep, daily cleanup, and a final walkthrough so you sign off happy.' },
]
const COST_STEPS = [
  { year: 'YEAR 1 OF WAITING',  b: 'Small leaks find weak shingles after the first big storm. You replace a ceiling tile and a section of drywall — $400 to $900 in interior repair.' },
  { year: 'YEAR 2 OF WAITING',  b: 'Water reaches the decking. Now you are budgeting the same roof PLUS 8–14 sheets of plywood at $85 each.' },
  { year: 'YEAR 3+ OF WAITING', b: 'Mold inside walls, insulation, rafter repair, often an insurance non-renewal letter. Average total: 2–3× the cost of doing it today.' },
]

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

  // Build the slide list once the proposal loads — follows the proposal framework.
  const tiers = p?.tiers || {}
  const visibleTiers = Array.isArray(tiers._visible) && tiers._visible.length
    ? TIERS.filter(k => tiers._visible.includes(k))
    : TIERS
  const slides = []
  if (p) {
    slides.push({ type: 'cover' })
    slides.push({ type: 'about' })
    slides.push({ type: 'families' })
    slides.push({ type: 'materials' })
    slides.push({ type: 'understand' })
    slides.push({ type: 'quality' })
    for (const k of visibleTiers) if (tiers[k]) slides.push({ type: 'tier', k })
    slides.push({ type: 'benefits' })
    slides.push({ type: 'cost' })
    slides.push({ type: 'nextsteps' })
    slides.push({ type: 'experience' })
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
        <div className="pr-slide">{renderSlide(slide, p, tiers)}</div>

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
        .pr-tier-warr{font-size:15px;font-weight:800;margin-top:8px}
        .pr-tier-mat{font-size:13px;color:rgba(255,255,255,.6);margin-top:5px}
        .pr-feats{list-style:none;margin-top:20px;display:inline-block;text-align:left}
        .pr-feats li{font-size:14px;color:rgba(255,255,255,.85);line-height:1.5;margin-bottom:8px}
        .pr-feats li span{font-weight:900;margin-right:8px}
        /* cost of doing nothing */
        .pr-cost-card{background:rgba(176,30,23,.16);border:1px solid rgba(176,30,23,.5);border-radius:12px;padding:15px 16px;text-align:left}
        .pr-cost-year{font-size:11px;font-weight:900;color:#FCA5A5;letter-spacing:1px;margin-bottom:6px}
        .pr-cost-b{font-size:12.5px;color:rgba(255,255,255,.82);line-height:1.5}
        .pr-cost-cta{margin-top:16px;background:#B01E17;border-radius:11px;padding:13px 18px;font-size:14px;font-weight:700}
        .pr-cost-cta strong{color:#FDE68A}
        /* experience */
        .pr-exp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:6px}
        .pr-exp-promise{margin-top:18px;font-size:15px;font-style:italic;font-weight:800;color:#D4960E}
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
        @media(max-width:680px){
          .pr-slide{padding:34px 18px 96px}
          .pr-title{font-size:25px}
          .pr-cover-name{font-size:32px}
          .pr-tier-name{font-size:31px}
          .pr-tier-price{font-size:44px}
          .pr-g3,.pr-g4,.pr-scope-grid,.pr-exp-grid{grid-template-columns:1fr 1fr}
          /* On a phone the side arrows would cover content — move them into the
             bottom control bar, flanking the dots pill. */
          .pr-nav{width:42px;height:42px;font-size:23px;top:auto;bottom:13px;transform:none}
          .pr-prev{left:14px}
          .pr-next{right:14px}
          .pr-dots{bottom:18px;max-width:48vw}
        }
      `}</style>
    </>
  )
}

function renderSlide(slide, p, tiers) {
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

    case 'about':
      return (
        <>
          <div className="pr-eyebrow">STEP 1 · WHO WE ARE</div>
          <h1 className="pr-title">A family-built SoCal roofing company</h1>
          <p className="pr-lede">Fully licensed (CA Lic. C39 #1126880) and insured, with one promise: we treat your home the way we'd treat our own mother's. No high-pressure sales, no surprise charges — every job runs by a project lead who is on-site daily.</p>
          <div className="pr-grid pr-g4">
            {ABOUT_STATS.map((st, i) => (
              <div key={i} className="pr-stat"><div className="pr-stat-n">{st.n}</div><div className="pr-stat-l">{st.l}</div></div>
            ))}
          </div>
        </>
      )

    case 'families':
      return (
        <>
          <div className="pr-eyebrow">STEP 2 · FAMILIES WE'VE HELPED</div>
          <h1 className="pr-title">1,200+ neighbors have trusted us with their roof</h1>
          <div className="pr-grid pr-g3" style={{ marginTop: 18 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="pr-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="pr-testi-stars">★★★★★</div>
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
          <div className="pr-eyebrow">STEP 3 · MATERIALS & PARTNERSHIPS</div>
          <h1 className="pr-title">We only install materials we've personally vetted</h1>
          <div className="pr-grid pr-g3" style={{ marginTop: 14 }}>
            {MATERIALS.map((m, i) => (
              <div key={i} className="pr-card"><div className="pr-card-t">{m.name}</div><div className="pr-card-b">{m.tag}</div></div>
            ))}
          </div>
          <div className="pr-eyebrow" style={{ marginTop: 22 }}>DISTRIBUTOR PARTNERSHIPS</div>
          <div className="pr-grid pr-g2" style={{ marginTop: 8 }}>
            {PARTNERS.map((m, i) => (
              <div key={i} className="pr-card"><div className="pr-card-t">{m.name}</div><div className="pr-card-b">{m.tag}</div></div>
            ))}
          </div>
        </>
      )

    case 'understand':
      return (
        <>
          <div className="pr-eyebrow">STEP 4 · UNDERSTANDING YOUR ROOF</div>
          <h1 className="pr-title">Here's what we captured during your inspection</h1>
          <p className="pr-lede">These measurements drive every part of this proposal — from how many bundles arrive on the truck to the warranty class we can offer.</p>
          <div className="pr-scope-grid">
            <div><span>ROOF TYPE</span><strong>{p.roof_type === 'tile' ? `Tile${p.tile_subtype ? ' · ' + p.tile_subtype : ''}` : 'Shingle'}</strong></div>
            <div><span>SQUARES</span><strong>{p.squares} sq</strong></div>
            <div><span>PITCH</span><strong>{p.pitch}/12</strong></div>
            <div><span>STORIES</span><strong>{p.stories}</strong></div>
          </div>
        </>
      )

    case 'quality':
      return (
        <>
          <div className="pr-eyebrow">STEP 5 · SAME WORKMANSHIP — 3 QUALITY LEVELS</div>
          <h1 className="pr-title">Every homeowner has a different budget and need</h1>
          <p className="pr-lede">So we offer the same workmanship at all three levels — same crew, same standards, same senior inspector signing off. The only difference between the three tiers is the materials. There is no wrong answer.</p>
          <div className="pr-grid pr-g3">
            {QUALITY_PILLARS.map((q, i) => (
              <div key={i} className="pr-card"><div className="pr-card-t">{q.t}</div><div className="pr-card-b">{q.b}</div></div>
            ))}
          </div>
        </>
      )

    case 'tier': {
      const t = tiers[slide.k] || {}
      const c = TIER_COLOR[slide.k]
      return (
        <>
          <div className="pr-tier-badge" style={{ background: c }}>{TIER_LABEL[slide.k]}</div>
          <h1 className="pr-tier-name">{t.name}</h1>
          <div className="pr-tier-tag">{t.tagline}</div>
          <div className="pr-tier-price" style={{ color: c }}>${(t.price || 0).toLocaleString()}</div>
          {t.warranty && <div className="pr-tier-warr" style={{ color: c }}>🛡 {t.warranty}</div>}
          {t.material && <div className="pr-tier-mat">{t.material}{t.brand ? ` · ${t.brand}` : ''}</div>}
          <ul className="pr-feats">
            {(t.features || []).slice(0, 8).map((f, idx) => (
              <li key={idx}><span style={{ color: c }}>✓</span>{f}</li>
            ))}
          </ul>
        </>
      )
    }

    case 'benefits':
      return (
        <>
          <div className="pr-eyebrow">STEP 6 · TOP BENEFITS OF A NEW ROOF</div>
          <h1 className="pr-title">What a new roof actually does for you</h1>
          <div className="pr-grid pr-g3" style={{ marginTop: 14 }}>
            {BENEFITS.map((b, i) => (
              <div key={i} className="pr-card">
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
          <div className="pr-eyebrow" style={{ color: '#FCA5A5' }}>STEP 7 · THE COST OF DOING NOTHING</div>
          <h1 className="pr-title">Roofs don't get cheaper to fix</h1>
          <p className="pr-lede">Waiting another season usually means the cost stacks — and the surprise repairs start showing up inside the house.</p>
          <div className="pr-grid pr-g3">
            {COST_STEPS.map((cst, i) => (
              <div key={i} className="pr-cost-card"><div className="pr-cost-year">{cst.year}</div><div className="pr-cost-b">{cst.b}</div></div>
            ))}
          </div>
          <div className="pr-cost-cta">The single biggest predictor of roof cost is <strong>how long you wait to start</strong>.</div>
        </>
      )

    case 'nextsteps':
      return (
        <>
          <div className="pr-eyebrow">STEP 8 · WHAT HAPPENS AFTER YOU SIGN</div>
          <h1 className="pr-title">Your install in 5 simple steps</h1>
          <div className="pr-steps">
            {PROCESS_STEPS.map((st, i) => (
              <div key={i} className="pr-step">
                <div className="pr-step-n">{i + 1}</div>
                <div><div className="pr-step-t">{st.icon} {st.t}</div><div className="pr-step-b">{st.b}</div></div>
              </div>
            ))}
          </div>
        </>
      )

    case 'experience':
      return (
        <>
          <div className="pr-eyebrow">THE GOOD PEOPLE DIFFERENCE</div>
          <h1 className="pr-title">It's not just a roof. It's an entire experience.</h1>
          <p className="pr-lede">Most contractors stop calling you back the moment the deposit clears. We do the opposite — every project gets its own live communication channel, your choice:</p>
          <div className="pr-exp-grid">
            <div className="pr-card">
              <div className="pr-card-ic">💬</div>
              <div className="pr-card-t">Group text thread</div>
              <div className="pr-card-b">You, your spouse, the project manager, the crew lead — one group, live photos all day, ask anything anytime.</div>
            </div>
            <div className="pr-card">
              <div className="pr-card-ic">🔗</div>
              <div className="pr-card-t">Shared progress link</div>
              <div className="pr-card-b">A private project page anyone you trust can open — photo progress, delivery times, weather pauses, schedule.</div>
            </div>
          </div>
          <div className="pr-exp-promise">You will never wonder what's happening with your roof. Ever.</div>
        </>
      )

    case 'close':
      return (
        <>
          <div className="pr-close-mark">✓</div>
          <h1 className="pr-title">Ready to protect your home?</h1>
          <p className="pr-lede">Pick the package that fits — we'll handle the rest. Licensed, insured, and local. CA Lic. C39 #1126880.</p>
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
