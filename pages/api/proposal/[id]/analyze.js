/**
 * POST /api/proposal/[id]/analyze
 *
 * Runs OpenAI Vision against the proposal's uploaded photos and stores the
 * structured analysis in the vision_analysis jsonb column.
 *
 * Request body (optional): { force?: true }
 *   - force=true bypasses the "already analyzed" cache and re-runs the model.
 *     Costs another API call. Useful after the rep adds more photos.
 *
 * Response: { ok, analysis, cached?: true }
 *
 * If the proposal has no photos yet, returns 400. Photos must be uploaded
 * via /api/proposal/[id]/photos first.
 */

import { serverClient } from '../../../../lib/supabase'
import { analyzeRoofPhotos } from '../../../../lib/vision'
import { requireAuth } from '../../../../lib/auth'

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
  maxDuration: 60,  // vision calls can take 15-30s with multiple photos
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'proposal id required' })

  const sb = serverClient()
  const { data: proposal, error } = await sb
    .from('proposals')
    .select('id, photo_urls, vision_analysis, customer_name, customer_address, inspection_notes')
    .eq('id', id)
    .single()

  if (error || !proposal) return res.status(404).json({ error: 'proposal not found' })

  const photos = Array.isArray(proposal.photo_urls) ? proposal.photo_urls : []
  if (photos.length === 0) {
    return res.status(400).json({ error: 'no photos uploaded yet — POST to /photos first' })
  }

  // Cache: skip re-analysis unless caller passes force=true
  const force = !!(req.body || {}).force
  if (!force && proposal.vision_analysis && proposal.vision_analysis.photos_analyzed === photos.length) {
    return res.status(200).json({
      ok: true,
      cached: true,
      analysis: proposal.vision_analysis,
    })
  }

  const result = await analyzeRoofPhotos({
    photoUrls: photos,
    context: {
      customer: proposal.customer_name,
      address:  proposal.customer_address,
      notes:    proposal.inspection_notes,
    },
  })

  if (!result.ok) {
    return res.status(500).json({ error: result.error, raw: result.raw })
  }

  // Persist so we don't re-pay for re-analysis on every page reload
  const { error: updateErr } = await sb
    .from('proposals')
    .update({ vision_analysis: result.analysis })
    .eq('id', proposal.id)

  if (updateErr) {
    // Return the analysis anyway — the rep can use it even if storage failed
    console.error('analysis succeeded but DB update failed:', updateErr)
    return res.status(200).json({
      ok: true,
      cached: false,
      analysis: result.analysis,
      warning: 'stored to memory only — DB update failed: ' + updateErr.message,
    })
  }

  return res.status(200).json({
    ok: true,
    cached: false,
    analysis: result.analysis,
  })
}

export default requireAuth(handler)
