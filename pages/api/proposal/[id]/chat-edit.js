// AI chatbot endpoint: rep types natural-language instruction,
// GPT-4 Turbo function-calling returns a structured patch.
// Caller (UI) shows the patch + edit_summary as a preview, then calls /edit to apply.
import { serverClient } from '../../../../lib/supabase'
import { chatEditProposal } from '../../../../lib/openai'
import { requireAuth } from '../../../../lib/auth'

export const config = { maxDuration: 30 }

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id } = req.query
  const { instruction } = req.body || {}
  if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
    return res.status(400).json({ error: 'instruction required' })
  }

  try {
    const sb = serverClient()
    const { data, error } = await sb.from('proposals').select('*').eq('id', id).single()
    if (error || !data) return res.status(404).json({ error: 'Proposal not found' })

    const patch = await chatEditProposal({ proposal: data, instruction })
    res.status(200).json({ ok: true, patch })
  } catch (err) {
    console.error('chat-edit error:', err)
    res.status(500).json({ error: 'AI editor failed: ' + (err.message || 'unknown') })
  }
}

export default requireAuth(handler)
