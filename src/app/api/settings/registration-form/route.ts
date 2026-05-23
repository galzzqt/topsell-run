import { NextResponse } from 'next/server'
import { readAdminSettings } from '@/lib/admin/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await readAdminSettings()
  return NextResponse.json(settings.registrationForm)
}
