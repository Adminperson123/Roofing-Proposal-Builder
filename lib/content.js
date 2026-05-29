/**
 * lib/content.js — SINGLE SOURCE OF TRUTH for proposal narrative copy.
 *
 * The web proposal (pages/p/[id].js), the in-home presentation deck
 * (pages/present/[id].js), and the downloadable PDF
 * (pages/api/proposal/[id]/pdf.js) all import their shared text from here so
 * the three formats can never drift apart again. Edit the words ONCE, here.
 *
 * What lives here: static narrative copy only — section headers, body
 * paragraphs, testimonials, materials, benefits, FAQs, etc.
 * What does NOT live here: per-proposal data (customer, tiers, price, photos)
 * which comes from the database, and per-format chrome (emoji prefixes on the
 * proposal, slide nav on the deck, page bands in the PDF) which each consumer
 * adds itself. `icon` fields are decoration the web formats use and the PDF
 * ignores — react-pdf does not render emoji.
 *
 * Master copy = the web proposal. Where the deck or PDF previously had tighter
 * or differently-worded copy, the proposal wording wins.
 */

export const COMPANY = {
  name:        'Good People Roofing',
  legalName:   'Good People Roofing Inc.',
  license:     'CA Lic. C39 #1126880',
  phoneTel:    '+18447663709',
  phoneLabel:  '(844) ROOFS-09',
  website:     'goodpeopleroofinginc.com',
  email:       'info@goodpeoplehi.com',
  liability:   '$2M General Liability',
  footer:      'Good People Roofing Inc.  ·  goodpeopleroofinginc.com  ·  (844) ROOFS-09  ·  CA Lic. C39 #1126880',
}

export const TIER_LABELS = { good: 'ESSENTIAL', better: 'PERFORMANCE', best: 'SIGNATURE' }
export const TIER_COLORS = { good: '#4A5568', better: '#B01E17', best: '#D4960E' }

/* ── Financing (illustrative monthly payment on the tier cards) ── */
export const FINANCING = { aprPct: 7.99, termMonths: 120 }
export function monthly(principal, aprPct = FINANCING.aprPct, term = FINANCING.termMonths) {
  const r = (aprPct / 100) / 12
  if (!r) return Math.round(principal / term)
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -term)))
}
export const FINANCING_NOTE = `Financing illustration uses ${FINANCING.aprPct}% APR over ${FINANCING.termMonths / 12} years. Actual rates depend on credit; ask your rep for full terms.`

/* ── Payment milestones — the three-step schedule. `fallback` is the
   pre-selection display; once a tier is chosen the consumer computes dollars
   via paymentSplit(total). ── */
export function paymentSplit(total) {
  const deposit = Math.min(1000, Math.round(total * 0.10))
  const start   = Math.round(total * 0.50)
  return { deposit, start, final: total - deposit - start }
}
export const PAYMENT = {
  eyebrow: 'PAYMENT SCHEDULE',
  sub: 'Three simple milestones. No hidden charges.',
  milestones: [
    { step: '1 · DEPOSIT',    fallback: '$1,000 or 10%', when: 'Due upon signing — locks your install slot' },
    { step: '2 · START',      fallback: '50%',           when: 'Due the morning the crew begins tear-off' },
    { step: '3 · COMPLETION', fallback: 'Balance',       when: 'Due after final walkthrough — only if you are happy' },
  ],
}

/* ── About us ── */
export const ABOUT = {
  eyebrow: 'ABOUT GOOD PEOPLE ROOFING',
  emoji: '🏠',
  title: 'A family-built Southern California roofing company',
  body: "We are a family-built Southern California roofing company, fully licensed (CA Lic. C39 #1126880) and insured, with a simple promise: we treat your home the way we would treat our own mother's. No high-pressure sales. No surprise charges. Every job is run by a project lead who is on-site daily, and every roof is inspected by a senior estimator before we hand you the keys back.",
  stats: [
    { n: '1,200+', l: 'Roofs installed' },
    { n: '4.9★',   l: 'Average review' },
    { n: '10+',    l: 'Years serving SoCal' },
    { n: '100%',   l: 'Cleanup guarantee' },
  ],
}

