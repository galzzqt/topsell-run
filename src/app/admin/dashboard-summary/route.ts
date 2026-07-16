import { NextResponse } from 'next/server'

import { getAdminSession } from '@/lib/admin/auth'
import { getAdminDashboardSummary } from '@/lib/admin/dashboard-summary'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await getAdminDashboardSummary()
    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Failed to load admin dashboard summary:', error)
    return NextResponse.json({ error: 'Gagal memuat ringkasan dashboard.' }, { status: 500 })
  }
}
