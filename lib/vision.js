/**
 * Claude Vision roof analysis.
 *
 * Takes a list of photo URLs (1-6 typical) and returns a CONSERVATIVE structured
 * analysis the rep can review and edit before generating a proposal.
 *
 * Conservative means: we return descriptive estimates + confidence labels, not
 * hard numbers we expect the system to auto-trust. The rep is still the source
 * of truth. As accuracy improves over months of use, we can switch to a more
 * aggressive auto-fill mode.
 *
 * Output shape (also documented in the DB column comment):
 * {
 *   model: "claude-sonnet-4-5",
 *   analyzed_at: "2026-05-20T01:23:45Z",
 *   photos_analyzed: 3,
 *   squares_estimate: { value: "25-30", confidence: "medium", reasoning: "..." },
 *   pitch_estimate:   { value: "5/12 - 7/12", confidence: "low", reasoning: "..." },
 *   material_guess:   { value: "Asphalt 3-tab shingle", confidence: "high", reasoning: "..." },
 *   damage_summary:   "Moderate granule loss on south-facing slopes; one missing shingle near ridge",
 *   condition_score:  6,            // 1-10, where 10 = pristine, 1 = needs immediate replacement
 *   notable_features: ["chimney flashing visible", "skylight present", "rooftop solar"],
 *   recommended_addons: ["chimney", "skylight"],   // ids that match ADDON_DEFS in lib/pricing.js
 *   notes: "..."
 * }
 */

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-5'

const SYSTEM = `You are an expert roof inspector helping a Southern California residential roofing company (Good People Roofing Inc.) estimate scope from photos.

Your job: produce a CONSERVATIVE first-pass analysis a human estimator will review before quoting. Be honest about uncertainty. It is BETTER to say "I cannot tell from this photo" than to guess.

OUTPUT FORMAT — return ONLY valid JSON matching this exact shape, no prose, no markdown:

{
  "squares_estimate":   { "value": "<range like '20-25' or 'cannot tell'>", "confidence": "low|medium|high", "reasoning": "1-2 sentence why" },
  "pitch_estimate":     { "value": "<like '5/12 - 7/12' or 'cannot tell'>",  "confidence": "low|medium|high", "reasoning": "..." },
  "material_guess":     { "value": "<like 'Asphalt 3-tab' or 'Concrete tile (flat profile)'>", "confidence": "low|medium|high", "reasoning": "..." },
  "damage_summary":     "<2-4 sentences describing visible issues>",
  "condition_score":    <integer 1-10; 10 = pristine, 1 = immediate replacement>,
  "notable_features":   ["chimney flashing visible", "skylight present", "rooftop solar", "..."],
  "recommended_addons": ["chimney","skylight","solar","ridgevent","boots","drip","gutters","icewater"],
  "notes":              "<anything the estimator should know before quoting>"
}

RULES
- recommended_addons MUST only contain ids from this exact list: chimney, skylight, solar, ridgevent, boots, drip, gutters, icewater. Omit any you don't recommend.
- If photos are unclear, taken too close, or don't show the roof at all, set squares/pitch confidence to "low" and put the reason in reasoning + notes.
- Material guess: prefer specific real product families (Asphalt 3-tab, Asphalt architectural, Concrete tile flat, Concrete tile S-profile, Clay tile, Metal standing seam, Metal corrugated). Do NOT invent brand names.
- Condition score should reflect what you see in PHOTOS, not assumptions. A roof that LOOKS new is a 9-10 even if it might be old.
- Squares are 100 sqft each. Typical CA residential roof is 15-30 squares.`

/**
 * Run Claude Vision on a set of photo URLs.
 * @param photoUrls  array of public image URLs (max ~6 for cost/latency)
 * @param context    optional {customer, address, scope} — gives the model more grounding
 * @returns { ok, analysis?, error?, raw? }
 */
export async function analyzeRoofPhotos({ photoUrls, context }) {
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    return { ok: false, error: 'photoUrls (non-empty array) required' }
  }
  if (photoUrls.length > 6) {
    return { ok: false, error: 'max 6 photos per analysis' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not set' }

  const client = new Anthropic({ apiKey })

  // Build a single user message: all the images, then the text prompt
  const content = []
  for (const url of photoUrls) {
    content.push({
      type: 'image',
      source: { type: 'url', url },
    })
  }

  const grounding = context
    ? `Context the rep gave us (may be incomplete or wrong, use as a hint only):
  - Address: ${context.address || 'unknown'}
  - Customer: ${context.customer || 'unknown'}
  - Initial scope notes: ${context.notes || 'none'}
`
    : ''

  content.push({
    type: 'text',
    text: `${grounding}\nAnalyze the ${photoUrls.length} roof photo(s) above and return your structured estimate. Respond with JSON only.`,
  })

  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
  } catch (err) {
    return { ok: false, error: 'vision API call failed: ' + (err.message || String(err)) }
  }

  // Parse the model's JSON output
  const textBlock = (response.content || []).find(b => b.type === 'text')
  const text = textBlock?.text || ''
  let parsed
  try {
    // Try direct parse first
    parsed = JSON.parse(text)
  } catch {
    // Fall back: extract first {...} block (handles stray markdown)
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch {}
    }
  }

  if (!parsed) {
    return { ok: false, error: 'vision returned non-JSON', raw: text }
  }

  // Stamp metadata so we know what produced this
  const analysis = {
    ...parsed,
    model: MODEL,
    analyzed_at: new Date().toISOString(),
    photos_analyzed: photoUrls.length,
  }

  return { ok: true, analysis }
}
