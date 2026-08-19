'use server'

import { getUmkmSession } from '@/lib/auth/umkm'
import { generateRandomReference } from '@/lib/utils/format'
import {
  findUmkmById,
  createUmkmPayment as dbCreateUmkmPayment,
  findUmkmPaymentByUmkmId,
} from '@/lib/db'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { revalidatePath } from 'next/cache'

const XENDIT_SESSION_URL = 'https://api.xendit.co/sessions'
const DEFAULT_XENDIT_CHANNELS = [
  'BCA_VIRTUAL_ACCOUNT', 'BNI_VIRTUAL_ACCOUNT', 'BRI_VIRTUAL_ACCOUNT',
  'MANDIRI_VIRTUAL_ACCOUNT', 'PERMATA_VIRTUAL_ACCOUNT', 'QRIS',
]

function getXenditChannels() {
  return (process.env.XENDIT_ALLOWED_CHANNELS || DEFAULT_XENDIT_CHANNELS.join(','))
    .split(',').map((c) => c.trim()).filter(Boolean)
}

function canUseReturnUrl(appUrl: string | undefined) {
  if (!appUrl) return false
  try { return new URL(appUrl).protocol === 'https:' } catch { return false }
}

function getUmkmReturnUrls(paymentRef?: string) {
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!rawAppUrl || !canUseReturnUrl(rawAppUrl)) return {}
  const appUrl = rawAppUrl.replace(/\/+$/, '')

  const refQuery = paymentRef ? `&ref=${encodeURIComponent(paymentRef)}` : ''
  return {
    success_return_url: `${appUrl}/umkm-dashboard?payment=success${refQuery}`,
    cancel_return_url: `${appUrl}/umkm-dashboard?payment=cancelled${refQuery}`,
  }
}

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'umkm'
}

function toXenditName(value: string | null | undefined) {
  return (value || 'UMKM').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50) || 'UMKM'
}

export async function createUmkmPayment() {
  const session = await getUmkmSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const umkm = await findUmkmById(session.id)
  if (!umkm) return { error: 'Data UMKM tidak ditemukan.' }

  if (umkm.status !== 'approved') {
    return { error: 'Pendaftaran UMKM belum disetujui admin. Silakan tunggu persetujuan.' }
  }

  if (umkm.payment_status === 'paid') {
    return { error: 'Pembayaran sudah selesai.' }
  }

  // Check if there's already a pending payment
  const existingPayment = await findUmkmPaymentByUmkmId(session.id)
  if (existingPayment && existingPayment.status === 'paid') {
    return { error: 'Pembayaran sudah selesai.' }
  }

  const amount = umkm.payment_amount || 500000

  // Free if amount is 0 (full voucher discount)
  if (amount <= 0) {
    try {
      const freeRef = `UMKM-FREE-${Date.now()}`
      await dbCreateUmkmPayment({
        umkm_id: umkm.id,
        amount: 0,
        payment_reference: freeRef,
        xendit_session_id: null,
        checkout_url: null,
      })
      const { updateUmkmPayment, findUmkmPaymentByUmkmId: refetchPayment } = await import('@/lib/db')
      const p = await refetchPayment(umkm.id)
      if (p) {
        await updateUmkmPayment(p.id, { status: 'paid', paid_at: new Date().toISOString(), payment_method: 'free_voucher' })
      }
      const { updateUmkm } = await import('@/lib/db')
      await updateUmkm(umkm.id, { payment_status: 'paid' })

      revalidatePath('/umkm-dashboard')
      return { success: true, free: true }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Gagal proses pembayaran gratis.' }
    }
  }

  // If existing pending payment with checkout_url, return it
  if (existingPayment && existingPayment.status === 'pending' && existingPayment.checkout_url) {
    return { success: true, checkoutUrl: existingPayment.checkout_url }
  }

  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  let checkoutUrl: string | null = null
  let xenditSessionId: string | null = null
  let isDemoMode = false

  const paymentRefRaw = generateRandomReference('UMKM')
  const paymentRef = toXenditReference(paymentRefRaw)
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const returnUrls = canUseReturnUrl(rawAppUrl) ? getUmkmReturnUrls(paymentRef) : {}

  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    isDemoMode = true
    checkoutUrl = null
    xenditSessionId = 'demo-xendit-session-' + Math.random().toString(36).substring(2, 15)
  } else {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')

      const sessionPayload = {
        reference_id: paymentRef,
        session_type: 'PAY',
        currency: 'IDR',
        amount,
        country: 'ID',
        mode: 'PAYMENT_LINK',
        capture_method: 'AUTOMATIC',
        allowed_payment_channels: getXenditChannels(),
        description: `TOPSELL RUN 2026 - Pendaftaran Tenant UMKM: ${umkm.name}`.substring(0, 100),
        customer: {
          reference_id: `${toXenditReference(session.id)}_${paymentRef}`,
          type: 'INDIVIDUAL',
          individual_detail: { given_names: toXenditName(umkm.pic_name || umkm.name) },
          email: umkm.email || undefined,
          mobile_number: umkm.phone || undefined,
        },
        items: [
          {
            reference_id: umkm.id,
            type: 'DIGITAL_PRODUCT',
            category: 'EVENT_TICKET',
            name: `Tenant UMKM - ${umkm.name}`.substring(0, 40),
            quantity: 1,
            net_unit_amount: amount,
            currency: 'IDR',
          },
        ],
        ...returnUrls,
      }

      const res = await fetch(XENDIT_SESSION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(sessionPayload),
      })

      if (res.ok) {
        const xenditData = await res.json()
        xenditSessionId = xenditData.payment_session_id || xenditData.id || null
        checkoutUrl = xenditData.payment_link_url || xenditData.checkout_url || null
      } else {
        const errText = await res.text()
        console.error('Xendit UMKM session error:', errText)
        return { error: 'Gagal membuat sesi pembayaran Xendit. Silakan coba lagi.' }
      }
    } catch (err) {
      console.error('Xendit connection error:', err)
      return { error: 'Gagal terhubung ke sistem pembayaran. Coba lagi.' }
    }
  }

  await dbCreateUmkmPayment({
    umkm_id: umkm.id,
    amount,
    payment_reference: paymentRef,
    xendit_session_id: xenditSessionId,
    checkout_url: checkoutUrl,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'payment',
      event: 'umkm_payment_created',
      message: `Sesi pembayaran UMKM dibuat: ${umkm.name} (Ref: ${paymentRef}, Amount: ${amount}).`,
      data: { umkmId: umkm.id, paymentRef, amount, xenditSessionId, isDemoMode },
    })
  } catch { /* non-fatal */ }

  revalidatePath('/umkm-dashboard')
  return { success: true, checkoutUrl, isDemoMode }
}

