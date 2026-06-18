import { type NextRequest, NextResponse } from 'next/server'

export async function updateCommunitySession(request: NextRequest) {
  return NextResponse.next({ request })
}
