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

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4-turbo'

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
  try { parsed = JSON.parse(text) }
  catch (e) { throw new Error('AI returned invalid JSON') }
  if (!parsed.tiers?.good || !parsed.tiers?.better || !parsed.tiers?.best) {
    throw new Error('AI JSON missing required tiers')
  }
  for (const k of ['good', 'better', 'best']) {
    parsed.tiers[k].price = prices[k].total
    parsed.tiers[k].psf   = prices[k].psf
  }
  return { tiers: parsed.tiers, coverLetter: parsed.cover_letter || null }
}

/* ───────────── AI CHATBOT EDITOR ─────────────
 * Rep types natural-language edits ("add ridge vent, drop best 5%, swap rep to David").
 * GPT-4 Turbo function-calling translates into a structured patch.
 * Patch is applied -> creates v2 of the proposal (Option B versioning).
 */

const EDIT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'apply_proposal_edits',
      description: 'Apply one or more structured edits to the proposal. Always call this exactly once with the full set of changes.',
      parameters: {
        type: 'object',
        properties: {
          customer: {
            type: 'object',
            description: 'Customer fields to update. Omit any field you are not changing.',
            properties: {
              name:    { type: 'string' },
              phone:   { type: 'string' },
              email:   { type: 'string' },
              address: { type: 'string' },
              rep:     { type: 'string' },
              notes:   { type: 'string' },
            },
            additionalProperties: false,
          },
          scope: {
            type: 'object',
            description: 'Scope-of-work fields to update. Omit any field you are not changing.',
            properties: {
              roofType:      { type: 'string', enum: ['shingle', 'tile'] },
              tileSubtype:   { type: 'string', enum: ['flat', 's-type'] },
              squares:       { type: 'number' },
              pitch:         { type: 'number' },
              stories:       { type: 'integer' },
              layers:        { type: 'integer' },
              deckingSheets: { type: 'integer' },
              permit:        { type: 'number' },
            },
            additionalProperties: false,
          },
          addons: {
            type: 'object',
            description: 'Add-ons to add or remove. Use exact ids: icewater, ridgevent, boots, chimney, skylight, drip, gutters, solar.',
            properties: {
              add:    { type: 'array', items: { type: 'string' } },
              remove: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
          tier_overrides: {
            type: 'object',
            description: 'Per-tier overrides: copy edits or absolute price overrides.',
            properties: {
              good:   { type: 'object', properties: { price:{type:'number'}, name:{type:'string'}, tagline:{type:'string'}, narrative:{type:'string'}, warranty:{type:'string'}, material:{type:'string'}, brand:{type:'string'}, features:{type:'array',items:{type:'string'}} } },
              better: { type: 'object', properties: { price:{type:'number'}, name:{type:'string'}, tagline:{type:'string'}, narrative:{type:'string'}, warranty:{type:'string'}, material:{type:'string'}, brand:{type:'string'}, features:{type:'array',items:{type:'string'}} } },
              best:   { type: 'object', properties: { price:{type:'number'}, name:{type:'string'}, tagline:{type:'string'}, narrative:{type:'string'}, warranty:{type:'string'}, material:{type:'string'}, brand:{type:'string'}, features:{type:'array',items:{type:'string'}} } },
            },
            additionalProperties: false,
          },
          tier_price_pct: {
            type: 'object',
            description: 'Percent price adjustments per tier. e.g. { "best": -5 } drops Best 5%.',
            properties: { good:{type:'number'}, better:{type:'number'}, best:{type:'number'} },
            additionalProperties: false,
          },
          regenerate_with_ai: {
            type: 'boolean',
            description: 'Set true to fully re-run AI tier generation against the new scope (e.g. roof type changed). Default false.',
          },
          edit_summary: {
            type: 'string',
            description: 'Short human summary of what is being changed, shown to the rep for confirmation. Required.',
          },
        },
        required: ['edit_summary'],
        additionalProperties: false,
      },
    },
  },
]

const EDIT_SYSTEM = `You are an editor assistant for a roofing proposal builder. The rep gives you a natural-language instruction. You translate it into a single call to apply_proposal_edits with ONLY the fields that are changing. Be precise, never invent customer data, and ALWAYS write a clear edit_summary so the rep can confirm before saving. If the request is ambiguous, make the most reasonable interpretation and explain it in edit_summary.

Add-on ids (use exact strings): icewater, ridgevent, boots, chimney, skylight, drip, gutters, solar.
Tier keys: good, better, best.
Roof types: shingle, tile.
For percent edits like "drop Best 5%", use tier_price_pct: { best: -5 }.
For absolute overrides like "set Better to $19,500", use tier_overrides.better.price: 19500.
For copy edits like "make Better sound more premium", use tier_overrides.better.narrative or features.`

export async function chatEditProposal({ proposal, instruction }) {
  const ctx = {
    customer: {
      name: proposal.customer_name, phone: proposal.customer_phone, email: proposal.customer_email,
      address: proposal.customer_address, rep: proposal.rep_name, notes: proposal.inspection_notes,
    },
    scope: {
      roofType: proposal.roof_type, tileSubtype: proposal.tile_subtype, squares: proposal.squares,
      pitch: proposal.pitch, stories: proposal.stories, layers: proposal.layers,
      deckingSheets: proposal.decking_sheets, permit: proposal.permit_amount,
    },
    addons: proposal.addons || [],
    tiers: proposal.tiers || {},
  }

  const res = await client().chat.completions.create({
    model: MODEL(),
    temperature: 0.2,
    tools: EDIT_TOOLS,
    tool_choice: { type: 'function', function: { name: 'apply_proposal_edits' } },
    messages: [
      { role: 'system', content: EDIT_SYSTEM },
      { role: 'user',   content: `CURRENT PROPOSAL CONTEXT (for reference):\n${JSON.stringify(ctx, null, 2)}\n\nREP INSTRUCTION:\n${instruction}` },
    ],
  })

  const call = res.choices?.[0]?.message?.tool_calls?.[0]
  if (!call || call.function?.name !== 'apply_proposal_edits') {
    throw new Error('AI did not return an edit plan')
  }
  let patch
  try { patch = JSON.parse(call.function.arguments || '{}') }
  catch { throw new Error('AI returned invalid edit plan JSON') }
  return patch
}
