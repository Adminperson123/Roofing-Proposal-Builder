import { checkPassword, makeAuthCookie } from '../../../lib/auth'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { password } = req.body || {}
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Wrong password' })
  }
  res.setHeader('Set-Cookie', makeAuthCookie(30))
  res.status(200).json({ ok: true })
}
