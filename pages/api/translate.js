/**
 * POST /api/translate  — English → Latin American Spanish (v3.7.1).
 *
 * Translates proposal/message text for Spanish-speaking customers. Preserves
 * emojis, URLs, {{handlebars}} variables, brand names, and line breaks.
 * Uses a warm, friendly tone with the "tú" form.
 *
 * Body: { text } or { texts: [...] }
 * Returns: { text } or { texts: [...] }
 * Auth: requireAuth (admin only — used from the Send modal).
 */

import OpenAI from 'openai'
import { requireAuth } from '../../lib/auth'

export const config = { maxDuration: 30 }

const SYSTEM = `You translate English text into Latin American Spanish for a
residential roofing company's customers.

RULES
- Use warm, friendly, natural Latin American Spanish. Use the "tú" form, not "usted".
- PRESERVE EXACTLY, untranslated: emojis, URLs/links, {{handlebars_variables}},
  brand names (Good People Roofing, GAF, Owens Corning, etc.), phone numbers,
  license numbers, and all line breaks / formatting.
- Do not add or remove content. Translate meaning, not word-for-word.
- Return ONLY the translated text — no quotes, no preamble, no explanation.`

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  const body = req.body || {}
  const single = typeof body.text === 'string'
  const inputs = single ? [body.text] : (Array.isArray(body.texts) ? body.texts : [])
  if (!inputs.length) return res.status(400).json({ error: 'text or texts[] required' })

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  try {
    const out = []
    for (const text of inputs) {
      if (!text || !String(text).trim()) { out.push(text || ''); continue }
      const r = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: 0.3,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: String(text) },
        ],
      })
      out.push(r.choices?.[0]?.message?.content || text)
    }
    return res.status(200).json(single ? { text: out[0] } : { texts: out })
  } catch (err) {
    console.error('translate error:', err)
    return res.status(500).json({ error: err.message || 'Translation failed' })
  }
}

export default requireAuth(handler)
