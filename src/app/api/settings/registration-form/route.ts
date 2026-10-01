import { NextResponse } from 'next/server'
import { readPublicRegistrationForm } from '@/lib/admin/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await readPublicRegistrationForm())
}
