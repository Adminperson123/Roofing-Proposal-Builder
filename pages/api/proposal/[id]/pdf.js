import React from 'react'
import { renderToStream, Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import { serverClient } from '../../../../lib/supabase'

export const config = { maxDuration: 30 }

const NAVY = '#0C1C38'
const CRIMSON = '#B01E17'
const GOLD = '#D4960E'
const CREAM = '#F7F6F3'
const TEXT = '#1A1A2E'
const MUTED = '#4A5568'
const BORDER = '#E2E0DB'
const TIER_COLORS = { good: '#4A5568', better: CRIMSON, best: GOLD }

/* ── Framework content — mirrors the web proposal and presentation deck ── */
const ABOUT_PARA = 'We are a family-built Southern California roofing company, fully licensed (CA Lic. C39 #1126880) and insured, with one simple promise: we treat your home the way we would treat our own mother’s. No high-pressure sales, no surprise charges. Every job is run by a project lead who is on-site daily, and every roof is inspected by a senior estimator before we hand you the keys back.'
const ABOUT_STATS = [['1,200+', 'Roofs installed'], ['4.9 / 5', 'Average review'], ['10+ yrs', 'Serving SoCal'], ['100%', 'Cleanup guarantee']]
const TESTIMONIALS = [
  { name: 'Maria S.',   city: 'Yucaipa, CA',    text: 'Crew showed up on time, treated my home like their own, and finished a full tear-off in two days.' },
  { name: 'Daniel R.',  city: 'Redlands, CA',   text: 'Honest pricing, no surprises, and they walked me through every option. Easiest contractor experience ever.' },
  { name: 'Carolyn P.', city: 'San Bernardino', text: 'Wind storm took out half my ridge. They had a crew here within a week and the workmanship was flawless.' },
]
const MATERIALS = [
  ['GAF', 'Timberline HDZ / UHDZ shingles'], ['Owens Corning', 'Duration / Duration COOL'],
  ['Westlake Royal', 'Concrete & clay tile'], ['Eagle Roofing', 'Concrete tile, flat & S-type'],
  ['Titanium', 'Synthetic underlayments'],   ['Boral', 'Specialty tile & accessories'],
]
const PARTNERS = [
  ['QXO', 'National roofing distributor — preferred pricing and faster delivery.'],
  ['SRS Distribution', 'Largest US roofing distributor — full inventory and warranty support.'],
]
const QUALITY_PARA = 'One of the biggest things that separates us: we know every homeowner has a different budget and a different need. So we offer the same workmanship at all three levels — same crew, same standards, same senior inspector signing off. The only difference between the three tiers is the materials.'
const QUALITY_PILLARS = [
  ['Same crew, every tier', 'Installed by our W-2 employees — never day-laborers.'],
  ['Same standards', 'Same safety practices, same flashing details, same final sweep.'],
  ['Different materials', 'Shingle composition, tile weight, granule mix, warranty class.'],
]
const BENEFITS = [
  ['Protection for decades', 'No more daily worry about leaks or ceiling stains — 30-year to lifetime warranties.'],
  ['Higher resale value', 'A recent roof is a top-three improvement that moves appraisal numbers.'],
  ['Lower energy bills', 'Cool-rated shingles reflect sunlight and trim summer A/C costs.'],
  ['Insurance peace of mind', 'Many SoCal insurers require a roof under 20 years old to keep coverage.'],
  ['Curb appeal', 'Modern color palettes update the whole look of the home from the street.'],
  ['Wind & storm rated', 'Installs rated up to 130 mph wind with ridge vents and drip-edge upgrades.'],
]
const PROCESS_STEPS = [
  ['Sign your proposal', 'Pick a tier, sign, and your project is officially scheduled.'],
  ['Pre-install walkthrough', 'Your rep confirms colors, pulls permits, and locks the install date.'],
  ['Materials delivered', 'Manufacturer-fresh materials delivered 1-2 days before install.'],
  ['Tear-off & installation', 'Old layers off, decking inspected, new system on — most homes in 1-2 days.'],
  ['Final inspection & cleanup', 'Magnetic sweep, daily cleanup, and a final walkthrough so you sign off happy.'],
]
const COST_STEPS = [
  ['YEAR 1 OF WAITING', 'Small leaks find weak shingles after the first big storm. You replace a ceiling tile and a section of drywall — typically $400 to $900 in interior repair.'],
  ['YEAR 2 OF WAITING', 'Water reaches the decking. Now you are budgeting for the same roof PLUS 8 to 14 sheets of plywood at $85 each — a $700 to $1,200 line item we would have avoided.'],
  ['YEAR 3+ OF WAITING', 'Mold inside walls, insulation replacement, rafters needing sister-boards, often a homeowner-insurance non-renewal letter. Average total: 2-3x the cost of doing the roof today.'],
]

const s = StyleSheet.create({
  page:        { padding: 36, paddingBottom: 56, fontSize: 10, color: TEXT, fontFamily: 'Helvetica' },
  header:      { backgroundColor: NAVY, padding: 14, marginBottom: 14, borderBottomWidth: 3, borderBottomColor: CRIMSON, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand:       { color: GOLD, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  brandSub:    { color: '#94a3b8', fontSize: 7, marginTop: 2 },
  propNumLbl:  { color: '#94a3b8', fontSize: 8 },
  propNum:     { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  propDate:    { color: '#94a3b8', fontSize: 8, marginTop: 2 },
  validity:    { color: '#34d399', fontSize: 7, marginTop: 2 },
  pageBand:    { backgroundColor: NAVY, padding: 9, marginBottom: 14, borderBottomWidth: 2, borderBottomColor: CRIMSON, flexDirection: 'row', justifyContent: 'space-between' },
  pageBandTxt: { color: GOLD, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.6 },
  pageBandSub: { color: '#94a3b8', fontSize: 8 },
  twoCol:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  box:         { flex: 1, backgroundColor: CREAM, padding: 10, borderRadius: 5 },
  boxLbl:      { color: '#94a3b8', fontSize: 7, fontWeight: 'bold', marginBottom: 3, letterSpacing: 0.5 },
  boxName:     { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  boxLine:     { fontSize: 8, color: MUTED, marginTop: 1 },
  cover:       { fontSize: 10, color: TEXT, lineHeight: 1.5, marginBottom: 14, paddingHorizontal: 4, fontStyle: 'italic' },
  eyebrow:     { fontSize: 8, fontWeight: 'bold', color: CRIMSON, letterSpacing: 1, marginBottom: 3 },
  secTitle:    { fontSize: 13, fontWeight: 'bold', color: NAVY, marginBottom: 6 },
  body:        { fontSize: 9, color: MUTED, lineHeight: 1.5, marginBottom: 10 },
  section:     { marginBottom: 16 },
  statRow:     { flexDirection: 'row', gap: 6 },
  statCard:    { flex: 1, backgroundColor: CREAM, borderRadius: 5, padding: 8, alignItems: 'center' },
  statN:       { fontSize: 14, fontWeight: 'bold', color: CRIMSON },
  statL:       { fontSize: 6.5, color: MUTED, marginTop: 2, textAlign: 'center' },
  cardRow:     { flexDirection: 'row', gap: 6, marginBottom: 6 },
  card:        { flex: 1, backgroundColor: CREAM, borderRadius: 5, padding: 9 },
  cardName:    { fontSize: 9.5, fontWeight: 'bold', color: NAVY, marginBottom: 2 },
  cardTag:     { fontSize: 7.5, color: MUTED, lineHeight: 1.35 },
  testiText:   { fontSize: 7.5, color: TEXT, lineHeight: 1.4, fontStyle: 'italic', marginBottom: 4 },
  testiName:   { fontSize: 7, color: MUTED },
  scopeRow:    { flexDirection: 'row', gap: 6 },
  scopeCard:   { flex: 1, backgroundColor: CREAM, borderRadius: 5, padding: 9 },
  scopeLbl:    { fontSize: 6.5, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 3 },
  scopeVal:    { fontSize: 11, fontWeight: 'bold', color: NAVY },
  tierTitle:   { fontSize: 12, fontWeight: 'bold', color: NAVY, marginBottom: 7, letterSpacing: 0.5 },
  tierGrid:    { flexDirection: 'row', gap: 6 },
  tierCard:    { flex: 1, borderWidth: 2, borderRadius: 6, padding: 9 },
  tierBadge:   { color: '#fff', textAlign: 'center', padding: 3, fontSize: 8, fontWeight: 'bold', borderRadius: 3, marginBottom: 6 },
  tierName:    { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  tierTag:     { fontSize: 7, color: MUTED, marginBottom: 5 },
  tierPrice:   { fontSize: 17, fontWeight: 'bold', marginBottom: 1 },
  tierPsf:     { fontSize: 7, color: MUTED, marginBottom: 5 },
  tierMat:     { fontSize: 8, fontWeight: 'bold', color: TEXT, marginBottom: 1 },
  tierBrand:   { fontSize: 7, color: MUTED, marginBottom: 4 },
  tierWarr:    { fontSize: 8, fontWeight: 'bold', marginBottom: 6 },
  tierFeat:    { fontSize: 7.5, color: MUTED, marginBottom: 2, lineHeight: 1.35 },
  selectedBox: { backgroundColor: '#FEF3C7', padding: 9, borderRadius: 5, marginTop: 10, borderLeftWidth: 3, borderLeftColor: GOLD },
  selTitle:    { fontSize: 9, fontWeight: 'bold', color: '#92400E', marginBottom: 5, letterSpacing: 0.5 },
  selRow:      { flexDirection: 'row', justifyContent: 'space-between', fontSize: 9, color: MUTED, paddingVertical: 1.5 },
  selTot:      { borderTopWidth: 0.5, borderTopColor: '#D9A441', marginTop: 3, paddingTop: 4, fontWeight: 'bold' },
  selLine:     { fontSize: 7.5, color: MUTED, marginTop: 4 },
  benefitCard: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 5, padding: 9 },
  benefitT:    { fontSize: 9, fontWeight: 'bold', color: NAVY, marginBottom: 2 },
  benefitB:    { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  costCard:    { flex: 1, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', borderRadius: 6, padding: 9 },
  costYear:    { fontSize: 8, fontWeight: 'bold', color: '#991B1B', marginBottom: 4, letterSpacing: 0.6 },
  costBody:    { fontSize: 8, color: TEXT, lineHeight: 1.4 },
  costCta:     { backgroundColor: '#991B1B', color: '#fff', textAlign: 'center', padding: 9, borderRadius: 5, fontSize: 9, marginTop: 8, marginBottom: 4 },
  step:        { flexDirection: 'row', gap: 9, backgroundColor: CREAM, borderRadius: 5, padding: 9, marginBottom: 6, alignItems: 'center' },
  stepNum:     { width: 20, height: 20, borderRadius: 10, backgroundColor: CRIMSON, color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center', paddingTop: 5 },
  stepT:       { fontSize: 9.5, fontWeight: 'bold', color: NAVY },
  stepB:       { fontSize: 7.5, color: MUTED, marginTop: 1 },
  expBox:      { backgroundColor: NAVY, borderRadius: 6, padding: 12, marginBottom: 14 },
  expTitle:    { color: '#fff', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  expBody:     { color: '#cbd5e1', fontSize: 8.5, lineHeight: 1.45 },
  payGrid:     { flexDirection: 'row', gap: 6, marginBottom: 14 },
  payCard:     { flex: 1, backgroundColor: CREAM, borderTopWidth: 3, borderTopColor: CRIMSON, borderRadius: 5, padding: 9 },
  payStep:     { fontSize: 7.5, fontWeight: 'bold', color: MUTED, marginBottom: 5, letterSpacing: 0.6 },
  payAmt:      { fontSize: 14, fontWeight: 'bold', color: NAVY, marginBottom: 4 },
  payWhen:     { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  termsTitle:  { fontSize: 9, fontWeight: 'bold', color: NAVY, marginBottom: 3, letterSpacing: 0.5 },
  terms:       { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  footer:      { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, fontSize: 7, color: '#9CA3AF', textAlign: 'center' },
})

function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }
  catch { return '—' }
}
function money(n) { return '$' + (Number(n) || 0).toLocaleString() }

function Footer() {
  return (
    <Text style={s.footer} fixed>
      Good People Roofing Inc.  |  goodpeopleroofinginc.com  |  (844) ROOFS-09  |  CA Lic. C39 #1126880
    </Text>
  )
}
function Band({ propNum, label }) {
  return (
    <View style={s.pageBand}>
      <Text style={s.pageBandTxt}>GOOD PEOPLE ROOFING</Text>
      <Text style={s.pageBandSub}>Proposal {propNum}  ·  {label}</Text>
    </View>
  )
}

function ProposalPDF({ p, logoUrl }) {
  const tiers = p.tiers || {}
  const tierKeys = (Array.isArray(tiers._visible) && tiers._visible.length ? tiers._visible : ['good','better','best'])
    .filter(k => ['good','better','best'].includes(k))
  const date = fmtDate(p.created_at)
  const expires = p.expires_at ? fmtDate(p.expires_at) : '—'
  const sel = p.selected_tier ? tiers[p.selected_tier] : null
  const acceptedAddons = Array.isArray(p.accepted_addons) ? p.accepted_addons : []
  const basePrice = sel?.price || 0
  const total = p.accepted_total ? Number(p.accepted_total) : basePrice
  const deposit = Math.min(1000, Math.round(total * 0.10))
  const start = Math.round(total * 0.50)
  const finalPay = total - deposit - start

  return (
    <Document>
      {/* ── PAGE 1 — cover, about us, families we've helped ── */}
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View style={s.brandRow}>
            {logoUrl ? <Image src={logoUrl} style={{ width: 40, height: 40, backgroundColor: '#fff', borderRadius: 4, padding: 2 }} /> : null}
            <View>
              <Text style={s.brand}>GOOD PEOPLE ROOFING</Text>
              <Text style={s.brandSub}>HOME IMPROVEMENT  |  CA Lic. C39 #1126880  |  (844) ROOFS-09</Text>
            </View>
          </View>
          <View>
            <Text style={s.propNumLbl}>PROPOSAL</Text>
            <Text style={s.propNum}>{p.prop_num}</Text>
            <Text style={s.propDate}>{date}</Text>
            <Text style={s.validity}>Valid until {expires}</Text>
          </View>
        </View>

        <View style={s.twoCol}>
          <View style={s.box}>
            <Text style={s.boxLbl}>PREPARED FOR</Text>
            <Text style={s.boxName}>{p.customer_name}</Text>
            {p.customer_email && <Text style={s.boxLine}>{p.customer_email}</Text>}
            {p.customer_phone && <Text style={s.boxLine}>{p.customer_phone}</Text>}
            {p.customer_address && <Text style={s.boxLine}>{p.customer_address}</Text>}
          </View>
          <View style={s.box}>
            <Text style={s.boxLbl}>PREPARED BY</Text>
            <Text style={s.boxName}>Good People Roofing Inc.</Text>
            <Text style={s.boxLine}>CA Lic. C39 #1126880</Text>
            <Text style={s.boxLine}>info@goodpeoplehi.com</Text>
            {p.rep_name && <Text style={[s.boxLine, { color: CRIMSON, fontWeight: 'bold', marginTop: 2 }]}>Rep: {p.rep_name}</Text>}
          </View>
        </View>

        {p.cover_letter && <Text style={s.cover}>{p.cover_letter}</Text>}

        <View style={s.section}>
          <Text style={s.eyebrow}>ABOUT GOOD PEOPLE ROOFING</Text>
          <Text style={s.secTitle}>A family-built Southern California roofing company</Text>
          <Text style={s.body}>{ABOUT_PARA}</Text>
          <View style={s.statRow}>
            {ABOUT_STATS.map(([n, l], i) => (
              <View key={i} style={s.statCard}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>FAMILIES WE'VE HELPED</Text>
          <Text style={s.secTitle}>1,200+ neighbors have trusted us with their roof</Text>
          <View style={s.cardRow}>
            {TESTIMONIALS.map((t, i) => (
              <View key={i} style={s.card} wrap={false}>
                <Text style={s.testiText}>"{t.text}"</Text>
                <Text style={s.testiName}>{t.name} — {t.city}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 2 — materials & partnerships, understanding your roof ── */}
      <Page size="LETTER" style={s.page}>
        <Band propNum={p.prop_num} label="materials & your roof" />

        <View style={s.section}>
          <Text style={s.eyebrow}>MATERIALS WE USE & PARTNERSHIPS</Text>
          <Text style={s.secTitle}>We only install materials we have personally vetted</Text>
          <View style={s.cardRow}>
            {MATERIALS.slice(0, 3).map(([n, t], i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{n}</Text><Text style={s.cardTag}>{t}</Text></View>
            ))}
          </View>
          <View style={s.cardRow}>
            {MATERIALS.slice(3, 6).map(([n, t], i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{n}</Text><Text style={s.cardTag}>{t}</Text></View>
            ))}
          </View>
          <Text style={[s.eyebrow, { marginTop: 6 }]}>DISTRIBUTOR PARTNERSHIPS</Text>
          <View style={s.cardRow}>
            {PARTNERS.map(([n, t], i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{n}</Text><Text style={s.cardTag}>{t}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>UNDERSTANDING YOUR ROOF</Text>
          <Text style={s.secTitle}>What we captured during your inspection</Text>
          <Text style={s.body}>These measurements drive every part of this proposal — from how many bundles arrive on the truck to the warranty class we can offer.</Text>
          <View style={s.scopeRow}>
            <View style={s.scopeCard}><Text style={s.scopeLbl}>ROOF TYPE</Text><Text style={s.scopeVal}>{p.roof_type === 'tile' ? `Tile${p.tile_subtype ? ' · ' + p.tile_subtype : ''}` : 'Shingle'}</Text></View>
            <View style={s.scopeCard}><Text style={s.scopeLbl}>SQUARES</Text><Text style={s.scopeVal}>{p.squares} sq</Text></View>
            <View style={s.scopeCard}><Text style={s.scopeLbl}>PITCH</Text><Text style={s.scopeVal}>{p.pitch}/12</Text></View>
            <View style={s.scopeCard}><Text style={s.scopeLbl}>STORIES</Text><Text style={s.scopeVal}>{p.stories}</Text></View>
          </View>
          {Array.isArray(p.addons) && p.addons.length > 0 && (
            <Text style={[s.body, { marginTop: 8, marginBottom: 0 }]}>Add-ons: {p.addons.join(', ')}</Text>
          )}
          {p.inspection_notes && <Text style={[s.body, { marginTop: 4, marginBottom: 0 }]}>Notes: {p.inspection_notes}</Text>}
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 3 — same workmanship / 3 quality levels + package options ── */}
      <Page size="LETTER" style={s.page}>
        <Band propNum={p.prop_num} label="your package options" />

        <View style={s.section}>
          <Text style={s.eyebrow}>SAME WORKMANSHIP — 3 QUALITY LEVELS</Text>
          <Text style={s.secTitle}>Every homeowner has a different budget and need</Text>
          <Text style={s.body}>{QUALITY_PARA}</Text>
          <View style={s.cardRow}>
            {QUALITY_PILLARS.map(([t, b], i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{t}</Text><Text style={s.cardTag}>{b}</Text></View>
            ))}
          </View>
        </View>

        <Text style={s.tierTitle}>{tierKeys.length === 1 ? 'YOUR PACKAGE' : `YOUR ${tierKeys.length === 2 ? 'TWO' : 'THREE'} PACKAGE OPTIONS`}</Text>
        <View style={s.tierGrid}>
          {tierKeys.map(k => {
            const t = tiers[k]; if (!t) return null
            const c = TIER_COLORS[k]
            return (
              <View key={k} style={[s.tierCard, { borderColor: c }]} wrap={false}>
                <Text style={[s.tierBadge, { backgroundColor: c }]}>{(t.name || k).toUpperCase()}</Text>
                <Text style={s.tierName}>{t.name}</Text>
                <Text style={s.tierTag}>{t.tagline}</Text>
                <Text style={[s.tierPrice, { color: c }]}>{money(t.price)}</Text>
                <Text style={s.tierPsf}>${t.psf}/sq · {p.squares} squares</Text>
                <Text style={s.tierMat}>{t.material}</Text>
                <Text style={s.tierBrand}>{t.brand}</Text>
                <Text style={[s.tierWarr, { color: c }]}>{t.warranty}</Text>
                {(t.features || []).map((f, i) => (
                  <Text key={i} style={s.tierFeat}>{`+ ${f}`}</Text>
                ))}
              </View>
            )
          })}
        </View>

        {sel && (
          <View style={s.selectedBox}>
            <Text style={s.selTitle}>CUSTOMER SELECTED — {(sel.name || p.selected_tier || '').toUpperCase()}</Text>
            <View style={s.selRow}><Text>{sel.name} package</Text><Text>{money(basePrice)}</Text></View>
            {acceptedAddons.map((a, i) => (
              <View key={i} style={s.selRow}><Text>+ {a.label}</Text><Text>{money(a.price)}</Text></View>
            ))}
            <View style={[s.selRow, s.selTot]}><Text>Total</Text><Text>{money(total)}</Text></View>
            <Text style={s.selLine}>Accepted on {p.accepted_at ? new Date(p.accepted_at).toLocaleString() : '—'}</Text>
          </View>
        )}

        <Footer />
      </Page>

      {/* ── PAGE 4 — benefits + the cost of doing nothing ── */}
      <Page size="LETTER" style={s.page}>
        <Band propNum={p.prop_num} label="why now" />

        <View style={s.section}>
          <Text style={s.eyebrow}>TOP BENEFITS OF A NEW ROOF</Text>
          <Text style={s.secTitle}>What a new roof actually does for you</Text>
          <View style={s.cardRow}>
            {BENEFITS.slice(0, 3).map(([t, b], i) => (
              <View key={i} style={s.benefitCard}><Text style={s.benefitT}>{t}</Text><Text style={s.benefitB}>{b}</Text></View>
            ))}
          </View>
          <View style={s.cardRow}>
            {BENEFITS.slice(3, 6).map(([t, b], i) => (
              <View key={i} style={s.benefitCard}><Text style={s.benefitT}>{t}</Text><Text style={s.benefitB}>{b}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.eyebrow, { color: '#991B1B' }]}>THE COST OF DOING NOTHING</Text>
          <Text style={s.secTitle}>Roofs do not get cheaper to fix</Text>
          <Text style={s.body}>Waiting another season usually means the cost stacks — and the surprise repairs start showing up inside the house.</Text>
          <View style={[s.cardRow, { marginBottom: 0 }]}>
            {COST_STEPS.map(([year, b], i) => (
              <View key={i} style={s.costCard} wrap={false}>
                <Text style={s.costYear}>{year}</Text>
                <Text style={s.costBody}>{b}</Text>
              </View>
            ))}
          </View>
          <Text style={s.costCta}>The single biggest predictor of roof cost is how long you wait to start.</Text>
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 5 — next steps, the experience, payment, terms ── */}
      <Page size="LETTER" style={s.page}>
        <Band propNum={p.prop_num} label="next steps" />

        <View style={s.section}>
          <Text style={s.eyebrow}>WHAT HAPPENS AFTER YOU SIGN</Text>
          <Text style={s.secTitle}>Your install in 5 simple steps</Text>
          {PROCESS_STEPS.map(([t, b], i) => (
            <View key={i} style={s.step} wrap={false}>
              <Text style={s.stepNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.stepT}>{t}</Text>
                <Text style={s.stepB}>{b}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.expBox}>
          <Text style={s.expTitle}>It's not just a roof. It's an entire experience.</Text>
          <Text style={s.expBody}>Most contractors stop calling once the deposit clears — we do the opposite. Every project gets its own live communication channel: a group text thread with you, the project manager, and the crew lead, plus a private shared progress link with photo updates, delivery times, and schedule. You will never wonder what is happening with your roof.</Text>
        </View>

        <Text style={s.secTitle}>Payment schedule</Text>
        <Text style={[s.body, { marginBottom: 8 }]}>Three simple milestones, no hidden charges.{sel ? ` Figures below reflect your selected ${sel.name} package.` : ' Figures scale to whichever package you select.'}</Text>
        <View style={s.payGrid}>
          <View style={s.payCard} wrap={false}>
            <Text style={s.payStep}>1 · DEPOSIT</Text>
            <Text style={s.payAmt}>{sel ? money(deposit) : '$1,000 or 10%'}</Text>
            <Text style={s.payWhen}>Due upon signing — locks your install slot.</Text>
          </View>
          <View style={s.payCard} wrap={false}>
            <Text style={s.payStep}>2 · START</Text>
            <Text style={s.payAmt}>{sel ? money(start) : '50%'}</Text>
            <Text style={s.payWhen}>Due the morning the crew begins tear-off.</Text>
          </View>
          <View style={s.payCard} wrap={false}>
            <Text style={s.payStep}>3 · COMPLETION</Text>
            <Text style={s.payAmt}>{sel ? money(finalPay) : 'Balance'}</Text>
            <Text style={s.payWhen}>Due after final walkthrough — only if you are happy.</Text>
          </View>
        </View>

        <Text style={s.termsTitle}>TERMS & CONDITIONS</Text>
        <Text style={s.terms}>
          Valid 14 days. Payment: $1,000 or 10% deposit due upon signing · 50% at start · balance upon completion.
          Late payments accrue 1.5%/month (18% APR). Wood repairs, extra layers, and permit costs added via signed Change Order.
          Optional upgrades a customer selects on their proposal page are added to the total at signing.
          CA Lic. C39 #1126880. Fully licensed and insured.
        </Text>

        <Footer />
      </Page>
    </Document>
  )
}

export default async function handler(req, res) {
  const { id } = req.query
  const sb = serverClient()
  const { data, error } = await sb.from('proposals').select('*').eq('id', id).single()
  if (error || !data) return res.status(404).json({ error: 'Not found' })

  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const logoUrl = `${base.replace(/\/$/, '')}/logo.png`
    const stream = await renderToStream(<ProposalPDF p={data} logoUrl={logoUrl} />)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="GPR_${data.prop_num}.pdf"`)
    stream.pipe(res)
  } catch (err) {
    console.error('pdf error:', err)
    res.status(500).json({ error: 'PDF render failed' })
  }
}
