/**
 * POST /api/assistant  — app-wide AI Assistant (v3.4).
 *
 * The rep/owner asks questions in plain English ("how many proposals closed
 * this month?", "who are my hot leads?", "show me the Beltran proposal").
 * OpenAI function-calling routes to READ-ONLY tools that query Supabase.
 *
 * Body: { messages: [{ role:'user'|'assistant', content }] }
 * Returns: { reply }
 *
 * Tools are all read-only — the assistant can look things up but never writes.
 * Auth-gated (requireAuth) — admin only.
 */

import OpenAI from 'openai'
import { serverClient } from '../../lib/supabase'
import { requireAuth } from '../../lib/auth'

export const config = { maxDuration: 60 }

const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o'

const SYSTEM = `You are the assistant inside the Good People Roofing Proposal Builder.
You help the owner and reps understand their proposal pipeline. Be concise and
specific — use real numbers from the tools. When asked about money, format as
US dollars. If a tool returns nothing, say so plainly. Never invent data.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Overall pipeline stats: total proposals, sent/viewed/accepted counts, revenue closed, conversion rate.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_proposals',
      description: 'List recent proposals, optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['sent', 'viewed', 'accepted', 'expired', 'any'], description: 'Filter by status, or "any".' },
          limit:  { type: 'integer', description: 'Max rows (default 10, max 30).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_proposal',
      description: 'Find one proposal by proposal number or customer name. Returns its full detail.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: 'A prop number (e.g. GP-123456) or a customer name.' } },
        required: ['query'],
      },
    },
  },
]

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not set' })

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'messages[] required' })
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const sb = serverClient()

  // Keep only role+content from client messages; cap history to last 12 turns.
  const convo = [
    { role: 'system', content: SYSTEM },
    ...messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') })),
  ]

  try {
    // Tool loop — max 4 rounds to keep latency + cost bounded.
    for (let round = 0; round < 4; round++) {
      const res1 = await client.chat.completions.create({
        model: MODEL(),
        temperature: 0.3,
        max_tokens: 700,
        tools: TOOLS,
        messages: convo,
      })
      const msg = res1.choices?.[0]?.message
      if (!msg) return res.status(500).json({ error: 'no response from model' })

      if (!msg.tool_calls || !msg.tool_calls.length) {
        return res.status(200).json({ reply: msg.content || '(no answer)' })
      }

      // Execute each tool call, append results, loop.
      convo.push(msg)
      for (const call of msg.tool_calls) {
        let args = {}
        try { args = JSON.parse(call.function.arguments || '{}') } catch {}
        const result = await runTool(sb, call.function.name, args)
        convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
      }
    }
    return res.status(200).json({ reply: 'I looked into that but could not finish — try asking more specifically.' })
  } catch (err) {
    console.error('assistant error:', err)
    return res.status(500).json({ error: err.message || 'Assistant failed' })
  }
}

/** Execute one read-only tool. Always returns a plain object. */
async function runTool(sb, name, args) {
  try {
    if (name === 'get_stats') {
      const { data } = await sb.from('proposals').select('status, selected_tier, tiers, accepted_total').is('superseded_by_id', null)
      const rows = data || []
      const closed = rows.filter(p => p.status === 'accepted' || p.status === 'signed')
      const revenue = closed.reduce((s, p) => {
        if (p.accepted_total) return s + Number(p.accepted_total)
        const t = p.tiers?.[p.selected_tier]
        return s + (t?.price ? Number(t.price) : 0)
      }, 0)
      return {
        total: rows.length,
        sent: rows.filter(p => p.status === 'sent').length,
        viewed: rows.filter(p => p.status === 'viewed').length,
        accepted: closed.length,
        expired: rows.filter(p => p.status === 'expired').length,
        revenue_closed: revenue,
        conversion_pct: rows.length ? Math.round((closed.length / rows.length) * 100) : 0,
      }
    }

    if (name === 'list_proposals') {
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 30)
      let q = sb.from('proposals')
        .select('prop_num, customer_name, status, rep_name, selected_tier, created_at')
        .is('superseded_by_id', null)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (args.status && args.status !== 'any') q = q.eq('status', args.status)
      const { data } = await q
      return { proposals: data || [] }
    }

    if (name === 'find_proposal') {
      const query = String(args.query || '').trim()
      if (!query) return { error: 'query required' }
      let { data } = await sb.from('proposals')
        .select('prop_num, customer_name, customer_phone, customer_address, status, rep_name, roof_type, squares, selected_tier, tiers, created_at, viewed_at, accepted_at, view_count')
        .or(`prop_num.ilike.%${query}%,customer_name.ilike.%${query}%`)
        .is('superseded_by_id', null)
        .limit(3)
      return { matches: data || [] }
    }

    return { error: 'unknown tool: ' + name }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

export default requireAuth(handler)
