import { serverClient } from '../../lib/supabase'
import { generateTiers } from '../../lib/anthropic'
import { calcPrices, newPropNum } from '../../lib/pricing'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { customer, scope, settings } = req.body || {}
    if (!customer?.name || !scope?.roofType) {
      return res.status(400).json({ error: 'Missing customer.name or scope.roofType' })
    }

    const prices = calcPrices(scope, settings)
    const tiers  = await generateTiers({ customer, scope, prices })
    const propNum = newPropNum()

    const sb = serverClient()
    const { data, error } = await sb
      .from('proposals')
      .insert({
        prop_num: propNum,
        status: 'sent',
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        rep_name: customer.rep || null,
        ghl_contact_id: customer.ghlId || null,
        inspection_notes: customer.notes || null,
        roof_type: scope.roofType,
        tile_subtype: scope.tileSubtype || null,
        squares: scope.squares,
        pitch: scope.pitch,
        stories: scope.stories,
        layers: scope.layers,
        decking_sheets: scope.deckingSheets || 0,
        permit_amount: scope.permit || 0,
        addons: scope.addons || [],
        tiers,
      })
      .select('id, prop_num')
      .single()

    if (error) throw error

    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const shareUrl = `${base.replace(/\/$/, '')}/p/${data.id}`

    res.status(200).json({ id: data.id, propNum: data.prop_num, shareUrl, tiers, prices })
  } catch (err) {
    console.error('generate error:', err)
    res.status(500).json({ error: err.message })
  }
}
