'use server'

import { getUmkmSession } from '@/lib/auth/umkm'
import { findUmkmById, findUmkmPaymentByUmkmId } from '@/lib/db'
import { syncUmkmXenditPaymentStatus } from './umkm-payments'
import type { UmkmRegistration, UmkmPayment } from '@/lib/types'

export async function getUmkmSessionAction() {
  const session = await getUmkmSession()
  if (!session) return { user: null }
  return { user: { id: session.id, phone: session.phone, name: session.name } }
}

export async function fetchUmkmDashboardDataAction() {
  const session = await getUmkmSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  // Check and auto-sync with Xendit if status is not paid yet
  try {
    await syncUmkmXenditPaymentStatus(session.id)
  } catch (err) {
    console.error('Error auto-syncing UMKM payment with Xendit:', err)
  }

  let [umkm, payment] = await Promise.all([
    findUmkmById(session.id),
    findUmkmPaymentByUmkmId(session.id),
  ])

  // Auto-sync free registrations to paid
  if (umkm && (umkm.payment_amount ?? 500000) <= 0 && (!payment || umkm.payment_status !== 'paid')) {
    try {
      const { updateUmkm, createUmkmPayment } = await import('@/lib/db')
      await updateUmkm(umkm.id, { payment_status: 'paid', payment_amount: 0 })
      umkm.payment_status = 'paid'
      umkm.payment_amount = 0
      if (!payment) {
        payment = await createUmkmPayment({
          umkm_id: umkm.id,
          amount: 0,
          payment_method: 'voucher_free',
          payment_reference: `FREE-${umkm.umkm_code}`,
          status: 'paid',
          paid_at: umkm.created_at || new Date().toISOString(),
        })
      }
    } catch {
      // non-fatal
    }
  }

  return {
    umkm: umkm as UmkmRegistration | null,
    payment: payment as UmkmPayment | null,
  }
}
