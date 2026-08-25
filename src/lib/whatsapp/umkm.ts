import 'server-only'

import { findUmkmById } from '@/lib/db'
import { sendUmkmPaymentConfirmationWebhook } from '@/lib/ghl/webhook'

/**
 * Kirim webhook konfirmasi pembayaran tenant UMKM.
 * Dipanggil dari setiap jalur yang menandai pembayaran UMKM lunas
 * (webhook Xendit, sync dashboard tenant, dan perubahan status manual admin).
 */
export async function sendUmkmPaymentConfirmation(umkmId: string, amount: number) {
  try {
    const umkm = await findUmkmById(umkmId)
    if (!umkm) return { skipped: true }

    return await sendUmkmPaymentConfirmationWebhook({
      phone: umkm.phone,
      email: umkm.email || '',
      name: umkm.name,
      picName: umkm.pic_name,
      umkmCode: umkm.umkm_code,
      businessField: umkm.business_field,
      amount,
    })
  } catch (error) {
    console.error('Failed to send UMKM payment confirmation webhook:', error)
    return { skipped: true }
  }
}