/* ── Families we've helped ── */
export const FAMILIES = {
  eyebrow: "FAMILIES WE'VE HELPED",
  emoji: '👨‍👩‍👧',
  title: '1,200+ neighbors have trusted us with their roof',
  sub: '1,200+ Southern California homeowners have trusted Good People with their roof. Here is what a few of your neighbors said.',
}
export const TESTIMONIALS = [
  { name: 'Maria S.',   city: 'Yucaipa, CA',    stars: 5, text: 'Crew showed up on time, treated my home like their own, and finished a full tear-off in two days. Roof looks incredible.' },
  { name: 'Daniel R.',  city: 'Redlands, CA',   stars: 5, text: 'Honest pricing, no surprises, and they walked me through every option. Easiest contractor experience I have ever had.' },
  { name: 'Carolyn P.', city: 'San Bernardino', stars: 5, text: 'Wind storm took out half my ridge. They had a crew here within a week and the workmanship was flawless.' },
]

/* ── Materials & partnerships ── */
export const MATERIALS_SECTION = {
  eyebrow: 'MATERIALS WE USE & PARTNERSHIPS',
  emoji: '🏭',
  title: 'We only install materials we have personally vetted',
  sub: 'We only install materials from manufacturers we have personally vetted on hundreds of installs. Every product carries its own multi-decade manufacturer warranty on top of our workmanship guarantee.',
}
// logoKey maps to /api/brand-assets keys (used by the proposal page).
export const MATERIALS = [
  { name: 'GAF',            logoKey: 'gaf',           tag: 'Timberline HDZ / UHDZ Architectural Shingles',  warr: 'Up to Lifetime Limited Warranty' },
  { name: 'Owens Corning',  logoKey: 'owens_corning', tag: 'Duration / Duration COOL Series',               warr: 'Lifetime + WindProven™ Limited' },
  { name: 'Westlake Royal', logoKey: 'westlake',      tag: 'Concrete & clay tile, premium accessory products', warr: '50-year limited transferable' },
  { name: 'Eagle Roofing',  logoKey: 'eagle',         tag: 'Concrete Tile (flat & S-type)',                 warr: '50-year limited transferable' },
  { name: 'Titanium',       logoKey: 'titanium',      tag: 'High-performance synthetic underlayments',      warr: 'Up to lifetime limited' },
  { name: 'Boral',          logoKey: 'boral',         tag: 'Specialty tile + accessory products',           warr: 'Limited lifetime on select lines' },
]
export const PARTNERS = [
  { name: 'QXO',             tag: 'National roofing distributor — preferred pricing, faster delivery, full warranty registration support.' },
  { name: 'SRS Distribution', tag: 'Largest US roofing distributor — full inventory access, dedicated account management, certified-contractor benefits.' },
]

/* ── Understanding your roof (scope) ── */
export const SCOPE = {
  eyebrow: 'UNDERSTANDING YOUR ROOF',
  emoji: '🔍',
  title: "Here's what we captured during your inspection",
  sub: 'These are the measurements we captured during your inspection. They drive every part of this proposal — from how many bundles arrive on the truck to the warranty class we can offer.',
}

/* ── Same workmanship, 3 quality levels ── */
export const QUALITY = {
  eyebrow: 'SAME WORKMANSHIP — 3 QUALITY LEVELS',
  emoji: '⚖️',
  title: 'Every homeowner has a different budget and need',
  body: 'Every roof we install gets the same crew, the same daily cleanups, and the same senior inspector signing off at the end. The difference between our three options is only the materials — what they are made of, how long they last, and how much the manufacturer warranty covers. There is no wrong answer. Pick the level that fits your home and your budget.',
  pillars: [
    { t: 'Same crew, every tier', b: 'Installed by our W-2 employees — never day-laborers.' },
    { t: 'Same standards',        b: 'Same safety practices, same flashing details, same final sweep.' },
    { t: 'Different materials',   b: 'Shingle composition, tile weight, granule mix, warranty class.' },
  ],
}

/* ── Choose your package (tiers intro) ── */
export const TIERS_INTRO = {
  title: 'CHOOSE YOUR PACKAGE',
  sub: 'Essential, Performance, or Signature. Same workmanship across all three — different materials and warranties. Pick the one that fits your home and your budget.',
}

