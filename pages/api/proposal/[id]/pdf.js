import React from 'react'
import { renderToStream, Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import { serverClient } from '../../../../lib/supabase'
import {
  TIER_COLORS, paymentSplit,
  ABOUT, FAMILIES, TESTIMONIALS, MATERIALS_SECTION, MATERIALS, PARTNERS, SCOPE,
  QUALITY, BENEFITS_SECTION, BENEFITS, COST, PROCESS_SECTION, PROCESS_STEPS,
  EXPERIENCE, PAYMENT, TERMS,
} from '../../../../lib/content'

export const config = { maxDuration: 30 }

const NAVY = '#0C1C38'
const CRIMSON = '#B01E17'
const GOLD = '#D4960E'
const CREAM = '#F7F6F3'
const TEXT = '#1A1A2E'
const MUTED = '#4A5568'
const BORDER = '#E2E0DB'
// TIER_COLORS and all narrative content now come from lib/content.js so the
// PDF, web proposal, and presentation deck share one source of truth.
// react-pdf (Helvetica) cannot render the ★ glyph, so stat numbers are
// stripped of it for the PDF only.
const pdfStat = (n) => String(n).replace(/★/g, '')

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

function ProposalPDF({ p, logoUrl, roofMapUrl }) {
  const rm = p.roof_measurements || null
  const tiers = p.tiers || {}
  const tierKeys = (Array.isArray(tiers._visible) && tiers._visible.length ? tiers._visible : ['good','better','best'])
    .filter(k => ['good','better','best'].includes(k))
  const date = fmtDate(p.created_at)
  const expires = p.expires_at ? fmtDate(p.expires_at) : '—'
  const sel = p.selected_tier ? tiers[p.selected_tier] : null
  const acceptedAddons = Array.isArray(p.accepted_addons) ? p.accepted_addons : []
  const basePrice = sel?.price || 0
  const total = p.accepted_total ? Number(p.accepted_total) : basePrice
  const { deposit, start, final: finalPay } = paymentSplit(total)

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
          <Text style={s.eyebrow}>{ABOUT.eyebrow}</Text>
          <Text style={s.secTitle}>{ABOUT.title}</Text>
          <Text style={s.body}>{ABOUT.body}</Text>
          <View style={s.statRow}>
            {ABOUT.stats.map((st, i) => (
              <View key={i} style={s.statCard}><Text style={s.statN}>{pdfStat(st.n)}</Text><Text style={s.statL}>{st.l}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>{FAMILIES.eyebrow}</Text>
          <Text style={s.secTitle}>{FAMILIES.title}</Text>
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
          <Text style={s.eyebrow}>{MATERIALS_SECTION.eyebrow}</Text>
          <Text style={s.secTitle}>{MATERIALS_SECTION.title}</Text>
          <View style={s.cardRow}>
            {MATERIALS.slice(0, 3).map((m, i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{m.name}</Text><Text style={s.cardTag}>{m.tag}</Text></View>
            ))}
          </View>
          <View style={s.cardRow}>
            {MATERIALS.slice(3, 6).map((m, i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{m.name}</Text><Text style={s.cardTag}>{m.tag}</Text></View>
            ))}
          </View>
          <Text style={[s.eyebrow, { marginTop: 6 }]}>DISTRIBUTOR PARTNERSHIPS</Text>
          <View style={s.cardRow}>
            {PARTNERS.map((pt, i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{pt.name}</Text><Text style={s.cardTag}>{pt.tag}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.eyebrow}>{SCOPE.eyebrow}</Text>
          <Text style={s.secTitle}>{SCOPE.title}</Text>
          <Text style={s.body}>{SCOPE.sub}</Text>
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
          <Text style={s.eyebrow}>{QUALITY.eyebrow}</Text>
          <Text style={s.secTitle}>{QUALITY.title}</Text>
          <Text style={s.body}>{QUALITY.body}</Text>
          <View style={s.cardRow}>
            {QUALITY.pillars.map((q, i) => (
              <View key={i} style={s.card}><Text style={s.cardName}>{q.t}</Text><Text style={s.cardTag}>{q.b}</Text></View>
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
          <Text style={s.eyebrow}>{BENEFITS_SECTION.eyebrow}</Text>
          <Text style={s.secTitle}>{BENEFITS_SECTION.title}</Text>
          <View style={s.cardRow}>
            {BENEFITS.slice(0, 3).map((bn, i) => (
              <View key={i} style={s.benefitCard}><Text style={s.benefitT}>{bn.t}</Text><Text style={s.benefitB}>{bn.b}</Text></View>
            ))}
          </View>
          <View style={s.cardRow}>
            {BENEFITS.slice(3, 6).map((bn, i) => (
              <View key={i} style={s.benefitCard}><Text style={s.benefitT}>{bn.t}</Text><Text style={s.benefitB}>{bn.b}</Text></View>
            ))}
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.eyebrow, { color: '#991B1B' }]}>{COST.eyebrow}</Text>
          <Text style={s.secTitle}>{COST.title}</Text>
          <Text style={s.body}>{COST.subShort}</Text>
          <View style={[s.cardRow, { marginBottom: 0 }]}>
            {COST.steps.map((cs, i) => (
              <View key={i} style={s.costCard} wrap={false}>
                <Text style={s.costYear}>{cs.year}</Text>
                <Text style={s.costBody}>{cs.b}</Text>
              </View>
            ))}
          </View>
          <Text style={s.costCta}>{COST.cta}</Text>
        </View>

        <Footer />
      </Page>

      {/* ── PAGE 5 — next steps, the experience, payment, terms ── */}
      <Page size="LETTER" style={s.page}>
        <Band propNum={p.prop_num} label="next steps" />

        <View style={s.section}>
          <Text style={s.eyebrow}>{PROCESS_SECTION.eyebrow}</Text>
          <Text style={s.secTitle}>{PROCESS_SECTION.title}</Text>
          {PROCESS_STEPS.map((st, i) => (
            <View key={i} style={s.step} wrap={false}>
              <Text style={s.stepNum}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.stepT}>{st.title}</Text>
                <Text style={s.stepB}>{st.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.expBox}>
          <Text style={s.expTitle}>{EXPERIENCE.title}</Text>
          <Text style={s.expBody}>{`${EXPERIENCE.intro} ${EXPERIENCE.options.map(o => `${o.t}: ${o.b}`).join(' ')} ${EXPERIENCE.promise}`}</Text>
        </View>

        <Text style={s.secTitle}>Payment schedule</Text>
        <Text style={[s.body, { marginBottom: 8 }]}>{PAYMENT.sub}{sel ? ` Figures below reflect your selected ${sel.name} package.` : ' Figures scale to whichever package you select.'}</Text>
        <View style={s.payGrid}>
          {PAYMENT.milestones.map((m, i) => {
            const amt = sel ? money([deposit, start, finalPay][i]) : m.fallback
            return (
              <View key={i} style={s.payCard} wrap={false}>
                <Text style={s.payStep}>{m.step}</Text>
                <Text style={s.payAmt}>{amt}</Text>
                <Text style={s.payWhen}>{m.when}.</Text>
              </View>
            )
          })}
        </View>

        <Text style={s.termsTitle}>TERMS & CONDITIONS</Text>
        <Text style={s.terms}>{TERMS.body}</Text>

        <Footer />
      </Page>

      {/* ── PAGE 6 (conditional) — roof measurements ── */}
      {rm && (
        <Page size="LETTER" style={s.page}>
          <Band propNum={p.prop_num} label="roof measurements" />
          <View style={s.section}>
            <Text style={s.eyebrow}>ROOF MEASUREMENTS</Text>
            <Text style={s.secTitle}>An aerial breakdown of your roof</Text>
            <Text style={s.body}>Measured plane by plane from aerial imagery — final measurements confirmed on-site.</Text>
            {roofMapUrl && <Image src={roofMapUrl} style={{ width: '100%', borderRadius: 6, marginBottom: 10 }} />}
            <View style={s.statRow}>
              {[['SQUARES', rm.squares ?? '—'], ['PITCH', rm.pitch != null ? `${rm.pitch}/12` : '—'], ['PLANES', rm.planes ?? '—'], ['ROOF SQFT', rm.areaSqft ? rm.areaSqft.toLocaleString() : '—']].map(([l, v], i) => (
                <View key={i} style={s.statCard}><Text style={s.statN}>{v}</Text><Text style={s.statL}>{l}</Text></View>
              ))}
            </View>
          </View>
          {Array.isArray(rm.segments) && rm.segments.length > 0 && (
            <View style={s.section}>
              <Text style={[s.eyebrow, { marginBottom: 6 }]}>PLANE-BY-PLANE BREAKDOWN</Text>
              <View style={[s.cardRow, { backgroundColor: NAVY, borderRadius: 4, marginBottom: 0 }]}>
                {['#', 'Area (sqft)', 'Squares', 'Pitch', 'Facing'].map((h, i) => (
                  <Text key={i} style={{ flex: i === 0 ? 0.4 : 1, color: '#fff', fontSize: 7.5, fontWeight: 'bold', padding: 6 }}>{h}</Text>
                ))}
              </View>
              {rm.segments.map((seg, i) => (
                <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER }} wrap={false}>
                  <Text style={{ flex: 0.4, fontSize: 8, padding: 6 }}>{i + 1}</Text>
                  <Text style={{ flex: 1, fontSize: 8, padding: 6 }}>{seg.areaSqft?.toLocaleString() || '—'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, padding: 6 }}>{seg.areaSqft ? (seg.areaSqft / 100).toFixed(1) : '—'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, padding: 6 }}>{seg.pitch != null ? `${seg.pitch}/12` : '—'}</Text>
                  <Text style={{ flex: 1, fontSize: 8, padding: 6 }}>{seg.orientation || '—'}</Text>
                </View>
              ))}
            </View>
          )}
          <Footer />
        </Page>
      )}
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
    const root = base.replace(/\/$/, '')
    const logoUrl = `${root}/logo.png`
    // Only request the annotated roof image when a measurement exists.
    const roofMapUrl = data.roof_measurements ? `${root}/api/roofmap?proposal=${data.id}` : null
    const stream = await renderToStream(<ProposalPDF p={data} logoUrl={logoUrl} roofMapUrl={roofMapUrl} />)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="GPR_${data.prop_num}.pdf"`)
    stream.pipe(res)
  } catch (err) {
    console.error('pdf error:', err)
    res.status(500).json({ error: 'PDF render failed' })
  }
}
