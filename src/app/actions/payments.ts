'use server'

import { getCommunitySession } from '@/lib/auth/community'
import { generateRandomReference } from '@/lib/utils/format'
import { extractXenditPaymentMethod, extractXenditPaymentRequestId, hasSpecificPaymentMethod } from '@/lib/utils/xendit'
import { sendRacepackEmailsForRegistration } from '@/lib/email/racepack'
import { sendRacepackWhatsappsForRegistration } from '@/lib/whatsapp/racepack'
import { TOPSELL_RUN_EVENT } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import {
  createPayment,
  createRegistration,
  deleteRegistration,
  findCommunityById,
  findPaymentWithRegistration,
  findPaymentWithRegistrationByReference,
  findPendingParticipantsWithoutRegistration,
  findPendingPaymentByRegistrationIds,
  findPendingRegistrationsByCommunityId,
  linkParticipantsToRegistration,
  markPaymentPaid,
  updatePayment,
} from '@/lib/db'

const XENDIT_SESSION_URL = 'https://api.xendit.co/sessions'
const XENDIT_PAYMENT_REQUEST_URL = 'https://api.xendit.co/payment_requests'
const DEFAULT_XENDIT_CHANNELS = [
  'BCA_VIRTUAL_ACCOUNT',
  'BNI_VIRTUAL_ACCOUNT',
  'BRI_VIRTUAL_ACCOUNT',
  'MANDIRI_VIRTUAL_ACCOUNT',
  'PERMATA_VIRTUAL_ACCOUNT',
  'QRIS',
]

function getXenditChannels() {
  return (process.env.XENDIT_ALLOWED_CHANNELS || DEFAULT_XENDIT_CHANNELS.join(','))
    .split(',')
    .map((channel) => channel.trim())
    .filter(Boolean)
}

function canUseReturnUrl(appUrl: string | undefined) {
  if (!appUrl) return false

  try {
    const url = new URL(appUrl)
    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function getReturnUrls(paymentRef?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!canUseReturnUrl(appUrl)) return {}

  const refQuery = paymentRef ? `&ref=${encodeURIComponent(paymentRef)}` : ''
  return {
    success_return_url: `${appUrl}/dashboard?payment=success${refQuery}`,
    cancel_return_url: `${appUrl}/dashboard?payment=cancelled${refQuery}`,
  }
}

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

function toXenditName(value: string | null | undefined) {
  return (value || 'Komunitas').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50) || 'Komunitas'
}

function isDemoSession(payment: { payment_method: string | null; xendit_session_id: string | null }) {
  return payment.payment_method === 'xendit_demo' || Boolean(payment.xendit_session_id?.startsWith('demo-xendit-session-'))
}

async function fetchXenditJson(url: string, authHeader: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: authHeader },
  })

  if (!res.ok) {
    const errorText = await res.text()
    return { error: errorText }
  }

  return { data: await res.json() }
}

async function resolveXenditPaymentMethod(sessionData: unknown, authHeader: string) {
  const sessionMethod = extractXenditPaymentMethod(sessionData)
  if (sessionMethod) return sessionMethod

  const paymentRequestId = extractXenditPaymentRequestId(sessionData)
  if (!paymentRequestId) return null

  const paymentRequest = await fetchXenditJson(
    `${XENDIT_PAYMENT_REQUEST_URL}/${encodeURIComponent(paymentRequestId)}`,
    authHeader
  )
  if (paymentRequest.error) return null

  return extractXenditPaymentMethod(paymentRequest.data)
}

