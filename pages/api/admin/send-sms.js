/**
 * ONE-OFF ADMIN ENDPOINT — send a custom SMS to a GHL contactId.
 * Protected by CRON_SECRET. Use for manual corrections (e.g., apology texts).
 *
 * POST /api/admin/send-sms
 * Headers:  Authorization: Bearer <CRON_SECRET>
 * Body:     { "contactId": "...", "message": "..." }
 */

import { sendSms } from '../../../lib/ghl'

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected) return res.status(500).json({ error: 'CRON_SECRET not set' })
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (provided !== expected) return res.status(401).json({ error: 'unauthorized' })

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const { contactId, message } = req.body || {}
  if (!contactId || !message) {
    return res.status(400).json({ error: 'contactId and message required' })
  }

  const result = await sendSms({ contactId, message })
  return res.status(result.ok ? 200 : 500).json(result)
}
