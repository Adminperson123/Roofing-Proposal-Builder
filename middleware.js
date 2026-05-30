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
  '/c/',                   // public customer project timeline (uuid-token gated)
  '/present/',             // presentation mode — shows already-public proposal data
  '/api/customer/',        // public customer timeline API (uuid-token gated)
  '/field/',               // mobile on-site photo upload (token-gated at endpoint)
  '/api/proposal/',        // public proposal API (id-gated, public read OK)
  '/api/change-orders',    // public list of customer-toggleable adders
  '/api/brand-assets',     // public read of brand asset URLs (used by /p/[id])
  '/api/roofmap',          // public read of the annotated roof aerial (used by /p/[id] + PDF; id-gated, image only)
  '/api/streetview',       // public read of the curb-shot image (used by /p/[id]; image only)
  '/api/aerialview',       // public read of the 3D flyover lookup (used by /present + /p/[id])
  '/api/cron/',            // scheduled jobs — gated by their own CRON_SECRET bearer, not the admin cookie
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
