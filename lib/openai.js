/**
 * OpenAI integration — proposal tier generation.
 *
 * Replaces the old lib/anthropic.js. Good People Roofing standardized on OpenAI.
 *
 * generateTiers() turns a roofing scope into three customer-facing packages
 * (Good / Better / Best) plus a short personalized cover letter.
 *
 * Env vars:
 *   OPENAI_API_KEY  — required
 *   OPENAI_MODEL    — optional, defaults to gpt-4o
 */

import OpenAI from 'openai'

const SYSTEM = `You are a senior estimator at Good People Roofing Inc. — a Southern California residential roofing contractor (CA Lic. C39 #1126880). Your job: turn a roofing scope into three customer-facing package options (Good · Better · Best) that read like a polished, trustworthy proposal a homeowner would gladly sign.

OUTPUT FORMAT — return ONLY a valid JSON object (no markdown fences) with this exact shape:

{
  "tiers": {
    "good":   { "name":"Essential",   "tagline":"...", "material":"...", "brand":"...", "warranty":"...", "narrative":"...", "features":["...","..."] },
    "better": { "name":"Performance", "tagline":"...", "material":"...", "brand":"...", "warranty":"...", "narrative":"...", "features":["...","..."] },
    "best":   { "name":"Signature",   "tagline":"...", "material":"...", "brand":"...", "warranty":"...", "narrative":"...", "features":["...","..."] }
  },
  "cover_letter": "..."
}

RULES
- 8 to 10 features per tier. Each feature is a short imperative phrase (no "we will" filler).
- Better tier features build on Good. Best builds on Better. Use phrases like "All Performance inclusions plus:" sparingly — the customer should see real, distinct value at each level.
- Use real product names: GAF Timberline HDZ / UHDZ, Owens Corning Duration / Duration COOL, Eagle Roofing tile, Boral, Westlake. Do NOT invent product names.
- Warranty examples: "10-Year Workmanship", "25-Year Manufacturer + 5-Year Workmanship", "Lifetime System Warranty + 10-Year Labor".
- Narrative is 2-3 sentences. Speak directly to the homeowner. Highlight peace of mind, durability, and what makes this tier the right choice for their specific scope.
- Never mention price. Pricing is computed separately.
- Tone: confident, plainspoken, lightly warm. Not salesy. Think: a contractor sitting at the kitchen table, not a brochure.
- cover_letter: 3 short sentences max. Personalized to the homeowner by name and address. Warm, not corporate. Sign-off implied.`

function client() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o'

/**
 * Generate three proposal tiers + a cover letter.
 * @returns { tiers, coverLetter }  — tiers each get price/psf merged in from `prices`
 */
export async function generateTiers({ customer, scope, prices }) {
  const userMsg = `SCOPE
- Roof type: ${scope.roofType}${scope.tileSubtype ? ' (' + scope.tileSubtype + ')' : ''}
- Squares: ${scope.squares} (~${(scope.squares * 100).toLocaleString()} sqft)
- Pitch: ${scope.pitch}/12${scope.pitch >= 7 ? ' (steep)' : ''}
- Stories: ${scope.stories}
- Existing layers (tear-off): ${scope.layers}
- Decking sheets to replace: ${scope.deckingSheets || 0}
- Permit: ${scope.permit ? '$' + scope.permit : 'none'}
- Selected add-ons: ${(scope.addons || []).join(', ') || 'none'}

CUSTOMER
- ${customer.name}, ${customer.address}
- Inspection notes: ${customer.notes || 'none provided'}

Return three tiers tailored to this scope. Make Better the obvious "most popular" choice. Also write a personalized cover_letter (3 sentences max).`

  const res = await client().chat.completions.create({
    model: MODEL(),
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 2500,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user',   content: userMsg },
    ],
  })

  const text = res.choices?.[0]?.message?.content || ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('AI returned invalid JSON. Raw: ' + text.slice(0, 200))
  }
  if (!parsed.tiers?.good || !parsed.tiers?.better || !parsed.tiers?.best) {
    throw new Error('AI JSON missing required tiers')
  }

  // Merge AI content with deterministic prices.
  for (const k of ['good', 'better', 'best']) {
    parsed.tiers[k].price = prices[k].total
    parsed.tiers[k].psf   = prices[k].psf
  }

  return { tiers: parsed.tiers, coverLetter: parsed.cover_letter || null }
}