/* ── Top benefits of a new roof ── */
export const BENEFITS_SECTION = { eyebrow: 'TOP BENEFITS OF A NEW ROOF', emoji: '📈', title: 'What a new roof actually does for you' }
export const BENEFITS = [
  { icon: '🛡', t: 'Protection that lasts decades',     b: 'A new roof eliminates daily worry about leaks and ceiling stains. Modern shingles and tile carry 30-year to lifetime manufacturer warranties.' },
  { icon: '💰', t: 'Higher resale & appraisal value',   b: 'Realtors consistently rank a recent roof in the top three improvements that move appraisal numbers. Most California buyers ask for the roof receipt before they offer.' },
  { icon: '⚡', t: 'Lower energy bills',                b: 'Cool-rated shingles like Owens Corning Duration COOL reflect sunlight, drop attic temps by up to 20°F, and trim summer A/C costs.' },
  { icon: '📋', t: 'Insurance peace of mind',           b: "Many SoCal insurers now require a roof under 20 years old to keep your homeowner's policy. A new roof keeps coverage in good standing." },
  { icon: '🏡', t: 'Curb appeal that gets noticed',     b: 'Architectural shingles and concrete tile come in modern color palettes that update the entire look of your home from the street.' },
  { icon: '🌬', t: 'Wind & storm rating you can trust', b: 'Our installs are rated for up to 130 mph wind. Ridge vents, drip edge upgrades, and ice-and-water shield options lock in the upper end.' },
]

/* ── The cost of doing nothing ── */
export const COST = {
  eyebrow: 'THE COST OF DOING NOTHING',
  emoji: '⚠️',
  title: 'Roofs do not get cheaper to fix',
  // Full sub (proposal renders this as one paragraph). subShort drops the
  // leading "Roofs do not get cheaper to fix." since the deck/PDF show that
  // sentence as a headline above the body.
  sub: 'Roofs do not get cheaper to fix. Waiting another season usually means the cost stacks — and the surprise repairs start showing up inside the house.',
  subShort: 'Waiting another season usually means the cost stacks — and the surprise repairs start showing up inside the house.',
  steps: [
    { year: 'YEAR 1 OF WAITING',  b: 'Small leaks find weak shingles after the first big storm. You replace one ceiling tile and a section of drywall — typically $400 to $900 in interior repair.' },
    { year: 'YEAR 2 OF WAITING',  b: 'Water reaches the decking. Now you are budgeting for the same roof plus 8 to 14 sheets of plywood at $85 each — a $700 to $1,200 line item we would have avoided.' },
    { year: 'YEAR 3+ OF WAITING', b: "Mold inside walls, insulation replacement, rafters needing sister-boards, often a homeowner's-insurance non-renewal letter. Average total: 2-3× the cost of doing the roof today." },
  ],
  cta: 'The single biggest predictor of roof cost is how long you wait to start.',
}

/* ── What happens after you sign — install in 5 steps ── */
export const PROCESS_SECTION = { eyebrow: 'WHAT HAPPENS AFTER YOU SIGN', emoji: '📅', title: 'Your install in 5 simple steps' }
export const PROCESS_STEPS = [
  { icon: '✍️', title: 'Sign your proposal',         body: 'Pick a tier, sign on this page, and your project is officially scheduled.' },
  { icon: '📅', title: 'Pre-install walkthrough',    body: 'Your rep visits to confirm color choices, pull permits if needed, and lock the install date.' },
  { icon: '🚚', title: 'Materials delivered',        body: 'Manufacturer-fresh shingles or tile delivered to your driveway 1–2 days before install.' },
  { icon: '🔨', title: 'Tear-off & install',         body: 'Crew tears off old layers, inspects decking, and installs your new system. Most homes finish in 1–2 days.' },
  { icon: '✅', title: 'Final inspection & cleanup', body: 'Magnetic sweep, daily site cleanup, and a final walkthrough so you sign off happy.' },
]

/* ── It's not just a roof — it's an experience ── */
export const EXPERIENCE = {
  eyebrow: 'THE GOOD PEOPLE DIFFERENCE',
  title: "It's not just a roof. It's an entire experience.",
  intro: 'Most contractors stop calling you back the moment the deposit clears. We do the opposite. Every project we run gets its own live communication channel — your choice:',
  options: [
    { icon: '💬', t: 'Group text thread',   b: 'One group with everyone who matters: you, your spouse, the project manager, the crew lead. Live photos throughout the day. Ask anything, anytime.' },
    { icon: '🔗', t: 'Shared progress link', b: 'A private project page anyone you trust can open. Photo progress, materials delivery times, weather pauses, schedule confirmation — all on one page.' },
  ],
  promise: 'Either way: you will never wonder what is happening with your roof. Ever.',
}

