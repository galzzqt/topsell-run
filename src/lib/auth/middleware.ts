import { type NextRequest, NextResponse } from 'next/server'
import { getCommunitySessionFromRequest, COMMUNITY_COOKIE } from './community-session'
import { getFamilySessionFromRequest, FAMILY_COOKIE } from './family-session'

/**
 * Validates and updates community/family sessions in middleware.
 * This function checks session validity, clears expired sessions, and handles redirects.
 */
export async function updateCommunitySession(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/community-login', '/community-register']
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route))
  
  // Check community session
  const communitySession = getCommunitySessionFromRequest(request)
  const familySession = getFamilySessionFromRequest(request)
  
  const hasValidSession = communitySession || familySession
  
  // Protected routes (dashboard, admin, etc.)
  const protectedRoutes = ['/dashboard', '/community-dashboard', '/admin']
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  // If trying to access protected route without valid session, redirect to login
  if (isProtectedRoute && !hasValidSession) {
    const loginUrl = pathname.startsWith('/community-dashboard') ? '/community-login' : '/login'
    return NextResponse.redirect(new URL(loginUrl, request.url))
  }
  
  // If trying to access login/register pages while already logged in, redirect to dashboard
  if (!isPublicRoute && hasValidSession) {
    if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (pathname.startsWith('/community-login') || pathname.startsWith('/community-register')) {
      return NextResponse.redirect(new URL('/community-dashboard', request.url))
    }
  }
  
  // Clear invalid/expired cookies by setting them with maxAge: 0
  const response = NextResponse.next({ request })
  
  if (!communitySession && request.cookies.get(COMMUNITY_COOKIE)) {
    response.cookies.delete(COMMUNITY_COOKIE)
  }
  
  if (!familySession && request.cookies.get(FAMILY_COOKIE)) {
    response.cookies.delete(FAMILY_COOKIE)
  }
  
  return response
}
