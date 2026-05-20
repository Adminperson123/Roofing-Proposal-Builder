/**
 * POST /api/analyze-photos  — STATELESS roof photo analysis.
 *
 * Unlike /api/proposal/[id]/analyze, this needs NO saved proposal and NO storage.
 * The rep can analyze photos mid-wizard, before the proposal exists, and use the
 * AI's suggestions to fill in the scope form.
 *
 * Body (JSON): {
 *   images:  ["data:image/jpeg;base64,...", ...]   // 1-6 downscaled data URLs
 *   context: { customer?, address?, notes? }        // optional grounding
 * }
 * Returns: { ok, analysis }
 *
 * OpenAI Vision accepts data URLs directly as image_url, so we pass them straight
 * through to lib/vision.js — no upload round-trip needed.
 */

import { analyzeRoofPhotos } from '../../lib/vision'

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { images, context } = req.body || {}
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images (non-empty array of data URLs) required' })
  }
  if (images.length > 6) {
    return res.status(400).json({ error: 'max 6 photos per analysis' })
  }
  // Light sanity check — each entry should look like a data URL
  if (!images.every(i => typeof i === 'string' && i.startsWith('data:image/'))) {
    return res.status(400).json({ error: 'each image must be a data:image/... URL' })
  }

  const result = await analyzeRoofPhotos({ photoUrls: images, context })
  if (!result.ok) {
    return res.status(500).json({ error: result.error, raw: result.raw })
  }

  return res.status(200).json({ ok: true, analysis: result.analysis })
}
