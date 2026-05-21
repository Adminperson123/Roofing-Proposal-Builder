import { clearAuthCookie } from '../../../lib/auth'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearAuthCookie())
  res.status(200).json({ ok: true })
}
