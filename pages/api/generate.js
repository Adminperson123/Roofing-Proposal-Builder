import { serverClient } from '../../lib/supabase'
import { generateTiers } from '../../lib/openai'
import { calcPrices, newPropNum, DEFAULT_SETTINGS } from '../../lib/pricing'
import { requireAuth } from '../../lib/auth'

export const config = { maxDuration: 60 }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { customer, scope, tierOverrides, visibleTiers } = req.body || {}
    // ---- validation ----
    if (!customer?.name || !customer?.address) return res.status(400).json({ error: 'customer.name and customer.address are required' })
    if (!scope?.roofType || !['shingle','tile'].includes(scope.roofType)) return res.status(400).json({ error: 'scope.roofType must be shingle|tile' })
    if (!scope?.squares || +scope.squares <= 0) return res.status(400).json({ error: 'squares must be > 0' })
    if (!scope?.pitch   || +scope.pitch   <= 0) return res.status(400).json({ error: 'pitch must be > 0' })
    if (+scope.stories < 1) return res.status(400).json({ error: 'stories must be >= 1' })
    if (+scope.layers  < 1) return res.status(400).json({ error: 'layers must be >= 1' })

    const sb = serverClient()
    // pull live settings (fallback to defaults)
    let settings = DEFAULT_SETTINGS
    try {
      const { data } = await sb.from('settings').select('payload').eq('id', 'global').single()
      if (data?.payload) settings = { ...DEFAULT_SETTINGS, ...data.payload }
    } catch {}

    const prices = calcPrices(scope, settings)
    const { tiers, coverLetter } = await generateTiers({ customer, scope, prices })

    // v3.3 rep tier config — which packages to show + manual price overrides.
    const ALLOWED = ['good', 'better', 'best']
    let visible = Array.isArray(visibleTiers) ? visibleTiers.filter(t => ALLOWED.includes(t)) : []
    if (!visible.length) visible = ALLOWED
    tiers._visible = visible
    if (tierOverrides && typeof tierOverrides === 'object') {
      for (const k of ALLOWED) {
        const o = Number(tierOverrides[k])
        if (Number.isFinite(o) && o > 0 && tiers[k]) tiers[k].price = o
      }
    }

    const propNum = newPropNum()

    const { data, error } = await sb
      .from('proposals')
      .insert({
        prop_num: propNum,
        status: 'sent',
        version_num: 1,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        rep_name: customer.rep || null,
        ghl_contact_id: customer.ghlId || null,
        inspection_notes: customer.notes || null,
        roof_type: scope.roofType,
        tile_subtype: scope.tileSubtype || null,
        squares: +scope.squares,
        pitch: +scope.pitch,
        stories: +scope.stories,
        layers: +scope.layers,
        decking_sheets: +scope.deckingSheets || 0,
        permit_amount: +scope.permit || 0,
        solar_panels: +scope.solarPanels || 0,
        addons: scope.addons || [],
        tiers,
        cover_letter: coverLetter,
        photo_urls: customer.photoUrls || [],
        financing_enabled: settings.financing?.enabled !== false,
      })
      .select('id, prop_num')
      .single()
    if (error) throw error

    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const shareUrl = `${base.replace(/\/$/, '')}/p/${data.id}`

    // Proposals are NOT auto-sent. The rep reviews on the success screen, then
    // sends manually via /api/proposal/[id]/send (SMS or email).
    res.status(200).json({ id: data.id, propNum: data.prop_num, shareUrl, tiers, prices, coverLetter })
  } catch (err) {
    console.error('generate error:', err)
    res.status(500).json({ error: 'Failed to generate proposal. Please try again.' })
  }
}

export default requireAuth(handler)
