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

const s = StyleSheet.create({
  page:        { padding: 36, fontSize: 10, color: TEXT, fontFamily: 'Helvetica' },
  header:      { backgroundColor: NAVY, padding: 14, marginBottom: 14, borderBottomWidth: 3, borderBottomColor: CRIMSON, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand:       { color: GOLD, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  brandSub:    { color: '#94a3b8', fontSize: 7, marginTop: 2 },
  propNumLbl:  { color: '#94a3b8', fontSize: 8 },
  propNum:     { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  propDate:    { color: '#94a3b8', fontSize: 8, marginTop: 2 },
  validity:    { color: '#34d399', fontSize: 7, marginTop: 2 },
  twoCol:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  box:         { flex: 1, backgroundColor: CREAM, padding: 10, borderRadius: 5 },
  boxLbl:      { color: '#94a3b8', fontSize: 7, fontWeight: 'bold', marginBottom: 3, letterSpacing: 0.5 },
  boxName:     { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  boxLine:     { fontSize: 8, color: MUTED, marginTop: 1 },
  cover:       { fontSize: 10, color: TEXT, lineHeight: 1.5, marginBottom: 12, paddingHorizontal: 4, fontStyle: 'italic' },
  scope:       { backgroundColor: CREAM, padding: 10, borderRadius: 5, marginBottom: 12 },
  scopeLbl:    { color: '#94a3b8', fontSize: 7, fontWeight: 'bold', marginBottom: 3, letterSpacing: 0.5 },
  scopeLine:   { fontSize: 8, color: MUTED, marginBottom: 2 },
  tierTitle:   { fontSize: 11, fontWeight: 'bold', color: NAVY, marginBottom: 6, letterSpacing: 0.5 },
  tierGrid:    { flexDirection: 'row', gap: 5, marginBottom: 12 },
  tierCard:    { flex: 1, borderWidth: 2, borderRadius: 6, padding: 8 },
  tierBadge:   { color: '#fff', textAlign: 'center', padding: 3, fontSize: 8, fontWeight: 'bold', borderRadius: 3, marginBottom: 5 },
  tierName:    { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  tierTag:     { fontSize: 7, color: MUTED, marginBottom: 4 },
  tierPrice:   { fontSize: 16, fontWeight: 'bold', marginBottom: 1 },
  tierPsf:     { fontSize: 7, color: MUTED, marginBottom: 4 },
  tierMat:     { fontSize: 7.5, fontWeight: 'bold', color: TEXT, marginBottom: 1 },
  tierBrand:   { fontSize: 7, color: MUTED, marginBottom: 3 },
  tierWarr:    { fontSize: 7.5, fontWeight: 'bold', marginBottom: 5 },
  tierFeat:    { fontSize: 7, color: MUTED, marginBottom: 1.5, lineHeight: 1.3 },
  selectedBox: { backgroundColor: '#FEF3C7', padding: 8, borderRadius: 5, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: GOLD },
  termsTitle:  { fontSize: 9, fontWeight: 'bold', color: NAVY, marginBottom: 3, letterSpacing: 0.5 },
  terms:       { fontSize: 7.5, color: MUTED, lineHeight: 1.4 },
  footer:      { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 6, fontSize: 7, color: '#9CA3AF', textAlign: 'center' },
})

function fmtDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }
  catch { return '—' }
}

function ProposalPDF({ p, logoUrl }) {
  const tiers = p.tiers || {}
  const date = fmtDate(p.created_at)
  const expires = p.expires_at ? fmtDate(p.expires_at) : '—'
  const sel = p.selected_tier ? tiers[p.selected_tier] : null
  return (
    <Document>
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

        <View style={s.scope}>
          <Text style={s.scopeLbl}>SCOPE OF WORK</Text>
          <Text style={s.scopeLine}>
            {p.roof_type === 'tile' ? `Tile Roofing${p.tile_subtype ? ' (' + p.tile_subtype + ')' : ''}` : 'Architectural Shingle'}
            {`  |  ${p.squares} squares  |  Pitch ${p.pitch}/12  |  ${p.stories} stor${p.stories > 1 ? 'ies' : 'y'}`}
          </Text>
          {Array.isArray(p.addons) && p.addons.length > 0 && (
            <Text style={s.scopeLine}>Add-ons: {p.addons.join(', ')}</Text>
          )}
          {p.inspection_notes && <Text style={s.scopeLine}>Notes: {p.inspection_notes}</Text>}
        </View>

        {sel && (
          <View style={s.selectedBox}>
            <Text style={[s.termsTitle, { color: GOLD }]}>★ CUSTOMER SELECTED: {sel.name?.toUpperCase()} — ${(sel.price || 0).toLocaleString()}</Text>
            <Text style={s.terms}>Accepted on {p.accepted_at ? new Date(p.accepted_at).toLocaleString() : '—'}</Text>
          </View>
        )}

        <Text style={s.tierTitle}>YOUR THREE PACKAGE OPTIONS</Text>
        <View style={s.tierGrid}>
          {['good','better','best'].map(k => {
            const t = tiers[k]; if (!t) return null
            const c = TIER_COLORS[k]
            return (
              <View key={k} style={[s.tierCard, { borderColor: c }]}>
                <Text style={[s.tierBadge, { backgroundColor: c }]}>{(t.name || k).toUpperCase()}</Text>
                <Text style={s.tierName}>{t.name}</Text>
                <Text style={s.tierTag}>{t.tagline}</Text>
                <Text style={[s.tierPrice, { color: c }]}>${(t.price || 0).toLocaleString()}</Text>
                <Text style={s.tierPsf}>${t.psf}/sq · {p.squares} squares</Text>
                <Text style={s.tierMat}>{t.material}</Text>
                <Text style={s.tierBrand}>{t.brand}</Text>
                <Text style={[s.tierWarr, { color: c }]}>{t.warranty}</Text>
                {(t.features || []).map((f, i) => (
                  <Text key={i} style={s.tierFeat}>{`✓ ${f}`}</Text>
                ))}
              </View>
            )
          })}
        </View>

        <Text style={s.termsTitle}>TERMS & CONDITIONS</Text>
        <Text style={s.terms}>
          Valid 14 days. Payment: $1,000 or 10% deposit due upon signing · 50% at start · balance upon completion.
          Late payments accrue 1.5%/month (18% APR). Wood repairs, extra layers, and permit costs added via signed Change Order.
          CA Lic. C39 #1126880. Fully licensed and insured.
        </Text>

        <Text style={s.footer} fixed>
          Good People Roofing Inc.  |  goodpeopleroofinginc.com  |  (844) ROOFS-09  |  CA Lic. C39 #1126880
        </Text>
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