export async function createCommunityPayment() {
  const session = await getCommunitySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const community = await findCommunityById(session.id)
  const pendingRegistrations = await findPendingRegistrationsByCommunityId(session.id)

  if (pendingRegistrations.length > 0) {
    const existingPayment = await findPendingPaymentByRegistrationIds(
      pendingRegistrations.map((registration) => registration.id)
    )

    if (existingPayment) {
      const existingRegistration = pendingRegistrations.find(
        (registration) => registration.id === existingPayment.registration_id
      )
      return {
        success: true,
        paymentId: existingPayment.id,
        registrationId: existingPayment.registration_id,
        checkoutUrl: existingPayment.checkout_url,
        xenditSessionId: existingPayment.xendit_session_id,
        isDemoMode: isDemoSession(existingPayment),
        amount: existingPayment.amount,
        reference: existingPayment.payment_reference,
        participantCount: existingRegistration?.total_participants || 0,
        reusedPendingPayment: true,
      }
    }
  }

  const participants = await findPendingParticipantsWithoutRegistration(session.id)
  if (participants.length === 0) {
    return { error: 'Tidak ada peserta baru yang perlu dibayar. Jika sudah pernah membuat checkout, refresh dashboard untuk melihat invoice pending.' }
  }

  const participantIds = participants.map((participant) => participant.id)
  const totalAmount = participants.length * TOPSELL_RUN_EVENT.price_per_participant
  const paymentRefRaw = generateRandomReference('TSR')
  const paymentRef = toXenditReference(paymentRefRaw)

  let registration
  try {
    registration = await createRegistration({
      community_id: session.id,
      total_participants: participants.length,
      total_amount: totalAmount,
      status: 'pending',
    })
  } catch (error) {
    return { error: 'Gagal membuat registrasi: ' + (error instanceof Error ? error.message : 'Data kosong') }
  }

  try {
    await linkParticipantsToRegistration(participantIds, registration.id)
  } catch {
    await deleteRegistration(registration.id)
    return { error: 'Gagal menautkan peserta ke registrasi.' }
  }

  let payment
  try {
    payment = await createPayment({
      registration_id: registration.id,
      amount: totalAmount,
      payment_reference: paymentRef,
      status: 'pending',
    })
  } catch {
    await deleteRegistration(registration.id)
    return { error: 'Gagal membuat invoice pembayaran.' }
  }

  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  let checkoutUrl: string | null = null
  let xenditSessionId: string | null = null
  let isDemoMode = false

  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    isDemoMode = true
    checkoutUrl = null
    xenditSessionId = 'demo-xendit-session-' + Math.random().toString(36).substring(2, 15)
  } else {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')

      const res = await fetch(XENDIT_SESSION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          reference_id: paymentRef,
          session_type: 'PAY',
          currency: 'IDR',
          amount: totalAmount,
          country: 'ID',
          mode: 'PAYMENT_LINK',
          capture_method: 'AUTOMATIC',
          allowed_payment_channels: getXenditChannels(),
          description: `TOPSELL RUN 6K - ${participants.length} peserta`,
          customer: {
            reference_id: toXenditReference(session.id),
            type: 'INDIVIDUAL',
            individual_detail: {
              given_names: toXenditName(community?.leader_name || community?.name),
            },
            email: community?.email || undefined,
          },
          items: participants.map((p) => ({
            reference_id: p.id,
            type: 'DIGITAL_PRODUCT',
            category: 'EVENT_TICKET',
            name: `TOPSELL RUN 6K - ${p.full_name.substring(0, 40)}`,
            quantity: 1,
            net_unit_amount: TOPSELL_RUN_EVENT.price_per_participant,
            currency: 'IDR',
          })),
          ...getReturnUrls(paymentRef),
        }),
      })

      if (res.ok) {
        const xenditData = await res.json()
        xenditSessionId = xenditData.payment_session_id || xenditData.id || null
        checkoutUrl = xenditData.payment_link_url || null
      } else {
        const errorText = await res.text()
        console.error('Xendit error:', res.status, errorText)
        await deleteRegistration(registration.id)
        return { error: `Gagal membuat checkout Xendit: ${errorText}` }
      }
    } catch (err) {
      console.error('Xendit API failed:', err)
      await deleteRegistration(registration.id)
      return { error: 'Gagal menghubungi Xendit. Periksa koneksi server dan konfigurasi XENDIT_SECRET_KEY.' }
    }
  }

  try {
    await updatePayment(payment.id, {
      payment_method: isDemoMode ? 'xendit_demo' : null,
      snap_token: checkoutUrl,
      provider: 'xendit',
      xendit_session_id: xenditSessionId,
      checkout_url: checkoutUrl,
    })
  } catch (error) {
    await deleteRegistration(registration.id)
    return { error: 'Gagal menyimpan data checkout Xendit: ' + (error instanceof Error ? error.message : 'Unknown error') }
  }

  revalidatePath('/dashboard')

  return {
    success: true,
    paymentId: payment.id,
    registrationId: registration.id,
    checkoutUrl,
    xenditSessionId,
    isDemoMode,
    amount: totalAmount,
    reference: paymentRef,
    participantCount: participants.length,
  }
}

export async function createCollectivePayment() {
  return createCommunityPayment()
}

export async function simulatePaymentSuccess(paymentId: string) {
  const session = await getCommunitySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const payment = await findPaymentWithRegistration(paymentId)
  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.community_id !== session.id) return { error: 'Tidak memiliki akses.' }

  await markPaymentPaid(paymentId, {
    payment_method: 'xendit_demo',
  })

  await Promise.all([
    sendRacepackEmailsForRegistration(payment.registration_id),
    sendRacepackWhatsappsForRegistration(payment.registration_id),
  ])

  revalidatePath('/dashboard')
  return { success: true }
}

function isXenditPaidStatus(status: unknown) {
  const value = typeof status === 'string' ? status.toUpperCase() : ''
  return value === 'SUCCEEDED' || value === 'COMPLETED' || value === 'PAID' || value === 'SETTLED' || value === 'SUCCESS'
}

export async function syncXenditPaymentStatus(paymentReference: string) {
  const session = await getCommunitySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const payment = await findPaymentWithRegistrationByReference(paymentReference)
  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.community_id !== session.id) return { error: 'Tidak memiliki akses.' }
  if (payment.status === 'paid' && hasSpecificPaymentMethod(payment.payment_method)) {
    return { success: true, status: 'paid' as const, paymentMethod: payment.payment_method }
  }

  const sessionId = payment.xendit_session_id
  if (!sessionId) return { error: 'Session Xendit belum tersimpan.' }

  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    return { error: 'XENDIT_SECRET_KEY belum diisi.' }
  }

  const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')
  const sessionResult = await fetchXenditJson(`${XENDIT_SESSION_URL}/${encodeURIComponent(sessionId)}`, authHeader)
  if (sessionResult.error) return { error: `Gagal cek status Xendit: ${sessionResult.error}` }

  const xenditData = sessionResult.data
  if (!isXenditPaidStatus(xenditData?.status)) {
    return { success: true, status: xenditData?.status || 'UNKNOWN' }
  }

  const paymentMethod = await resolveXenditPaymentMethod(xenditData, authHeader) || payment.payment_method || 'xendit'
  await markPaymentPaid(payment.id, { payment_method: paymentMethod })

  await Promise.all([
    sendRacepackEmailsForRegistration(payment.registration_id),
    sendRacepackWhatsappsForRegistration(payment.registration_id),
  ])

  revalidatePath('/dashboard')
  return { success: true, status: 'paid' as const, paymentMethod }
}
