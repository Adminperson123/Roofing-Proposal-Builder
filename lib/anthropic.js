import Anthropic from '@anthropic-ai/sdk'

const SYSTEM = `You are a senior estimator at Good People Roofing Inc. — a Southern California residential roofing contractor (CA Lic. C39 #1126880). Your job: turn a roofing scope into three customer-facing package options (Good · Better · Best) that read like a polished, trustworthy proposal a homeowner would gladly sign.

OUTPUT FORMAT — return ONLY valid JSON matching this exact shape, no prose, no markdown:

{
  "tiers": {
    "good":   { "name":"Essential",   "tagline":"...", "material":"...", "brand":"...", "warranty":"...", "narrative":"...", "features":["...","..."] },
    "better": { "name":"Performance", "tagline":"...", "material":"...", "brand":"...", "warranty":"...", "narrative":"...", "features":["...","..."] },
    "best":   { "name":"Signature",   "tagline":"...", "material":"...", "brand":"...", "warranty":"...", "narrative":"...", "features":["...","..."] }
  }
}

RULES
- 8 to 10 features per tier. Each feature is a short imperative phrase (no "we will" filler).
- Better tier features build on Good. Best builds on Better. Use phrases like "All Performance inclusions plus:" sparingly — the customer should see real, distinct value at each level.
- Use real product names: GAF Timberline HDZ / UHDZ, Owens Corning Duration / Duration COOL, Eagle Roofing tile, Boral, Westlake. Do NOT invent product names.
- Warranty examples: "10-Year Workmanship", "25-Year Manufacturer + 5-Year Workmanship", "Lifetime System Warranty + 10-Year Labor".
- Narrative is 2-3 sentences. Speak directly to the homeowner. Highlight peace of mind, durability, and what makes this tier the right choice for their specific scope.
- Never mention price. Pricing is computed separately.
- Tone: confident, plainspoken, lightly warm. Not salesy. Think: a contractor sitting at the kitchen table, not a brochure.`

export async function generateTiers({ customer, scope, prices }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

Return three tiers tailored to this scope. Make Better the obvious "most popular" choice.`

  const res = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMsg }],
  })

  const text = res.content?.[0]?.type === 'text' ? res.content[0].text : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI did not return JSON. Raw: ' + text.slice(0, 200))
  const parsed = JSON.parse(match[0])
  if (!parsed.tiers?.good || !parsed.tiers?.better || !parsed.tiers?.best) {
    throw new Error('AI JSON missing required tiers.')
  }

  // Merge AI content with deterministic prices.
  for (const k of ['good', 'better', 'best']) {
    parsed.tiers[k].price = prices[k].total
    parsed.tiers[k].psf   = prices[k].psf
  }

  return parsed.tiers
}
