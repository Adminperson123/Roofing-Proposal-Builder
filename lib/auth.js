import crypto from 'crypto'

const COOKIE_NAME = 'gpr_admin'

function secret() {
  return process.env.AUTH_SECRET || 'dev-secret-change-me-in-production-32chars'
}

function sign(value) {
  const sig = crypto.createHmac('sha256', secret()).update(value).digest('hex')
  return `${value}.${sig}`
}

function verify(signed) {
  if (!signed || typeof signed !== 'string') return null
  const i = signed.lastIndexOf('.')
  if (i < 0) return null
  const value = signed.slice(0, i)
  const sig   = signed.slice(i + 1)
  const want  = crypto.createHmac('sha256', secret()).update(value).digest('hex')
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  return value
}

export function makeAuthCookie(maxAgeDays = 30) {
  const payload = `ok:${Date.now()}`
  const signed  = sign(payload)
  const maxAge  = 60 * 60 * 24 * maxAgeDays
  return `${COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`
}

export function clearAuthCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax;`
}

export function isAuthed(req) {
  const raw = parseCookies(req.headers.cookie || '')[COOKIE_NAME]
  if (!raw) return false
  const value = verify(decodeURIComponent(raw))
  return !!(value && value.startsWith('ok:'))
}

export function parseCookies(header) {
  const out = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = rest.join('=')
  }
  return out
}

export function checkPassword(input) {
  const want = process.env.ADMIN_PASSWORD || ''
  if (!want) return false
  if (typeof input !== 'string' || input.length === 0) return false
  // constant-time compare
  if (input.length !== want.length) return false
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(want))
}

export function requireAuth(handler) {
  return async (req, res) => {
    if (!isAuthed(req)) { res.status(401).json({ error: 'Unauthorized' }); return }
    return handler(req, res)
  }
}

// Field link tokens — scoped to a single proposal id, time-limited.
// Used by /field/[id] on-site photo upload; bearer is the URL itself.
export function signFieldToken(proposalId, ttlDays = 30) {
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000
  return sign(`field:${proposalId}:${exp}`)
}

export function verifyFieldToken(proposalId, token) {
  const value = verify(token)
  if (!value) return false
  const parts = value.split(':')
  if (parts.length !== 3 || parts[0] !== 'field') return false
  if (parts[1] !== String(proposalId)) return false
  const exp = Number(parts[2])
  if (!Number.isFinite(exp) || exp < Date.now()) return false
  return true
}