/* ── Our guarantee ── */
export const GUARANTEE = {
  eyebrow: 'OUR GUARANTEE',
  seal: '100%',
  title: 'Done right or we make it right.',
  body: "If anything about the install is not what we promised — a leak, a missed flashing, a cleanup we missed — we come back, on our dime, until it is right. That promise lasts the full term of your tier's workmanship warranty, in writing.",
}

/* ── Fully licensed & insured ── */
export const LICENSE_SECTION = { eyebrow: 'FULLY LICENSED & INSURED', emoji: '🛡' }
export const LICENSE_BADGES = [
  { logoKey: 'cslb',          title: 'CA Lic. C39 #1126880',  sub: 'CSLB roofing classification' },
  { logoKey: 'liability',     title: '$2M General Liability', sub: 'Verified annually' },
  { logoKey: 'workers_comp',  title: "Workers' Comp",         sub: 'Covers our crew on your property' },
  { logoKey: 'gaf_certified', title: 'Manufacturer Certified', sub: 'GAF, Owens Corning, Eagle' },
]

/* ── What's not included ── */
export const NOT_INCLUDED_SECTION = {
  eyebrow: "WHAT'S NOT INCLUDED",
  emoji: '📝',
  sub: 'Being upfront beats surprises. Anything below is either out of scope or quoted separately when needed.',
}
export const NOT_INCLUDED = [
  'Interior repairs (drywall, paint, ceiling damage from prior leaks)',
  'Solar panel removal and reset (priced separately as add-on)',
  'Skylight replacement (we re-flash existing skylights — replacement is a separate quote)',
  'Gutter replacement (priced separately as add-on)',
  'HVAC unit relocation if mounted on the roof',
  'Permit fees that exceed the listed amount (rare; covered transparently)',
]

/* ── Your dedicated rep ── */
export const REP = { eyebrow: 'YOUR DEDICATED REP' }

/* ── FAQ ── */
export const FAQ_SECTION = { eyebrow: 'FREQUENTLY ASKED QUESTIONS', emoji: '❓' }
export const FAQS = [
  { q: 'How long does the install take?',            a: 'Most single-family homes finish in 1–2 working days. Larger or steeper roofs may run 3 days. We will give you a firm window during the pre-install walkthrough.' },
  { q: 'Do I need to be home during the install?',   a: 'You do not. Most of our customers go to work as usual. Our crew leads will text you progress photos throughout the day.' },
  { q: 'What happens if it rains?',                  a: 'We monitor weather hourly. If rain is forecast, we reschedule before tear-off begins. Your home is never left exposed overnight — we tarp and seal at the end of every day.' },
  { q: 'How is my landscaping protected?',           a: 'We tarp around the perimeter, move patio furniture, and run a magnetic sweep at the end of each day for stray nails. Damage caused by our crew is fully covered by our liability insurance.' },
  { q: 'When do I pay?',                             a: 'A small deposit ($1,000 or 10%, whichever is less) holds your install slot. 50% is due the day work starts. The balance is due upon completion and your final walkthrough.' },
  { q: 'What if my decking is rotten underneath?',   a: 'We do not know until we tear off. Standard pricing includes ~1 sheet per 3 squares. Anything beyond that is a transparent $85/sheet Change Order you sign before we proceed.' },
  { q: 'Are you licensed and insured?',              a: 'Yes. CA Lic. C39 #1126880, fully bonded, $2M general liability + workers comp. Verification documents are available on request.' },
  { q: 'What does the warranty actually cover?',     a: "Workmanship warranty covers any leak or installation defect for the period stated in your tier. Manufacturer warranty covers material defects per the brand's terms — we register every roof on your behalf the day after install." },
  { q: 'Do you handle insurance claims?',            a: 'Yes. If your roof was damaged by storm or hail, we coordinate directly with your insurance adjuster, document the damage, and submit supplements when needed.' },
  { q: 'Can I see past projects in my neighborhood?', a: 'Absolutely. Ask your rep — we will share before/after photos and addresses of nearby installs you can drive by.' },
]

/* ── Terms ── */
export const TERMS = {
  title: 'Terms',
  body: 'This proposal is valid for 14 days. Deposit: $1,000 or 10% (whichever is less) due upon signing · 50% at start · balance upon completion. Wood repairs, extra layers, and permit costs added via signed Change Order. CA Lic. C39 #1126880. Fully licensed and insured.',
}
