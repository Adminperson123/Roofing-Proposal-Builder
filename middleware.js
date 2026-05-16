import { NextResponse } from 'next/server'

const COOKIE_NAME = 'gpr_admin'

// Routes that DO NOT require admin auth.
// Everything else is gated.
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/webhook',          // GHL POST endpoint
  '/p/',                   // public proposal page
  '/field/',               // mobile on-site photo upload (token-gated at endpoint)
  '/api/proposal/',        // public proposal API (id-gated, public read OK)
  '/api/change-orders',    // public list of customer-toggleable adders
  '/api/brand-assets',     // public read of brand asset URLs (used by /p/[id])
  '/logo.png',
  '/favicon.ico',
]

function isPublic(pathname) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p))
}

export function middleware(req) {
  const { pathname } = req.nextUrl
  // Next.js internal + static
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) return NextResponse.next()
  if (isPublic(pathname)) return NextResponse.next()

  // Lightweight auth check — actual signature verification happens server-side in API routes.
  // Here we only check that the cookie EXISTS; if it's invalid the API will 401 and the
  // client will redirect to /login.
  const cookie = req.cookies.get(COOKIE_NAME)?.value
  if (!cookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
}
