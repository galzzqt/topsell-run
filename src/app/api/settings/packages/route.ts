import { NextResponse } from 'next/server'
import { getPackagesSettings } from '@/lib/admin/settings'

export const dynamic = 'force-dynamic'

export async function GET() {
  const packages = await getPackagesSettings()
  return NextResponse.json(packages)
}
