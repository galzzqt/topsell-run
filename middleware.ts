import { NextResponse, type NextRequest } from 'next/server'
import { getAdminSessionFromRequest } from '@/lib/admin/auth'
import { getCommunitySessionFromRequest } from '@/lib/auth/community-session'
import { getFamilySessionFromRequest } from '@/lib/auth/family-session'
import { getIndividualSessionFromRequest } from '@/lib/auth/individual-session'
import { getPacerSessionFromRequest } from '@/lib/auth/pacer-session'

export const config = {
  matcher: [
    '/(admin|dashboard|community-dashboard|bro-and-sist-dashboard|individu-dashboard|pacer-dashboard|login|register|community-login)(.*)',
    '/((?!_next/static|_next/image|favicon.ico|assets/|api/).*)',
  ],
}

function setSecurityHeaders(headers: Headers) {
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-DNS-Prefetch-Control', 'on')
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next()
  setSecurityHeaders(response.headers)

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const adminSession = await getAdminSessionFromRequest(request)
    if (!adminSession) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname.startsWith('/community-dashboard')) {
    const session = await getCommunitySessionFromRequest(request)
    if (!session) {
      const loginUrl = new URL('/community-login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname.startsWith('/bro-and-sist-dashboard') || pathname.startsWith('/dashboard')) {
    const session = await getFamilySessionFromRequest(request)
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname.startsWith('/individu-dashboard')) {
    const session = await getIndividualSessionFromRequest(request)
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (pathname.startsWith('/pacer-dashboard')) {
    const session = await getPacerSessionFromRequest(request)
    if (!session) {
      const home = new URL('/', request.url)
      return NextResponse.redirect(home)
    }
  }

  if (pathname === '/login' || pathname === '/register') {
    const familySession = await getFamilySessionFromRequest(request)
    if (familySession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    const individualSession = await getIndividualSessionFromRequest(request)
    if (individualSession) {
      return NextResponse.redirect(new URL('/individu-dashboard', request.url))
    }
  }

  if (pathname === '/community-login') {
    const communitySession = await getCommunitySessionFromRequest(request)
    if (communitySession) {
      return NextResponse.redirect(new URL('/community-dashboard', request.url))
    }
  }

  if (pathname.startsWith('/admin/login')) {
    const adminSession = await getAdminSessionFromRequest(request)
    if (adminSession) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }

  return response
}
