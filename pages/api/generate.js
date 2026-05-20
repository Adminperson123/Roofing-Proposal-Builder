import { serverClient } from '../../lib/supabase'
import { generateTiers } from '../../lib/openai'
import { calcPrices, newPropNum } from '../../lib/pricing'
import { ensureContactAndSendSms } from '../../lib/ghl'
import { uploadPhoto } from '../../lib/photos'

export const config = {
  maxDuration: 60,
  api: {
    // Photos ride along as downscaled data URLs (~300KB each, max 6).
    // 25mb gives generous headroom over the realistic ~2-3mb payload.
    bodyParser: { sizeLimit: '25mb' },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { customer, scope, settings, photos, visionAnalysis, financingEnabled, reviseOf, editReason } = req.body || {}
    if (!customer?.name || !scope?.roofType) {
      return res.status(400).json({ error: 'Missing customer.name or scope.roofType' })
    }

    const sb = serverClient()

    // === Revision handling ===
    // If reviseOf is set, this proposal is a NEW VERSION of an existing one.
    // We compute the version chain info up front; the actual superseded-link
    // is written after the new row exists (need its id first).
    let revision = null
    if (reviseOf) {
      revision = await resolveRevisionInfo(sb, reviseOf)
      if (!revision.ok) return res.status(400).json({ error: revision.error })
    }

    const prices = calcPrices(scope, settings)
    const { tiers, coverLetter } = await generateTiers({ customer, scope, prices })
    const propNum = newPropNum()

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
        cover_letter: coverLetter || null,
        financing_enabled: !!financingEnabled,
        // Version chain: v1 for a fresh proposal, vN+1 for a revision.
        version_num: revision ? revision.nextVersion : 1,
        parent_id:   revision ? revision.rootId : null,
        edit_reason: revision ? (editReason || null) : null,
      })
      .select('id, prop_num, version_num')
      .single()

    if (error) throw error

    // Point the old version at the new one so customer links forward to the latest.
    if (revision) {
      const { error: supErr } = await sb
        .from('proposals')
        .update({ superseded_by_id: data.id })
        .eq('id', revision.origId)
      if (supErr) console.error('failed to set superseded_by_id:', supErr)
    }

    const base = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.host}`
    const shareUrl = `${base.replace(/\/$/, '')}/p/${data.id}`

    // === Upload any photos the rep attached + save the vision analysis ===
    // Best-effort: a photo failure must not sink the whole proposal.
    // On a revision with no new photos, the original's photos + analysis carry over.
    const photoResult = await maybeAttachPhotos({
      photos,
      visionAnalysis,
      proposalId: data.id,
      sb,
      carriedPhotoUrls: revision?.photoUrls,
      carriedVision: revision?.visionAnalysis,
    })

    // === Auto-text the proposal link to the customer (best-effort, non-blocking) ===
    // We intentionally DO NOT throw if SMS fails — the proposal is already saved.
    // Any failure is logged + reported back in the response so the rep can retry manually.
    const smsResult = await maybeSendProposalSms({
      customer,
      shareUrl,
      propNum: data.prop_num,
      proposalId: data.id,
      sb,
    })

    res.status(200).json({
      id: data.id,
      propNum: data.prop_num,
      version: data.version_num || 1,
      revisedFrom: revision ? revision.origId : null,
      shareUrl,
      tiers,
      prices,
      sms: smsResult,     // { ok, error?, contactId? }
      photos: photoResult, // { uploaded, failed }
    })
  } catch (err) {
    console.error('generate error:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * Upload the rep's attached photos to Supabase Storage and persist photo_urls +
 * vision_analysis onto the proposal. Always returns a summary; never throws.
 *
 * @param photos          array of data URLs ("data:image/jpeg;base64,...")
 * @param visionAnalysis  the analysis object the rep already ran in the wizard (optional)
 */
async function maybeAttachPhotos({ photos, visionAnalysis, proposalId, sb, carriedPhotoUrls, carriedVision }) {
  if (!Array.isArray(photos) || photos.length === 0) {
    // No new photos uploaded. Two reasons we might still write something:
    //  - revision: inherit the original version's photos + analysis
    //  - the rep ran analysis on photos they later removed (edge case)
    const updates = {}
    if (Array.isArray(carriedPhotoUrls) && carriedPhotoUrls.length) updates.photo_urls = carriedPhotoUrls
    const va = visionAnalysis || carriedVision
    if (va) updates.vision_analysis = va
    if (Object.keys(updates).length) {
      await sb.from('proposals').update(updates).eq('id', proposalId)
    }
    return { uploaded: 0, failed: 0, carried: updates.photo_urls?.length || 0 }
  }

  const uploadedUrls = []
  let failed = 0

  for (const dataUrl of photos.slice(0, 6)) {
    const parsed = parseDataUrl(dataUrl)
    if (!parsed) { failed++; continue }
    const result = await uploadPhoto({
      proposalId,
      buffer: parsed.buffer,
      contentType: parsed.contentType,
    })
    if (result.ok) uploadedUrls.push(result.publicUrl)
    else { failed++; console.error('photo upload failed:', result.error) }
  }

  const updates = {}
  if (uploadedUrls.length) updates.photo_urls = uploadedUrls
  if (visionAnalysis) updates.vision_analysis = visionAnalysis
  if (Object.keys(updates).length) {
    const { error } = await sb.from('proposals').update(updates).eq('id', proposalId)
    if (error) console.error('photo/vision proposal update failed:', error)
  }

  return { uploaded: uploadedUrls.length, failed }
}

/**
 * Work out version-chain info for a NEW revision of an existing proposal.
 * Returns { ok, origId, rootId, nextVersion, photoUrls, visionAnalysis }.
 *
 * rootId      — the v1 proposal that anchors the whole chain (parent_id always points here)
 * nextVersion — one higher than the highest version anywhere in the chain
 * photoUrls / visionAnalysis — carried forward so a revision keeps its roof photos
 */
async function resolveRevisionInfo(sb, reviseOfId) {
  const { data: orig, error } = await sb
    .from('proposals')
    .select('id, parent_id, version_num, status, photo_urls, vision_analysis')
    .eq('id', reviseOfId)
    .single()
  if (error || !orig) return { ok: false, error: 'Proposal to revise was not found' }
  if (orig.status === 'accepted' || orig.status === 'signed') {
    return { ok: false, error: 'Cannot revise an accepted proposal — create a change order instead' }
  }

  const rootId = orig.parent_id || orig.id

  // Highest version_num anywhere in this chain (the root row + all its children)
  const { data: chain } = await sb
    .from('proposals')
    .select('version_num')
    .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
  const maxV = (chain || []).reduce((m, p) => Math.max(m, p.version_num || 1), 1)

  return {
    ok: true,
    origId: orig.id,
    rootId,
    nextVersion: maxV + 1,
    photoUrls: orig.photo_urls || [],
    visionAnalysis: orig.vision_analysis || null,
  }
}

/** Parse "data:image/jpeg;base64,<bytes>" into { contentType, buffer } */
function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!m) return null
  try {
    return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') }
  } catch {
    return null
  }
}

/**
 * Try to text the customer their proposal link. Always returns a result object;
 * never throws. If anything fails we log and move on — the proposal still got saved.
 */
async function maybeSendProposalSms({ customer, shareUrl, propNum, proposalId, sb }) {
  if (!customer?.phone && !customer?.ghlId) {
    return { ok: false, skipped: true, reason: 'no phone or ghl_contact_id on customer' }
  }

  const firstName = (customer.name || '').split(/\s+/)[0] || 'there'
  const message =
    `Hi ${firstName}, this is Good People Roofing. Your proposal #${propNum} is ready to view: ${shareUrl}\n\n` +
    `It includes three options (Good / Better / Best) you can pick from. Reply to this text with any questions.`

  try {
    const result = await ensureContactAndSendSms({
      contactId: customer.ghlId || null,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      message,
    })

    // Always stamp sent_at so we know we tried. If GHL succeeded, record the channel
    // and persist any newly-created contactId back to the proposal row.
    const updates = { sent_at: new Date().toISOString() }
    if (result.ok) {
      updates.sent_channels = ['sms']
      if (result.contactId && result.contactId !== customer.ghlId) {
        updates.ghl_contact_id = result.contactId
      }
    } else {
      updates.sent_channels = []
    }
    await sb.from('proposals').update(updates).eq('id', proposalId)

    if (!result.ok) {
      console.error('SMS to customer failed:', result.error)
      return { ok: false, error: result.error, contactId: result.contactId }
    }
    return { ok: true, contactId: result.contactId }
  } catch (err) {
    console.error('SMS helper threw unexpectedly:', err)
    return { ok: false, error: err.message || String(err) }
  }
}
