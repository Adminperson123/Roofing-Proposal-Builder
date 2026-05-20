/**
 * OpenAI Vision roof analysis.
 *
 * Takes a list of photo URLs (1-6 typical) and returns a CONSERVATIVE structured
 * analysis the rep can review and edit before generating a proposal.
 *
 * Conservative means: we return descriptive estimates + confidence labels, not
 * hard numbers we expect the system to auto-trust. The rep is still the source
 * of truth. As accuracy improves over months of use, we can switch to a more
 * aggressive auto-fill mode.
 *
 * Uses gpt-4o specifically (hardcoded) — it's vision-capable and JSON-reliable.
 * We do NOT use OPENAI_MODEL here because that env var might be set to a
 * text-only model that would reject image inputs.
 *
 * Output shape (also documented in the DB column comment):
 * {
 *   model: "gpt-4o",
 *   analyzed_at: "2026-05-20T01:23:45Z",
 *   photos_analyzed: 3,
 *   squares_estimate: { value: "25-30", confidence: "medium", reasoning: "..." },
 *   pitch_estimate:   { value: "5/12 - 7/12", confidence: "low", reasoning: "..." },
 *   material_guess:   { value: "Asphalt 3-tab shingle", confidence: "high", reasoning: "..." },
 *   damage_summary:   "Moderate granule loss on south-facing slopes; one missing shingle near ridge",
 *   condition_score:  6,
 *   notable_features: ["chimney flashing visible", "skylight present", "rooftop solar"],
 *   recommended_addons: ["chimney", "skylight"],
 *   notes: "..."
 * }
 */

import OpenAI from 'openai'

const VISION_MODEL = 'gpt-4o'

const SYSTEM = `You are an expert roof inspector helping a Southern California residential roofing company (Good People Roofing Inc.) estimate scope from photos.

Your job: produce a CONSERVATIVE first-pass analysis a human estimator will review before quoting. Be honest about uncertainty. It is BETTER to say "cannot tell" than to guess.

OUTPUT FORMAT — return ONLY a valid JSON object (no markdown fences) with this exact shape:

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

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

/**
 * Run OpenAI Vision on a set of photo URLs.
 * @param photoUrls  array of public image URLs (max ~6 for cost/latency)
 * @param context    optional {customer, address, notes} — gives the model grounding
 * @returns { ok, analysis?, error?, raw? }
 */
export async function analyzeRoofPhotos({ photoUrls, context }) {
  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    return { ok: false, error: 'photoUrls (non-empty array) required' }
  }
  if (photoUrls.length > 6) {
    return { ok: false, error: 'max 6 photos per analysis' }
  }
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'OPENAI_API_KEY not set' }
  }

  // Build the user message: all images, then the text prompt.
  const userContent = photoUrls.map(url => ({
    type: 'image_url',
    image_url: { url },
  }))

  const grounding = context
    ? `Context the rep gave us (may be incomplete or wrong, use as a hint only):
  - Address: ${context.address || 'unknown'}
  - Customer: ${context.customer || 'unknown'}
  - Initial scope notes: ${context.notes || 'none'}
`
    : ''

  userContent.push({
    type: 'text',
    text: `${grounding}\nAnalyze the ${photoUrls.length} roof photo(s) above and return your structured estimate as JSON.`,
  })

  let res
  try {
    res = await client().chat.completions.create({
      model: VISION_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.2,  // low — we want consistent, careful estimates
      max_tokens: 1500,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: userContent },
      ],
    })
  } catch (err) {
    return { ok: false, error: 'vision API call failed: ' + (err.message || String(err)) }
  }

  const text = res.choices?.[0]?.message?.content || ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // Fallback: extract first {...} block in case the model wrapped it
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { parsed = JSON.parse(match[0]) } catch {}
    }
  }

  if (!parsed) {
    return { ok: false, error: 'vision returned non-JSON', raw: text }
  }

  const analysis = {
    ...parsed,
    model: VISION_MODEL,
    analyzed_at: new Date().toISOString(),
    photos_analyzed: photoUrls.length,
  }

  return { ok: true, analysis }
}
