import { NextRequest, NextResponse } from 'next/server'
import { sendPendingPaymentReminders } from '@/lib/email/payment-reminder'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/payment-reminder
 * Dipanggil scheduler eksternal (cron) tiap ~15 menit.
 * Auth: header `Authorization: Bearer <CRON_SECRET>`.
 *
 * `?dry=1` — tidak mengirim apa pun dan tidak menandai payment; hanya
 * mengembalikan daftar penerima beserta HTML email-nya untuk diperiksa.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dry') === '1'
  const result = await sendPendingPaymentReminders({ dryRun })
  return NextResponse.json({ dryRun, ...result })
}
