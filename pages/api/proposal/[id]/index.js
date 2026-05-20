import { serverClient } from '../../../../lib/supabase'
import { ensureContactAndSendSms } from '../../../../lib/ghl'

export default async function handler(req, res) {
  const { id } = req.query
  const sb = serverClient()

  if (req.method === 'GET') {
    // ?noview=1 — used by the admin wizard when loading a proposal to revise.
    // Skips view-marking + the rep notification so an internal reload isn't
    // mistaken for a real customer opening the proposal.
    const skipView = 'noview' in req.query

    const { data: requested, error } = await sb.from('proposals').select('*').eq('id', id).single()
    if (error) return res.status(404).json({ error: 'Not found' })

    // Follow the revision chain (superseded_by_id → … → tip) so an old link
    // always lands the customer on the newest version. Guard against loops.
    let proposal = requested
    let guard = 0
    while (proposal.superseded_by_id && guard < 10) {
      const { data: next } = await sb.from('proposals').select('*').eq('id', proposal.superseded_by_id).single()
      if (!next) break
      proposal = next
      guard++
    }
    const wasForwarded = proposal.id !== requested.id

    // Mark first view + notify the rep — only for genuine customer views, and
    // always against the version actually being shown (the chain tip).
    if (!skipView && !proposal.viewed_at) {
      const now = new Date().toISOString()
      await sb.from('proposals').update({ viewed_at: now, status: 'viewed' }).eq('id', proposal.id)
      proposal.viewed_at = now
      proposal.status = 'viewed'

      // Fire-and-forget — don't block the customer's page render on the rep ping.
      notifyRepOfView({ proposal }).catch(err => {
        console.error('rep notification threw unexpectedly:', err)
      })
    }

    // Attach financing partner config (env-driven). Kept server-side so we don't
    // need NEXT_PUBLIC_ vars. Both fields are null until Oscar sets the real partner;
    // the public page degrades gracefully when applyUrl is missing.
    proposal.financing = {
      partnerName: process.env.FINANCING_PARTNER_NAME || null,
      applyUrl:    process.env.FINANCING_PARTNER_URL || null,
    }
    // True when the customer's link pointed at an older version we forwarded.
    proposal._wasForwarded = wasForwarded

    return res.status(200).json(proposal)
  }

  if (req.method === 'DELETE') {
    const { error } = await sb.from('proposals').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

/**
 * Text the rep (or a shared sales number) the moment the customer opens the proposal.
 * Uses the REP_NOTIFICATION_PHONE env var. If unset, the function quietly skips —
 * this keeps the feature optional so GPR can enable/disable it without code changes.
 *
 * The rep is auto-upserted in GHL as a contact named "Sales Rep — Notifications" so
 * we have a stable contactId to message. Re-upserts are de-duped by phone in GHL.
 */
async function notifyRepOfView({ proposal }) {
  const repPhone = process.env.REP_NOTIFICATION_PHONE
  if (!repPhone) {
    console.log('REP_NOTIFICATION_PHONE not set — skipping rep notification')
    return
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || ''
  const link = base ? `${base.replace(/\/$/, '')}/p/${proposal.id}` : `/p/${proposal.id}`
  const customer = proposal.customer_name || 'A customer'
  const propNum = proposal.prop_num || proposal.id

  const message =
    `🔥 ${customer} just opened proposal #${propNum}. ` +
    `Call them NOW while it's open on their screen. ${link}`

  const result = await ensureContactAndSendSms({
    phone: repPhone,
    name: 'Sales Rep — Notifications',
    message,
  })

  if (!result.ok) {
    console.error('Rep notification SMS failed:', result.error)
  } else {
    console.log(`Rep notified of view on proposal ${propNum}`)
  }
}