function isXenditPaidStatus(status: unknown) {
  const value = typeof status === 'string' ? status.toUpperCase() : ''
  return value === 'SUCCEEDED' || value === 'COMPLETED' || value === 'PAID' || value === 'SETTLED' || value === 'SUCCESS'
}

async function fetchXenditJson(url: string, authHeader: string) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: authHeader,
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      return { error: `HTTP ${response.status}: ${text || response.statusText}` }
    }

    const data = await response.json()
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Network error' }
  }
}

export async function syncUmkmXenditPaymentStatus(umkmId?: string) {
  const session = await getUmkmSession()
  const targetId = umkmId || session?.id
  if (!targetId) return { error: 'Sesi habis.' }

  const payment = await findUmkmPaymentByUmkmId(targetId)
  if (!payment) return { error: 'Payment tidak ditemukan.' }
  if (payment.status === 'paid') return { success: true, payment }

  const sessionId = payment.xendit_session_id
  if (!sessionId || sessionId.startsWith('demo-')) {
    return { success: true, payment }
  }

  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    return { success: true, payment }
  }

  const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')
  const sessionResult = await fetchXenditJson(`${XENDIT_SESSION_URL}/${encodeURIComponent(sessionId)}`, authHeader)
  if (sessionResult.error) {
    console.error('[UMKM Xendit Sync] Error:', sessionResult.error)
    return { error: sessionResult.error }
  }

  const xenditData = sessionResult.data as {
    status?: string
    payment_method?: { channel_code?: string; type?: string }
    payment_request_id?: string
  }
  const xenditStatus = xenditData?.status || ''

  if (isXenditPaidStatus(xenditStatus)) {
    const { markUmkmPaymentPaid } = await import('@/lib/db')
    const method = xenditData?.payment_method?.channel_code || xenditData?.payment_method?.type || 'QRIS'
    await markUmkmPaymentPaid(payment.id, {
      paid_at: new Date().toISOString(),
      payment_method: method,
    })

    const updatedPayment = await findUmkmPaymentByUmkmId(targetId)
    revalidatePath('/umkm-dashboard')
    return { success: true, paid: true, payment: updatedPayment }
  } else if (xenditStatus.toUpperCase() === 'EXPIRED') {
    const { markUmkmPaymentExpired } = await import('@/lib/db')
    await markUmkmPaymentExpired(payment.id)
    revalidatePath('/umkm-dashboard')
  } else if (xenditStatus.toUpperCase() === 'FAILED') {
    const { markUmkmPaymentFailed } = await import('@/lib/db')
    await markUmkmPaymentFailed(payment.id)
    revalidatePath('/umkm-dashboard')
  }

  return { success: true, payment }
}

export async function pollUmkmPaymentStatus() {
  const session = await getUmkmSession()
  if (!session) return { error: 'Sesi habis.' }

  await syncUmkmXenditPaymentStatus(session.id)
  const payment = await findUmkmPaymentByUmkmId(session.id)
  return { payment }
}
