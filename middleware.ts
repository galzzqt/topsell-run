import { type NextRequest, NextResponse } from 'next/server'
import { getCommunitySessionFromRequest, COMMUNITY_COOKIE } from './src/lib/auth/community-session'
import { getFamilySessionFromRequest, FAMILY_COOKIE } from './src/lib/auth/family-session'
import { getAdminSessionFromRequest, ADMIN_COOKIE } from './src/lib/admin/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const communitySession = await getCommunitySessionFromRequest(request)
  const familySession = await getFamilySessionFromRequest(request)
  const adminSession = await getAdminSessionFromRequest(request)

  // === Route /admin hanya bisa diakses oleh admin
  if (pathname.startsWith('/admin')) {
    if (!adminSession) {
      // Biarkan halaman admin menampilkan form login
      return NextResponse.next({ request })
    }
  }

  // === Route protected (dashboard, community-dashboard)
  const isProtectedUserRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/community-dashboard')

  if (isProtectedUserRoute && !communitySession && !familySession) {
    const loginUrl = pathname.startsWith('/community-dashboard') ? '/community-login' : '/login'
    return NextResponse.redirect(new URL(loginUrl, request.url))
  }

  // === Jika sudah login, jangan akses login/register
  const isLoginRegister = [
    '/login',
    '/register',
    '/community-login',
    '/community-register'
  ].some(route => pathname.startsWith(route))

  if (isLoginRegister) {
    if (adminSession) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    if (communitySession) {
      return NextResponse.redirect(new URL('/community-dashboard', request.url))
    }
    if (familySession) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // === Clear invalid/expired cookies
  const response = NextResponse.next({ request })
  if (!communitySession && request.cookies.get(COMMUNITY_COOKIE)) {
    response.cookies.delete(COMMUNITY_COOKIE)
  }
  if (!familySession && request.cookies.get(FAMILY_COOKIE)) {
    response.cookies.delete(FAMILY_COOKIE)
  }
  if (!adminSession && request.cookies.get(ADMIN_COOKIE)) {
    response.cookies.delete(ADMIN_COOKIE)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/hero.png|images/header.png).*)'
  ],
}
