// Creates v2 (new shareable link) of an existing proposal.
// Body: { customer?, scope?, addons?, tier_overrides?, tier_price_pct?, photo_urls?, edit_reason?, regenerate_with_ai? }
// Old proposal is marked superseded -> its public page redirects.
import { serverClient } from '../../../../lib/supabase'
import { generateTiers } from '../../../../lib/openai'
import { calcPrices, newPropNum, DEFAULT_SETTINGS } from '../../../../lib/pricing'
import { requireAuth } from '../../../../lib/auth'

export const config = { maxDuration: 60 }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id: parentId } = req.query
  const patch = req.body || {}
  const sb = serverClient()

  try {
    // 1. Load parent
    const { data: parent, error: pErr } = await sb.from('proposals').select('*').eq('id', parentId).single()
    if (pErr || !parent) return res.status(404).json({ error: 'Original proposal not found' })
    if (parent.superseded_by_id) return res.status(409).json({ error: 'This proposal already has a newer version.' })

    // 2. Build the new customer + scope objects (parent merged with patch)
    const newCustomer = {
      name:    patch.customer?.name    ?? parent.customer_name,
      phone:   patch.customer?.phone   ?? parent.customer_phone,
      email:   patch.customer?.email   ?? parent.customer_email,
      address: patch.customer?.address ?? parent.customer_address,
      rep:     patch.customer?.rep     ?? parent.rep_name,
      notes:   patch.customer?.notes   ?? parent.inspection_notes,
      ghlId:   parent.ghl_contact_id,
    }
    const baseScope = {
      roofType:      patch.scope?.roofType      ?? parent.roof_type,
      tileSubtype:   patch.scope?.tileSubtype   ?? parent.tile_subtype,
      squares:       patch.scope?.squares       ?? parent.squares,
      pitch:         patch.scope?.pitch         ?? parent.pitch,
      stories:       patch.scope?.stories       ?? parent.stories,
      layers:        patch.scope?.layers        ?? parent.layers,
      deckingSheets: patch.scope?.deckingSheets ?? parent.decking_sheets,
      permit:        patch.scope?.permit        ?? parent.permit_amount,
    }
    // addons: start from parent, then apply add/remove
    let addons = Array.isArray(parent.addons) ? [...parent.addons] : []
    if (patch.addons?.remove?.length) addons = addons.filter(a => !patch.addons.remove.includes(a))
    if (patch.addons?.add?.length)    for (const a of patch.addons.add) if (!addons.includes(a)) addons.push(a)
    const newScope = { ...baseScope, addons }

    // 3. Pull settings + recalc prices
    let settings = DEFAULT_SETTINGS
    const { data: sData } = await sb.from('settings').select('payload').eq('id', 'global').single()
    if (sData?.payload) settings = { ...DEFAULT_SETTINGS, ...sData.payload }
    let prices = calcPrices(newScope, settings)

    // 4. Either regenerate AI tiers or carry over and apply overrides
    let tiers, coverLetter
    if (patch.regenerate_with_ai) {
      const r = await generateTiers({ customer: newCustomer, scope: newScope, prices })
      tiers = r.tiers; coverLetter = r.coverLetter
    } else {
      tiers = JSON.parse(JSON.stringify(parent.tiers || {}))
      coverLetter = parent.cover_letter
      // Update prices on each tier from new calc
      for (const k of ['good','better','best']) {
        if (tiers[k]) { tiers[k].price = prices[k].total; tiers[k].psf = prices[k].psf }
      }
    }
    // Apply absolute overrides + percent adjustments AFTER pricing
    for (const k of ['good','better','best']) {
      const ov = patch.tier_overrides?.[k]
      if (ov) {
        for (const f of ['name','tagline','narrative','warranty','material','brand','features']) {
          if (ov[f] !== undefined) tiers[k][f] = ov[f]
        }
        if (typeof ov.price === 'number') tiers[k].price = Math.round(ov.price)
      }
      const pct = patch.tier_price_pct?.[k]
      if (typeof pct === 'number' && tiers[k]) {
        tiers[k].price = Math.round(tiers[k].price * (1 + pct / 100))
      }
    }

    // 5. Insert v2
    const newPropNumStr = parent.prop_num + '-v' + (parent.version_num + 1)
    const { data: child, error: cErr } = await sb
      .from('proposals')
      .insert({
        prop_num: newPropNumStr,
        status: 'sent',
        version_num: parent.version_num + 1,
        parent_id: parent.id,
        customer_name: newCustomer.name,
        customer_phone: newCustomer.phone || null,
        customer_email: newCustomer.email || null,
        customer_address: newCustomer.address || null,
        rep_name: newCustomer.rep || null,
        ghl_contact_id: newCustomer.ghlId || null,
        inspection_notes: newCustomer.notes || null,
        roof_type: newScope.roofType,
        tile_subtype: newScope.tileSubtype || null,
        squares: +newScope.squares,
        pitch: +newScope.pitch,
        stories: +newScope.stories,
        layers: +newScope.layers,
        decking_sheets: +newScope.deckingSheets || 0,
        permit_amount: +newScope.permit || 0,
        addons: newScope.addons,
        tiers,
        cover_letter: coverLetter,
        photo_urls: patch.photo_urls || parent.photo_urls || [],
        financing_enabled: parent.financing_enabled,
        edit_reason: patch.edit_reason || null,
      })
      .select('id, prop_num')
      .single()
    if (cErr) throw cErr

    // 6. Mark parent as superseded
    await sb.from('proposals').update({ superseded_by_id: child.id, status: 'expired' }).eq('id', parent.id)

    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const shareUrl = `${base.replace(/\/$/, '')}/p/${child.id}`
    res.status(200).json({ id: child.id, propNum: child.prop_num, shareUrl, tiers, prices })
  } catch (err) {
    console.error('edit error:', err)
    res.status(500).json({ error: 'Edit failed: ' + (err.message || 'unknown') })
  }
}

export default requireAuth(handler)
