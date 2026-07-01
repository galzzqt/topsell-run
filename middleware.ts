import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  return NextResponse.next({ request })
}

export const runtime = 'edge'

export const config = {
  matcher: [
    '/(admin|dashboard|community-dashboard|login|register|community-login)(.*)'
  ],
}
