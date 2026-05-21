import { serverClient } from '../../lib/supabase'
import { requireAuth } from '../../lib/auth'

function newInspectionNum() {
  return 'INS-' + Date.now().toString().slice(-6)
}

async function handler(req, res) {
  const sb = serverClient()

  if (req.method === 'GET') {
    const { proposal_id, q } = req.query
    let query = sb.from('inspections').select('*').order('created_at', { ascending: false }).limit(100)
    if (proposal_id) query = query.eq('proposal_id', proposal_id)
    if (q) query = query.or(`customer_name.ilike.%${q}%,customer_address.ilike.%${q}%,inspection_num.ilike.%${q}%`)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'Query failed' })
    return res.status(200).json({ inspections: data || [] })
  }

  if (req.method === 'POST') {
    const { proposal_id, customer_name, customer_address, customer_phone, customer_email, rep_name, ghl_contact_id } = req.body || {}
    if (!customer_name || !customer_address) return res.status(400).json({ error: 'customer_name and customer_address required' })
    const row = {
      inspection_num: newInspectionNum(),
      proposal_id: proposal_id || null,
      customer_name,
      customer_address,
      customer_phone: customer_phone || null,
      customer_email: customer_email || null,
      rep_name: rep_name || null,
      ghl_contact_id: ghl_contact_id || null,
      sections: {},
      photos: [],
    }
    const { data, error } = await sb.from('inspections').insert(row).select().single()
    if (error) return res.status(500).json({ error: 'Create failed: ' + error.message })
    return res.status(200).json({ inspection: data })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

export default requireAuth(handler)
