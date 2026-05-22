import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

const FALLBACK_APR = 7.99
const FALLBACK_TERM = 120

function monthly(principal, aprPct = FALLBACK_APR, term = FALLBACK_TERM) {
  const r = (aprPct / 100) / 12
  if (!r) return Math.round(principal / term)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -term)))
}

// Fallback testimonials — admin can later move these to settings.
const TESTIMONIALS = [
  { name: 'Maria S.', city: 'Yucaipa, CA',     stars: 5, text: 'Crew showed up on time, treated my home like their own, and finished a full tear-off in two days. Roof looks incredible.' },
  { name: 'Daniel R.', city: 'Redlands, CA',    stars: 5, text: 'Honest pricing, no surprises, and they walked me through every option. Easiest contractor experience I have ever had.' },
  { name: 'Carolyn P.', city: 'San Bernardino', stars: 5, text: 'Wind storm took out half my ridge. They had a crew here within a week and the workmanship was flawless.' },
]

const PROCESS_STEPS = [
  { icon: '✍️', title: 'Sign your proposal',         body: 'Pick a tier, sign on this page, and your project is officially scheduled.' },
  { icon: '📅', title: 'Pre-install walkthrough',    body: 'Your rep visits to confirm color choices, pull permits if needed, and lock the install date.' },
  { icon: '🚚', title: 'Materials delivered',         body: 'Manufacturer-fresh shingles or tile delivered to your driveway 1–2 days before install.' },
  { icon: '🔨', title: 'Tear-off & install',          body: 'Crew tears off old layers, inspects decking, and installs your new system. Most homes finish in 1–2 days.' },
  { icon: '✅', title: 'Final inspection & cleanup',  body: 'Magnetic sweep, daily site cleanup, and a final walkthrough so you sign off happy.' },
]

const FAQS = [
  { q: 'How long does the install take?',                 a: 'Most single-family homes finish in 1–2 working days. Larger or steeper roofs may run 3 days. We will give you a firm window during the pre-install walkthrough.' },
  { q: 'Do I need to be home during the install?',         a: 'You do not. Most of our customers go to work as usual. Our crew leads will text you progress photos throughout the day.' },
  { q: 'What happens if it rains?',                        a: 'We monitor weather hourly. If rain is forecast, we reschedule before tear-off begins. Your home is never left exposed overnight — we tarp and seal at the end of every day.' },
  { q: 'How is my landscaping protected?',                 a: 'We tarp around the perimeter, move patio furniture, and run a magnetic sweep at the end of each day for stray nails. Damage caused by our crew is fully covered by our liability insurance.' },
  { q: 'When do I pay?',                                   a: 'A small deposit ($1,000 or 10%, whichever is less) holds your install slot. 50% is due the day work starts. The balance is due upon completion and your final walkthrough.' },
  { q: 'What if my decking is rotten underneath?',         a: 'We do not know until we tear off. Standard pricing includes ~1 sheet per 3 squares. Anything beyond that is a transparent $85/sheet Change Order you sign before we proceed.' },
  { q: 'Are you licensed and insured?',                    a: 'Yes. CA Lic. C39 #1126880, fully bonded, $2M general liability + workers comp. Verification documents are available on request.' },
  { q: 'What does the warranty actually cover?',           a: 'Workmanship warranty covers any leak or installation defect for the period stated in your tier. Manufacturer warranty covers material defects per the brand’s terms — we register every roof on your behalf the day after install.' },
  { q: 'Do you handle insurance claims?',                  a: 'Yes. If your roof was damaged by storm or hail, we coordinate directly with your insurance adjuster, document the damage, and submit supplements when needed.' },
  { q: 'Can I see past projects in my neighborhood?',      a: 'Absolutely. Ask your rep — we will share before/after photos and addresses of nearby installs you can drive by.' },
]

const TIER_LABELS = { good: 'ESSENTIAL', better: 'PERFORMANCE', best: 'SIGNATURE' }

const NOT_INCLUDED = [
  'Interior repairs (drywall, paint, ceiling damage from prior leaks)',
  'Solar panel removal and reset (priced separately as add-on)',
  'Skylight replacement (we re-flash existing skylights — replacement is a separate quote)',
  'Gutter replacement (priced separately as add-on)',
  'HVAC unit relocation if mounted on the roof',
  'Permit fees that exceed the listed amount (rare; covered transparently)',
]

function getIdFromUrl() {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/\/p\/([^\/?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function PublicProposal() {
  const router = useRouter()
  // URL fallback prevents the page from being stuck when router.query is empty
  // (statically-optimized dynamic routes don't populate query until isReady).
  const id = router.query.id || getIdFromUrl()
  const [p, setP] = useState(null)
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState(null)
  const [accepted, setAccepted] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [openFaq, setOpenFaq] = useState(null)
  const [brandAssets, setBrandAssets] = useState({})
  const [changeOrders, setChangeOrders] = useState([])
  const [adders, setAdders] = useState([])
  const sigRef = useRef(null)
  const sigCtxRef = useRef(null)
  const [sigFilled, setSigFilled] = useState(false)

  useEffect(() => {
    fetch('/api/brand-assets').then(r => r.json()).then(d => setBrandAssets(d.assets || {})).catch(() => {})
    fetch('/api/change-orders').then(r => r.json()).then(d => setChangeOrders(d.changeOrders || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/proposal/${id}`).then(async r => {
      if (cancelled) return
      if (!r.ok) { setErr('Proposal not found.'); return }
      const data = await r.json()
      if (data.superseded_by_id) {
        router.replace(`/p/${data.superseded_by_id}?v=updated`)
        return
      }
      setP(data)
      if (data.selected_tier) setAccepted({ tier: data.selected_tier, at: data.accepted_at })
      fetch(`/api/proposal/${id}/view`, { method: 'POST' }).catch(() => {})
    }).catch(e => setErr(e.message))
    return () => { cancelled = true }
  }, [id])

  function initSig(canvas) {
    if (!canvas || sigCtxRef.current) return
    const r = canvas.getBoundingClientRect()
    canvas.width = r.width * (window.devicePixelRatio || 1)
    canvas.height = r.height * (window.devicePixelRatio || 1)
    const ctx = canvas.getContext('2d')
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1)
    ctx.strokeStyle = '#0C1C38'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    sigCtxRef.current = ctx
    let drawing = false
    const pt = e => {
      const b = canvas.getBoundingClientRect()
      return e.touches ? { x: e.touches[0].clientX - b.left, y: e.touches[0].clientY - b.top } : { x: e.clientX - b.left, y: e.clientY - b.top }
    }
    canvas.addEventListener('mousedown',  e => { drawing = true; const q = pt(e); ctx.beginPath(); ctx.moveTo(q.x, q.y) })
    canvas.addEventListener('mousemove',  e => { if (!drawing) return; const q = pt(e); ctx.lineTo(q.x, q.y); ctx.stroke(); setSigFilled(true) })
    canvas.addEventListener('mouseup',    () => drawing = false)
    canvas.addEventListener('mouseleave', () => drawing = false)
    canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; const q = pt(e); ctx.beginPath(); ctx.moveTo(q.x, q.y) }, { passive: false })
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!drawing) return; const q = pt(e); ctx.lineTo(q.x, q.y); ctx.stroke(); setSigFilled(true) }, { passive: false })
    canvas.addEventListener('touchend',   () => drawing = false)
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
      body: JSON.stringify({ tier: picking, signature: dataUrl, addons: adders }),
    })
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || 'Failed to accept'); return }
    const d = await r.json().catch(() => ({}))
    if (d.proposal) {
      setP(prev => ({
        ...prev,
        accepted_total: d.proposal.accepted_total,
        accepted_addons: d.proposal.accepted_addons,
        selected_tier: picking,
      }))
    }
    setAccepted({ tier: picking, at: new Date().toISOString() })
    setPicking(null)
  }

  if (err) return <Center>{err}</Center>
  if (!p)  return <Center>Loading proposal…</Center>

  const tiers = p.tiers || {}
  // v3.3 — rep can hide tiers; tiers._visible holds the ones to show.
  const visibleTierKeys = (Array.isArray(tiers._visible) && tiers._visible.length ? tiers._visible : ['good','better','best'])
    .filter(k => ['good','better','best'].includes(k))
  const COLORS = { good: '#4A5568', better: '#B01E17', best: '#D4960E' }
  const date = new Date(p.created_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  const expires = p.expires_at ? new Date(p.expires_at).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '—'
  const photos = Array.isArray(p.photo_urls) ? p.photo_urls : []
  const financingOn = p.financing_enabled !== false
  const updated = router.query.v === 'updated'
  const repInitial = (p.rep_name || 'G').trim().charAt(0).toUpperCase()
  const addersList = changeOrders.filter(c => adders.includes(c.id))
  const addersSubtotal = addersList.reduce((s, c) => s + (Number(c.price) || 0), 0)
  const acceptedAddons = Array.isArray(p.accepted_addons) ? p.accepted_addons : []
  const sel = accepted ? tiers[accepted.tier] : null
  const selPrice = (accepted && p.accepted_total) ? Number(p.accepted_total) : (sel?.price || 0)
  const deposit = Math.min(1000, Math.round(selPrice * 0.10))
  const startPay = Math.round(selPrice * 0.50)
  const finalPay = selPrice - deposit - startPay

  return (
    <>
      <Head>
        <title>Your Proposal — Good People Roofing</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </Head>
      <div className="pub-wrap">
        <header className="pub-hero">
          <img src="/logo.png" alt="Good People Roofing" className="pub-logo" />
          <div className="pub-hero-sub">
            <div className="pub-hero-num">PROPOSAL {p.prop_num}</div>
            <div className="pub-hero-meta">{date} · valid until {expires}</div>
          </div>
        </header>

        {updated && (
          <div className="pub-banner">📝 This proposal has been updated. You're viewing the latest version.</div>
        )}

        <main className="pub-main">

          {p.cover_letter && (
            <section className="pub-cover">
              <div className="pub-cover-eyebrow">A NOTE FROM YOUR REP</div>
              <p className="pub-cover-text">{p.cover_letter}</p>
              {p.rep_name && <div className="pub-cover-sig">— {p.rep_name}, Good People Roofing</div>}
            </section>
          )}

          {/* 1 — Customer intro */}
          <section className="pub-intro">
            <div className="pub-eyebrow">PREPARED FOR</div>
            <h1 className="pub-name">{p.customer_name}</h1>
            <div className="pub-addr">{p.customer_address}</div>
          </section>

          {/* 2 — About us */}
          <section className="pub-about">
            <div className="pub-section-title">🏠 ABOUT GOOD PEOPLE ROOFING</div>
            <p className="pub-about-body">
              We are a family-built Southern California roofing company, fully licensed (CA Lic. C39 #1126880) and insured, with a simple promise: we treat your home the way we would treat our own mother's. No high-pressure sales. No surprise charges. Every job is run by a project lead who is on-site daily, and every roof is inspected by a senior estimator before we hand you the keys back.
            </p>
            <div className="pub-about-stats">
              <div><strong>1,200+</strong><span>Roofs installed</span></div>
              <div><strong>4.9★</strong><span>Average review</span></div>
              <div><strong>10+</strong><span>Years serving SoCal</span></div>
              <div><strong>100%</strong><span>Cleanup guarantee</span></div>
            </div>
          </section>

          {/* 3 — Families we've helped */}
          <section className="pub-testimonials">
            <div className="pub-section-title">👨‍👩‍👧 FAMILIES WE'VE HELPED</div>
            <p className="pub-section-sub" style={{ marginBottom: 14 }}>
              1,200+ Southern California homeowners have trusted Good People with their roof. Here is what a few of your neighbors said.
            </p>
            <div className="pub-testi-grid">
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="pub-testi-card">
                  <div className="pub-testi-stars">{'★'.repeat(t.stars)}</div>
                  <p className="pub-testi-text">"{t.text}"</p>
                  <div className="pub-testi-name"><strong>{t.name}</strong> · {t.city}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 4 — Materials we use / partnerships */}
          <section className="pub-materials">
            <div className="pub-section-title">🏭 MATERIALS WE USE & PARTNERSHIPS</div>
            <p className="pub-section-sub" style={{ marginBottom: 16 }}>We only install materials from manufacturers we have personally vetted on hundreds of installs. Every product carries its own multi-decade manufacturer warranty on top of our workmanship guarantee.</p>
            <div className="pub-mat-grid">
              <MatCard logo={brandAssets.gaf}            name="GAF"             tag="Timberline HDZ / UHDZ Architectural Shingles" warr="Up to Lifetime Limited Warranty" />
              <MatCard logo={brandAssets.owens_corning}  name="Owens Corning"   tag="Duration / Duration COOL Series"              warr="Lifetime + WindProven™ Limited" />
              <MatCard logo={brandAssets.westlake}       name="Westlake Royal"  tag="Concrete & clay tile, premium accessory products" warr="50-year limited transferable" />
              <MatCard logo={brandAssets.eagle}          name="Eagle Roofing"   tag="Concrete Tile (flat & S-type)"                warr="50-year limited transferable" />
              <MatCard logo={brandAssets.titanium}       name="Titanium"        tag="High-performance synthetic underlayments"     warr="Up to lifetime limited" />
              <MatCard logo={brandAssets.boral}          name="Boral"           tag="Specialty tile + accessory products"          warr="Limited lifetime on select lines" />
            </div>
            <div className="pub-partners">
              <div className="pub-partners-lbl">DISTRIBUTOR PARTNERSHIPS</div>
              <div className="pub-partners-grid">
                <div className="pub-partner-card">
                  <strong>QXO</strong>
                  <span>National roofing distributor — preferred pricing, faster delivery, full warranty registration support.</span>
                </div>
                <div className="pub-partner-card">
                  <strong>SRS Distribution</strong>
                  <span>Largest US roofing distributor — full inventory access, dedicated account management, certified-contractor benefits.</span>
                </div>
              </div>
            </div>
          </section>

          {/* 5 — Understanding your roof */}
          <section className="pub-scope">
            <div className="pub-scope-title">🔍 UNDERSTANDING YOUR ROOF</div>
            <p className="pub-section-sub" style={{ marginBottom: 14 }}>
              These are the measurements we captured during your inspection. They drive every part of this proposal — from how many bundles arrive on the truck to the warranty class we can offer.
            </p>
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

          {photos.length > 0 && (
            <section className="pub-photos">
              <div className="pub-section-title">📸 PHOTOS FROM YOUR INSPECTION</div>
              <div className="pub-photo-grid">
                {photos.map((ph, i) => (
                  <button key={i} className="pub-photo-btn" onClick={() => setLightbox(ph.url)}>
                    <img src={ph.url} alt={ph.name || `Photo ${i+1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 6 — Same workmanship, 3 quality levels */}
          <section className="pub-quality">
            <div className="pub-section-title">⚖️ SAME WORKMANSHIP — 3 QUALITY LEVELS</div>
            <p className="pub-quality-body">
              Every roof we install gets the same crew, the same daily cleanups, and the same senior inspector signing off at the end. The difference between our three options is <strong>only the materials</strong> — what they are made of, how long they last, and how much the manufacturer warranty covers. There is no wrong answer. Pick the level that fits your home and your budget.
            </p>
            <div className="pub-quality-pillars">
              <div><strong>Same crew, every tier</strong><span>Installed by our W-2 employees — never day-laborers.</span></div>
              <div><strong>Same standards</strong><span>Same safety practices, same flashing details, same final sweep.</span></div>
              <div><strong>Different materials</strong><span>Shingle composition, tile weight, granule mix, warranty class.</span></div>
            </div>
          </section>

          {/* 7 — Choose your tier: Essential / Performance / Signature */}
          {!accepted && (
            <section>
              <h2 className="pub-section-title">CHOOSE YOUR PACKAGE</h2>
              <p className="pub-section-sub">Essential, Performance, or Signature. Same workmanship across all three — different materials and warranties. Pick the one that fits your home and your budget.</p>
              <div className="pub-tiers">
                {visibleTierKeys.map(k => {
                  const t = tiers[k]; if (!t) return null
                  const c = COLORS[k]; const popular = k === 'better' && visibleTierKeys.length > 1
                  return (
                    <article key={k} className={`pub-tier ${popular ? 'pop' : ''}`} style={{ borderColor: c }}>
                      {popular && <div className="pub-tier-pop">★ MOST POPULAR</div>}
                      <div className="pub-tier-badge" style={{ background: c }}>{TIER_LABELS[k]}</div>
                      <h3 className="pub-tier-name">{t.name}</h3>
                      <div className="pub-tier-tag">{t.tagline}</div>
                      <div className="pub-tier-price" style={{ color: c }}>${(t.price || 0).toLocaleString()}</div>
                      <div className="pub-tier-psf">${t.psf}/sq · {p.squares} squares</div>
                      {financingOn && (
                        <div className="pub-tier-fin">or about <strong>${monthly(t.price || 0).toLocaleString()}/mo</strong> with financing</div>
                      )}
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
                        Select {TIER_LABELS[k]}
                      </button>
                    </article>
                  )
                })}
              </div>
              {financingOn && (
                <div className="pub-fin-note">💳 Financing illustration uses {FALLBACK_APR}% APR over {FALLBACK_TERM/12} years. Actual rates depend on credit; ask your rep for full terms.</div>
              )}
            </section>
          )}

          {!accepted && changeOrders.length > 0 && (
            <section className="pub-upgrades">
              <h2 className="pub-section-title">✨ OPTIONAL UPGRADES</h2>
              <p className="pub-section-sub" style={{ marginBottom: 14 }}>
                Add any of these to your project. Whatever you check is added to your total when you sign — no pressure, pick only what you want.
              </p>
              <div className="pub-upgrade-list">
                {changeOrders.map(c => {
                  const on = adders.includes(c.id)
                  return (
                    <button key={c.id} type="button" className={`pub-upgrade ${on ? 'on' : ''}`}
                      onClick={() => setAdders(a => on ? a.filter(x => x !== c.id) : [...a, c.id])}>
                      <span className={`pub-upgrade-chk ${on ? 'on' : ''}`}>{on ? '✓' : ''}</span>
                      <span className="pub-upgrade-body">
                        <span className="pub-upgrade-label">{c.label}</span>
                        {c.description && <span className="pub-upgrade-desc">{c.description}</span>}
                      </span>
                      <span className="pub-upgrade-price">+${(Number(c.price) || 0).toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>
              {addersSubtotal > 0 && (
                <div className="pub-upgrade-subtotal">
                  {addersList.length} upgrade{addersList.length > 1 ? 's' : ''} selected ·{' '}
                  <strong>+${addersSubtotal.toLocaleString()}</strong> added at signing
                </div>
              )}
            </section>
          )}

          {accepted && (
            <section className="pub-accepted">
              <div className="pub-accepted-icon">✓</div>
              <h2>You picked the {TIER_LABELS[accepted.tier]} package</h2>
              <p>We received your acceptance on {new Date(accepted.at).toLocaleString()}. Your rep will be in touch within 24 hours to schedule the install.</p>
              {acceptedAddons.length > 0 && (
                <div className="pub-accepted-addons">
                  <div className="pub-accepted-adder"><span>{TIER_LABELS[accepted.tier]} package</span><span>${(sel?.price || 0).toLocaleString()}</span></div>
                  {acceptedAddons.map((a, i) => (
                    <div key={i} className="pub-accepted-adder"><span>+ {a.label}</span><span>${(Number(a.price) || 0).toLocaleString()}</span></div>
                  ))}
                  <div className="pub-accepted-adder pub-accepted-tot"><span>Total</span><span>${selPrice.toLocaleString()}</span></div>
                </div>
              )}
              <a className="pub-btn-outline" href={`/api/proposal/${p.id}/pdf`} target="_blank" rel="noreferrer">Download PDF copy</a>
            </section>
          )}

          {/* 8 — Top benefits of a new roof */}
          <section className="pub-benefits">
            <div className="pub-section-title">📈 TOP BENEFITS OF A NEW ROOF</div>
            <div className="pub-benefits-grid">
              <div>
                <div className="pub-benefit-icon">🛡</div>
                <strong>Protection that lasts decades</strong>
                <p>A new roof eliminates daily worry about leaks and ceiling stains. Modern shingles and tile carry 30-year to lifetime manufacturer warranties.</p>
              </div>
              <div>
                <div className="pub-benefit-icon">💰</div>
                <strong>Higher resale & appraisal value</strong>
                <p>Realtors consistently rank a recent roof in the top three improvements that move appraisal numbers. Most California buyers ask for the roof receipt before they offer.</p>
              </div>
              <div>
                <div className="pub-benefit-icon">⚡</div>
                <strong>Lower energy bills</strong>
                <p>Cool-rated shingles like Owens Corning Duration COOL reflect sunlight, drop attic temps by up to 20°F, and trim summer A/C costs.</p>
              </div>
              <div>
                <div className="pub-benefit-icon">📋</div>
                <strong>Insurance peace of mind</strong>
                <p>Many SoCal insurers now require a roof under 20 years old to keep your homeowner's policy. A new roof keeps coverage in good standing.</p>
              </div>
              <div>
                <div className="pub-benefit-icon">🏡</div>
                <strong>Curb appeal that gets noticed</strong>
                <p>Architectural shingles and concrete tile come in modern color palettes that update the entire look of your home from the street.</p>
              </div>
              <div>
                <div className="pub-benefit-icon">🌬</div>
                <strong>Wind & storm rating you can trust</strong>
                <p>Our installs are rated for up to 130 mph wind. Ridge vents, drip edge upgrades, and ice-and-water shield options lock in the upper end.</p>
              </div>
            </div>
          </section>

          {/* 9 — Cost of doing nothing */}
          <section className="pub-cost">
            <div className="pub-section-title pub-cost-title">⚠️ THE COST OF DOING NOTHING</div>
            <p className="pub-section-sub" style={{ marginBottom: 14 }}>Roofs do not get cheaper to fix. Waiting another season usually means the cost stacks — and the surprise repairs start showing up inside the house.</p>
            <div className="pub-cost-grid">
              <div>
                <div className="pub-cost-year">YEAR 1 OF WAITING</div>
                <p>Small leaks find weak shingles after the first big storm. You replace one ceiling tile and a section of drywall — typically $400 to $900 in interior repair.</p>
              </div>
              <div>
                <div className="pub-cost-year">YEAR 2 OF WAITING</div>
                <p>Water reaches the decking. Now you are budgeting for the same roof <em>plus</em> 8 to 14 sheets of plywood at $85 each — a $700 to $1,200 line item we would have avoided.</p>
              </div>
              <div>
                <div className="pub-cost-year">YEAR 3+ OF WAITING</div>
                <p>Mold inside walls, insulation replacement, rafters needing sister-boards, often a homeowner's-insurance non-renewal letter. Average total: 2-3× the cost of doing the roof today.</p>
              </div>
            </div>
            <div className="pub-cost-cta">
              The single biggest predictor of roof cost is <strong>how long you wait to start</strong>.
            </div>
          </section>

          {/* 10 — Install in 5 steps */}
          <section className="pub-process">
            <div className="pub-section-title">📅 WHAT HAPPENS AFTER YOU SIGN — YOUR INSTALL IN 5 STEPS</div>
            <div className="pub-process-list">
              {PROCESS_STEPS.map((s, i) => (
                <div key={i} className="pub-process-step">
                  <div className="pub-process-num">{i + 1}</div>
                  <div className="pub-process-icon">{s.icon}</div>
                  <div className="pub-process-body">
                    <div className="pub-process-title">{s.title}</div>
                    <div className="pub-process-text">{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 11 — It's not just a roof, it's an entire experience */}
          <section className="pub-experience">
            <div className="pub-experience-eyebrow">THE GOOD PEOPLE DIFFERENCE</div>
            <h3>It's not just a roof. It's an entire experience.</h3>
            <p>Most contractors stop calling you back the moment the deposit clears. We do the opposite. Every project we run gets its own live communication channel — your choice:</p>
            <div className="pub-experience-options">
              <div>
                <div className="pub-experience-icon">💬</div>
                <strong>Group text thread</strong>
                <p>One group with everyone who matters: you, your spouse, the project manager, the crew lead. Live photos throughout the day. Ask anything, anytime.</p>
              </div>
              <div>
                <div className="pub-experience-icon">🔗</div>
                <strong>Shared progress link</strong>
                <p>A private project page anyone you trust can open. Photo progress, materials delivery times, weather pauses, schedule confirmation — all on one page.</p>
              </div>
            </div>
            <p className="pub-experience-promise">Either way: you will never wonder what is happening with your roof. Ever.</p>
          </section>

          {/* Trust + closing sections */}
          <section className="pub-guarantee">
            <div className="pub-guarantee-badge">
              <div className="pub-guarantee-seal">100%</div>
            </div>
            <div className="pub-guarantee-body">
              <div className="pub-guarantee-eyebrow">OUR GUARANTEE</div>
              <h3>Done right or we make it right.</h3>
              <p>If anything about the install is not what we promised — a leak, a missed flashing, a cleanup we missed — we come back, on our dime, until it is right. That promise lasts the full term of your tier's workmanship warranty, in writing.</p>
            </div>
          </section>

          <section className="pub-license">
            <div className="pub-section-title">🛡 FULLY LICENSED & INSURED</div>
            <div className="pub-license-grid">
              <LicBadge logo={brandAssets.cslb}         title="CA Lic. C39 #1126880" sub="CSLB roofing classification" />
              <LicBadge logo={brandAssets.liability}    title="$2M General Liability" sub="Verified annually" />
              <LicBadge logo={brandAssets.workers_comp} title="Workers' Comp"          sub="Covers our crew on your property" />
              <LicBadge logo={brandAssets.gaf_certified} title="Manufacturer Certified" sub="GAF, Owens Corning, Eagle" />
            </div>
          </section>

          <section className="pub-notincluded">
            <div className="pub-section-title">📝 WHAT'S NOT INCLUDED</div>
            <p className="pub-section-sub" style={{ marginBottom: 12 }}>Being upfront beats surprises. Anything below is either out of scope or quoted separately when needed.</p>
            <ul className="pub-not-list">
              {NOT_INCLUDED.map((line, i) => (
                <li key={i}><span>×</span>{line}</li>
              ))}
            </ul>
          </section>

          <section className="pub-payment">
            <div className="pub-section-title">💵 PAYMENT SCHEDULE</div>
            <p className="pub-section-sub" style={{ marginBottom: 14 }}>Three simple milestones. No hidden charges. {accepted ? <>Below is what your <strong>{TIER_LABELS[accepted.tier]}</strong> package looks like split out:</> : 'Numbers below scale to whichever package you select.'}</p>
            <div className="pub-pay-grid">
              <div className="pub-pay-card">
                <div className="pub-pay-step">1 · DEPOSIT</div>
                <div className="pub-pay-amt">{accepted ? `$${deposit.toLocaleString()}` : '$1,000 or 10%'}</div>
                <div className="pub-pay-when">Due upon signing — locks your install slot</div>
              </div>
              <div className="pub-pay-card">
                <div className="pub-pay-step">2 · START</div>
                <div className="pub-pay-amt">{accepted ? `$${startPay.toLocaleString()}` : '50%'}</div>
                <div className="pub-pay-when">Due the morning the crew begins tear-off</div>
              </div>
              <div className="pub-pay-card">
                <div className="pub-pay-step">3 · COMPLETION</div>
                <div className="pub-pay-amt">{accepted ? `$${finalPay.toLocaleString()}` : 'Balance'}</div>
                <div className="pub-pay-when">Due after final walkthrough — only if you are happy</div>
              </div>
            </div>
          </section>

          {p.rep_name && (
            <section className="pub-rep">
              <div className="pub-rep-card">
                <div className="pub-rep-avatar">{repInitial}</div>
                <div className="pub-rep-info">
                  <div className="pub-rep-eyebrow">YOUR DEDICATED REP</div>
                  <div className="pub-rep-name">{p.rep_name}</div>
                  <div className="pub-rep-title">Good People Roofing</div>
                </div>
                <div className="pub-rep-cta">
                  <a className="pub-rep-btn" href="tel:+18447663709">📞 Call</a>
                  <a className="pub-rep-btn outline" href="sms:+18447663709">💬 Text</a>
                </div>
              </div>
            </section>
          )}

          <section className="pub-faq">
            <div className="pub-section-title">❓ FREQUENTLY ASKED QUESTIONS</div>
            <div className="pub-faq-list">
              {FAQS.map((f, i) => {
                const open = openFaq === i
                return (
                  <div key={i} className={`pub-faq-item ${open ? 'open' : ''}`}>
                    <button className="pub-faq-q" onClick={() => setOpenFaq(open ? null : i)}>
                      <span>{f.q}</span>
                      <span className="pub-faq-chev">{open ? '−' : '+'}</span>
                    </button>
                    {open && <div className="pub-faq-a">{f.a}</div>}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="pub-terms">
            <h3>Terms</h3>
            <p>This proposal is valid for 14 days. Deposit: $1,000 or 10% (whichever is less) due upon signing · 50% at start · balance upon completion. Wood repairs, extra layers, and permit costs added via signed Change Order. CA Lic. C39 #1126880. Fully licensed and insured.</p>
          </section>

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
            {addersList.length > 0 && (
              <div className="pub-modal-adders">
                {addersList.map(c => (
                  <div key={c.id} className="pub-modal-adder"><span>+ {c.label}</span><span>${(Number(c.price) || 0).toLocaleString()}</span></div>
                ))}
                <div className="pub-modal-adder pub-modal-adder-tot">
                  <span>Total</span><span>${((tiers[picking].price || 0) + addersSubtotal).toLocaleString()}</span>
                </div>
              </div>
            )}
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

      {lightbox && (
        <div className="pub-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
          <button className="pub-lightbox-close">×</button>
        </div>
      )}

      <style jsx global>{`
        :root{--navy:#0C1C38;--crimson:#B01E17;--gold:#D4960E;--cream:#F7F6F3;--text:#1A1A2E;--mute:#4A5568;--bord:#E2E0DB;--success:#10B981}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:var(--cream);color:var(--text);min-height:100vh;-webkit-text-size-adjust:100%}
        .pub-wrap{max-width:1180px;margin:0 auto}
        .pub-hero{background:var(--navy);padding:20px 24px;display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid var(--crimson);gap:14px;flex-wrap:wrap}
        .pub-logo{height:60px;width:auto;background:#fff;border-radius:9px;padding:6px}
        .pub-hero-sub{text-align:right}
        .pub-hero-num{color:var(--gold);font-weight:900;font-size:13px;letter-spacing:1.2px}
        .pub-hero-meta{color:#94a3b8;font-size:11px;margin-top:3px}
        .pub-banner{background:#FEF3C7;color:#78350F;padding:10px 22px;font-size:13px;font-weight:700;text-align:center;border-bottom:1px solid #FCD34D}
        .pub-main{padding:32px 22px 60px;display:flex;flex-direction:column;gap:34px}
        .pub-cover{background:#fff;border-left:5px solid var(--gold);padding:20px 22px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.04)}
        .pub-cover-eyebrow{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.5px;margin-bottom:8px}
        .pub-cover-text{font-size:15px;color:var(--text);line-height:1.6;margin-bottom:8px;font-style:italic}
        .pub-cover-sig{font-size:13px;font-weight:700;color:var(--navy)}
        .pub-intro{}
        .pub-eyebrow{font-size:11px;font-weight:800;color:var(--mute);letter-spacing:1.5px;margin-bottom:6px}
        .pub-name{font-size:34px;font-weight:900;color:var(--navy);line-height:1.1;margin-bottom:6px}
        .pub-addr{font-size:14px;color:var(--mute)}
        .pub-section-title{font-size:13px;font-weight:900;color:var(--navy);letter-spacing:1.8px;margin-bottom:6px}
        .pub-section-sub{font-size:14px;color:var(--mute);max-width:780px;line-height:1.55}
        .pub-about{background:linear-gradient(180deg,#fff,#FAFAF8);padding:24px 26px;border-radius:14px;border:1px solid var(--bord)}
        .pub-about-body{font-size:14.5px;color:var(--text);line-height:1.65;margin:10px 0 18px}
        .pub-about-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        .pub-about-stats div{background:var(--cream);border-radius:10px;padding:14px;text-align:center}
        .pub-about-stats strong{display:block;font-size:22px;font-weight:900;color:var(--crimson);margin-bottom:4px}
        .pub-about-stats span{font-size:11px;font-weight:700;color:var(--mute);letter-spacing:.6px}
        .pub-why{background:#fff;padding:22px 26px;border-radius:14px;border:1px solid var(--bord)}
        .pub-why-body{font-size:14px;color:var(--text);line-height:1.6;margin-top:8px}
        .pub-quality{background:#fff;padding:24px 26px;border-radius:14px;border:1px solid var(--bord)}
        .pub-quality-body{font-size:14.5px;color:var(--text);line-height:1.65;margin:10px 0 18px}
        .pub-quality-body strong{color:var(--navy);font-weight:800}
        .pub-quality-pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .pub-quality-pillars>div{background:var(--cream);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:5px}
        .pub-quality-pillars strong{font-size:13px;font-weight:900;color:var(--navy)}
        .pub-quality-pillars span{font-size:12px;color:var(--mute);line-height:1.5}
        .pub-benefits-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:8px}
        .pub-benefits-grid>div{background:#fff;border:1px solid var(--bord);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:8px}
        .pub-benefit-icon{font-size:28px}
        .pub-benefits-grid strong{font-size:14.5px;font-weight:900;color:var(--navy)}
        .pub-benefits-grid p{font-size:13px;color:var(--mute);line-height:1.55}
        .pub-cost{background:linear-gradient(180deg,#FEF2F2,#fff);border:1px solid #FCA5A5;border-radius:14px;padding:22px 24px}
        .pub-cost-title{color:#991B1B !important;letter-spacing:1.6px !important}
        .pub-cost-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px}
        .pub-cost-grid>div{background:#fff;border:1px solid #FECACA;border-radius:11px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
        .pub-cost-year{font-size:10px;font-weight:900;color:#991B1B;letter-spacing:1.4px}
        .pub-cost-grid p{font-size:12.5px;color:var(--text);line-height:1.55}
        .pub-cost-grid p em{color:#991B1B;font-style:normal;font-weight:700}
        .pub-cost-cta{background:#991B1B;color:#fff;text-align:center;padding:14px 20px;border-radius:10px;font-size:14px;line-height:1.5}
        .pub-cost-cta strong{color:#FDE68A;font-weight:900}
        .pub-experience{background:linear-gradient(135deg,var(--navy),#16305E);color:#fff;border-radius:18px;padding:28px 30px}
        .pub-experience-eyebrow{font-size:10px;font-weight:900;letter-spacing:1.8px;color:var(--gold);margin-bottom:8px}
        .pub-experience>h3{font-size:24px;font-weight:900;margin-bottom:10px;color:#fff;line-height:1.2}
        .pub-experience>p{font-size:14px;color:rgba(255,255,255,.82);line-height:1.6;margin-bottom:18px}
        .pub-experience-options{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
        .pub-experience-options>div{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:16px 18px;display:flex;flex-direction:column;gap:6px}
        .pub-experience-icon{font-size:26px;margin-bottom:4px}
        .pub-experience-options strong{font-size:14px;font-weight:900;color:#fff}
        .pub-experience-options p{font-size:13px;color:rgba(255,255,255,.74);line-height:1.55}
        .pub-experience-promise{text-align:center;padding-top:12px;border-top:1px solid rgba(255,255,255,.12);font-size:14px;color:var(--gold);font-weight:800;font-style:italic}
        .pub-scope{background:#fff;border-radius:14px;padding:22px 26px;border-left:5px solid var(--gold);box-shadow:0 2px 12px rgba(0,0,0,.04)}
        .pub-scope-title{font-size:11px;font-weight:800;color:var(--mute);letter-spacing:1.5px;margin-bottom:14px}
        .pub-scope-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
        .pub-scope-grid div{display:flex;flex-direction:column;gap:3px}
        .pub-scope-grid span{font-size:10px;font-weight:700;color:var(--mute);letter-spacing:1px}
        .pub-scope-grid strong{font-size:14px;font-weight:800;color:var(--navy)}
        .pub-addons{margin-top:14px;font-size:13px;color:var(--mute);padding-top:12px;border-top:1px solid var(--bord)}
        .pub-photos{}
        .pub-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:10px}
        .pub-photo-btn{padding:0;border:none;background:none;cursor:pointer;border-radius:10px;overflow:hidden;aspect-ratio:1;transition:transform .15s}
        .pub-photo-btn:hover{transform:scale(1.03)}
        .pub-photo-btn img{width:100%;height:100%;object-fit:cover;display:block}
        .pub-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:18px;margin-top:22px}
        .pub-tier{background:#fff;border:3px solid var(--bord);border-radius:16px;padding:22px;display:flex;flex-direction:column;position:relative;transition:transform .15s,box-shadow .15s}
        .pub-tier:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,.08)}
        .pub-tier.pop{transform:scale(1.025);box-shadow:0 8px 26px rgba(176,30,23,.12)}
        .pub-tier-pop{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:var(--crimson);color:#fff;font-size:10px;font-weight:900;letter-spacing:1.5px;padding:5px 12px;border-radius:20px}
        .pub-tier-badge{display:inline-block;color:#fff;font-size:10px;font-weight:900;letter-spacing:1.5px;padding:5px 11px;border-radius:5px;margin-bottom:10px;align-self:flex-start}
        .pub-tier-name{font-size:24px;font-weight:900;color:var(--navy)}
        .pub-tier-tag{font-size:12px;color:var(--mute);font-style:italic;margin-bottom:14px}
        .pub-tier-price{font-size:36px;font-weight:900;line-height:1}
        .pub-tier-psf{font-size:11px;color:var(--mute);margin-top:3px}
        .pub-tier-fin{font-size:12px;color:var(--mute);margin-bottom:14px;margin-top:6px;padding:6px 10px;background:rgba(212,150,14,.1);border-radius:6px}
        .pub-tier-fin strong{color:var(--gold);font-weight:900}
        .pub-tier-mat-box{background:var(--cream);border-radius:9px;padding:11px 13px;margin-bottom:10px}
        .pub-tier-mat-lbl{font-size:9px;font-weight:800;color:var(--mute);letter-spacing:1.2px;margin-bottom:2px}
        .pub-tier-mat{font-size:12px;font-weight:700;color:var(--navy)}
        .pub-tier-brand{font-size:11px;color:var(--mute);margin-top:1px}
        .pub-tier-warr{font-size:12px;font-weight:800;margin-bottom:12px}
        .pub-tier-narrative{font-size:12px;color:var(--mute);line-height:1.55;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--bord)}
        .pub-tier-feats{list-style:none;margin-bottom:16px;flex:1}
        .pub-tier-feats li{font-size:12px;color:var(--mute);line-height:1.5;margin-bottom:5px;display:flex;gap:7px}
        .pub-tier-feats li span{font-weight:900;flex-shrink:0}
        .pub-tier-cta{color:#fff;border:none;border-radius:10px;padding:14px 18px;font-size:15px;font-weight:800;letter-spacing:.5px;cursor:pointer;font-family:inherit;transition:filter .15s;min-height:48px}
        .pub-tier-cta:hover{filter:brightness(1.1)}
        .pub-fin-note{font-size:11px;color:var(--mute);font-style:italic;text-align:center;margin-bottom:0}
        .pub-upgrades{}
        .pub-upgrade-list{display:flex;flex-direction:column;gap:10px;margin-top:6px}
        .pub-upgrade{display:flex;align-items:center;gap:13px;background:#fff;border:2px solid var(--bord);border-radius:12px;padding:14px 16px;cursor:pointer;font-family:inherit;text-align:left;transition:all .15s;width:100%}
        .pub-upgrade:hover{border-color:var(--crimson)}
        .pub-upgrade.on{border-color:var(--crimson);background:rgba(176,30,23,.04)}
        .pub-upgrade-chk{width:24px;height:24px;border-radius:6px;border:2px solid var(--bord);background:var(--cream);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;flex-shrink:0}
        .pub-upgrade-chk.on{background:var(--crimson);border-color:var(--crimson)}
        .pub-upgrade-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .pub-upgrade-label{font-size:14px;font-weight:800;color:var(--navy)}
        .pub-upgrade-desc{font-size:12px;color:var(--mute);line-height:1.45}
        .pub-upgrade-price{font-size:15px;font-weight:900;color:var(--crimson);flex-shrink:0;white-space:nowrap}
        .pub-upgrade-subtotal{margin-top:12px;background:var(--navy);color:#fff;border-radius:10px;padding:12px 16px;font-size:13px;text-align:center}
        .pub-upgrade-subtotal strong{color:var(--gold);font-weight:900}
        .pub-modal-adders{background:#fff;border:1px solid var(--bord);border-radius:10px;padding:10px 13px;margin-bottom:18px;margin-top:-8px}
        .pub-modal-adder{display:flex;justify-content:space-between;font-size:13px;color:var(--mute);padding:3px 0}
        .pub-modal-adder-tot{border-top:1px solid var(--bord);margin-top:4px;padding-top:7px;font-weight:900;color:var(--navy);font-size:15px}
        .pub-accepted-addons{max-width:420px;margin:4px auto 18px;background:var(--cream);border-radius:10px;padding:12px 16px;text-align:left}
        .pub-accepted-adder{display:flex;justify-content:space-between;font-size:13px;color:var(--mute);padding:4px 0}
        .pub-accepted-tot{border-top:1px solid var(--bord);margin-top:4px;padding-top:8px;font-weight:900;color:#065F46;font-size:16px}
        .pub-materials{}
        .pub-mat-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:6px}
        .pub-mat-card{background:#fff;border:1px solid var(--bord);border-radius:11px;padding:16px 18px}
        .pub-mat-name{font-size:18px;font-weight:900;color:var(--navy);letter-spacing:.4px}
        .pub-mat-tag{font-size:13px;color:var(--mute);margin-top:4px}
        .pub-mat-warr{font-size:11px;color:var(--gold);font-weight:800;margin-top:8px;letter-spacing:.5px;text-transform:uppercase}
        .pub-partners{margin-top:18px;padding-top:18px;border-top:1px solid var(--bord)}
        .pub-partners-lbl{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.6px;margin-bottom:10px}
        .pub-partners-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pub-partner-card{background:#FAFAF8;border:1px solid var(--bord);border-left:4px solid var(--navy);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}
        .pub-partner-card strong{font-size:15px;font-weight:900;color:var(--navy);letter-spacing:.4px}
        .pub-partner-card span{font-size:12px;color:var(--mute);line-height:1.5}
        .pub-process{}
        .pub-process-list{display:flex;flex-direction:column;gap:12px;margin-top:6px}
        .pub-process-step{display:flex;align-items:flex-start;gap:14px;background:#fff;border-radius:12px;padding:16px 18px;border:1px solid var(--bord);position:relative}
        .pub-process-num{width:28px;height:28px;border-radius:50%;background:var(--crimson);color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .pub-process-icon{font-size:24px;flex-shrink:0;width:36px;text-align:center}
        .pub-process-body{flex:1;min-width:0}
        .pub-process-title{font-size:14px;font-weight:900;color:var(--navy);margin-bottom:2px}
        .pub-process-text{font-size:13px;color:var(--mute);line-height:1.5}
        .pub-payment{}
        .pub-pay-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:6px}
        .pub-pay-card{background:#fff;border-top:4px solid var(--crimson);border-radius:11px;padding:18px 20px}
        .pub-pay-card:nth-child(2){border-top-color:var(--gold)}
        .pub-pay-card:nth-child(3){border-top-color:var(--success)}
        .pub-pay-step{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.4px;margin-bottom:10px}
        .pub-pay-amt{font-size:24px;font-weight:900;color:var(--navy);margin-bottom:6px}
        .pub-pay-when{font-size:12px;color:var(--mute);line-height:1.5}
        .pub-license{}
        .pub-license-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:6px}
        .pub-lic-badge{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--bord);border-left:4px solid var(--success);border-radius:11px;padding:14px 16px}
        .pub-lic-badge>span{width:34px;height:34px;border-radius:50%;background:var(--success);color:#fff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .pub-lic-logo{width:48px;height:48px;object-fit:contain;flex-shrink:0;background:#fff;border-radius:6px;padding:4px}
        .pub-mat-logo{max-width:160px;height:48px;object-fit:contain;display:block;margin-bottom:8px}
        .pub-lic-badge>div{display:flex;flex-direction:column;gap:2px;min-width:0}
        .pub-lic-badge strong{font-size:13px;font-weight:900;color:var(--navy)}
        .pub-lic-badge em{font-size:11px;color:var(--mute);font-style:normal}
        .pub-notincluded{}
        .pub-not-list{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
        .pub-not-list li{display:flex;gap:10px;align-items:flex-start;background:var(--cream);border-radius:9px;padding:11px 14px;font-size:13px;color:var(--text);line-height:1.5}
        .pub-not-list li span{color:#9CA3AF;font-weight:900;font-size:16px;flex-shrink:0;line-height:1}
        .pub-guarantee{display:flex;gap:22px;align-items:center;background:linear-gradient(135deg,var(--navy),#16305E);color:#fff;border-radius:16px;padding:26px 30px}
        .pub-guarantee-badge{flex-shrink:0}
        .pub-guarantee-seal{width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,var(--gold),#A8730B);color:#fff;font-size:24px;font-weight:900;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 0 0 4px var(--gold)}
        .pub-guarantee-body{flex:1;min-width:0}
        .pub-guarantee-eyebrow{font-size:10px;font-weight:900;letter-spacing:1.6px;color:var(--gold);margin-bottom:6px}
        .pub-guarantee-body h3{font-size:22px;font-weight:900;margin-bottom:8px;color:#fff}
        .pub-guarantee-body p{font-size:14px;color:rgba(255,255,255,.8);line-height:1.6}
        .pub-testimonials{}
        .pub-testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:6px}
        .pub-testi-card{background:#fff;border:1px solid var(--bord);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:10px}
        .pub-testi-stars{color:var(--gold);font-size:14px;letter-spacing:2px}
        .pub-testi-text{font-size:13px;color:var(--text);line-height:1.6;font-style:italic;flex:1}
        .pub-testi-name{font-size:12px;color:var(--mute);padding-top:8px;border-top:1px solid var(--bord)}
        .pub-testi-name strong{color:var(--navy);font-weight:800}
        .pub-rep{}
        .pub-rep-card{background:#fff;border:2px solid var(--bord);border-radius:14px;padding:18px 20px;display:flex;align-items:center;gap:16px}
        .pub-rep-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--crimson),#7c1410);color:#fff;font-size:26px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .pub-rep-info{flex:1;min-width:0}
        .pub-rep-eyebrow{font-size:10px;font-weight:900;color:var(--mute);letter-spacing:1.4px;margin-bottom:4px}
        .pub-rep-name{font-size:18px;font-weight:900;color:var(--navy);margin-bottom:2px}
        .pub-rep-title{font-size:12px;color:var(--mute)}
        .pub-rep-cta{display:flex;gap:8px;flex-shrink:0}
        .pub-rep-btn{background:var(--crimson);color:#fff;border:none;padding:10px 16px;border-radius:9px;font-size:13px;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-family:inherit;cursor:pointer}
        .pub-rep-btn:hover{filter:brightness(1.1)}
        .pub-rep-btn.outline{background:transparent;color:var(--crimson);border:2px solid var(--crimson)}
        .pub-rep-btn.outline:hover{background:var(--crimson);color:#fff}
        .pub-faq{}
        .pub-faq-list{display:flex;flex-direction:column;gap:8px;margin-top:6px}
        .pub-faq-item{background:#fff;border:1px solid var(--bord);border-radius:10px;overflow:hidden}
        .pub-faq-item.open{border-color:var(--crimson)}
        .pub-faq-q{width:100%;background:none;border:none;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-family:inherit;text-align:left;font-size:14px;font-weight:700;color:var(--navy)}
        .pub-faq-chev{color:var(--crimson);font-weight:900;font-size:20px;flex-shrink:0;width:22px;text-align:center}
        .pub-faq-a{padding:0 18px 16px;font-size:13px;color:var(--mute);line-height:1.6}
        .pub-accepted{background:#fff;border:3px solid #10B981;border-radius:18px;padding:36px 24px;text-align:center}
        .pub-accepted-icon{width:64px;height:64px;border-radius:50%;background:#10B981;color:#fff;font-size:36px;font-weight:900;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
        .pub-accepted h2{font-size:24px;color:#065F46;font-weight:900;margin-bottom:8px}
        .pub-accepted p{color:var(--mute);max-width:520px;margin:0 auto 18px;font-size:14px}
        .pub-btn-outline{display:inline-block;color:var(--crimson);background:none;border:2px solid var(--crimson);border-radius:9px;padding:12px 24px;font-weight:800;text-decoration:none;font-size:13px;min-height:44px}
        .pub-btn-outline:hover{background:var(--crimson);color:#fff}
        .pub-terms{padding:18px 22px;background:#fff;border-radius:12px;border:1px solid var(--bord)}
        .pub-terms h3{font-size:13px;font-weight:800;color:var(--navy);margin-bottom:8px;letter-spacing:1px}
        .pub-terms p{font-size:11.5px;color:var(--mute);line-height:1.6}
        .pub-footer{background:var(--navy);color:#94a3b8;text-align:center;padding:18px 22px;font-size:11px;letter-spacing:.5px}
        .pub-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px}
        .pub-modal{background:#fff;border-radius:16px;padding:26px;max-width:480px;width:100%;box-shadow:0 24px 80px rgba(0,0,0,.3)}
        .pub-modal h3{font-size:18px;font-weight:900;color:var(--navy);margin-bottom:14px}
        .pub-modal-sum{background:var(--cream);border-radius:10px;padding:13px 15px;margin-bottom:18px;font-size:14px}
        .pub-modal-sum span{font-size:12px;color:var(--mute)}
        .pub-sig-wrap{margin-bottom:18px}
        .pub-sig{width:100%;height:200px;border:2px solid var(--bord);border-radius:9px;background:#fff;cursor:crosshair;touch-action:none;display:block}
        .pub-sig-bar{display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;color:var(--mute)}
        .pub-sig-bar button{background:none;border:none;color:var(--crimson);font-weight:700;cursor:pointer;font-size:12px;padding:6px 8px}
        .pub-modal-btns{display:flex;gap:10px}
        .pub-modal-btns button{flex:1;padding:14px;border-radius:9px;font-size:15px;font-weight:800;cursor:pointer;border:none;font-family:inherit;min-height:48px}
        .pub-btn-primary{background:var(--crimson);color:#fff}
        .pub-btn-primary:disabled{background:#ccc;cursor:not-allowed}
        .pub-btn-back{background:transparent;color:var(--mute);border:1.5px solid var(--bord) !important}
        .pub-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}
        .pub-lightbox img{max-width:100%;max-height:100%;border-radius:8px}
        .pub-lightbox-close{position:absolute;top:18px;right:22px;background:rgba(255,255,255,.15);border:none;color:#fff;width:42px;height:42px;border-radius:50%;font-size:26px;cursor:pointer;font-weight:300}
        @media(max-width:780px){
          .pub-tiers{grid-template-columns:1fr}
          .pub-tier.pop{transform:none}
          .pub-scope-grid{grid-template-columns:repeat(2,1fr)}
          .pub-name{font-size:26px}
          .pub-hero{flex-direction:column;align-items:flex-start;gap:12px}
          .pub-hero-sub{text-align:left}
          .pub-main{padding:24px 16px 40px;gap:28px}
          .pub-cover-text{font-size:14px}
          .pub-tier{padding:18px}
          .pub-tier-name{font-size:22px}
          .pub-tier-price{font-size:32px}
          .pub-sig{height:240px}
          .pub-modal{padding:20px}
          .pub-modal h3{font-size:17px}
          .pub-photo-grid{grid-template-columns:repeat(2,1fr)}
          .pub-about-stats{grid-template-columns:repeat(2,1fr)}
          .pub-mat-grid{grid-template-columns:1fr}
          .pub-pay-grid{grid-template-columns:1fr}
          .pub-license-grid{grid-template-columns:1fr}
          .pub-not-list{grid-template-columns:1fr}
          .pub-testi-grid{grid-template-columns:1fr}
          .pub-rep-card{flex-direction:column;text-align:center;align-items:center}
          .pub-guarantee{flex-direction:column;text-align:center;padding:22px}
          .pub-guarantee-seal{width:80px;height:80px;font-size:20px}
          .pub-process-step{flex-wrap:wrap}
          .pub-process-icon{display:none}
          .pub-quality-pillars{grid-template-columns:1fr}
          .pub-benefits-grid{grid-template-columns:1fr}
          .pub-cost-grid{grid-template-columns:1fr}
          .pub-cost{padding:18px}
          .pub-experience-options{grid-template-columns:1fr}
          .pub-partners-grid{grid-template-columns:1fr}
          .pub-experience{padding:22px 20px}
          .pub-experience>h3{font-size:20px}
        }
      `}</style>
    </>
  )
}

function MatCard({ logo, name, tag, warr }) {
  return (
    <div className="pub-mat-card">
      {logo?.url
        ? <img src={logo.url} alt={name} className="pub-mat-logo" />
        : <div className="pub-mat-name">{name}</div>}
      <div className="pub-mat-tag">{tag}</div>
      <div className="pub-mat-warr">{warr}</div>
    </div>
  )
}

function LicBadge({ logo, title, sub }) {
  return (
    <div className="pub-lic-badge">
      {logo?.url
        ? <img src={logo.url} alt={title} className="pub-lic-logo" />
        : <span>✓</span>}
      <div>
        <strong>{title}</strong>
        <em>{sub}</em>
      </div>
    </div>
  )
}

function Center({ children }) {
  return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', color:'#4A5568', textAlign:'center', padding:'24px' }}>{children}</div>
}
