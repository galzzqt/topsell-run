'use server'

import { getInvitationSession } from '@/lib/auth/invitation'
import { generateRandomReference } from '@/lib/utils/format'
import { extractXenditPaymentMethod, extractXenditPaymentRequestId, hasSpecificPaymentMethod } from '@/lib/utils/xendit'
import { sendInvitationRacepackEmailsForRegistration, sendInvitationReceiptEmail } from '@/lib/email/invitation'
import { sendInvitationRacepackWhatsappsForRegistration } from '@/lib/whatsapp/invitation'
import { resolvePackagePrice, checkPaymentWindow, resolvePeriodForCategory } from '@/lib/admin/settings'
import { revalidatePath } from 'next/cache'
import {
  createInvitationPayment as dbCreateInvitationPayment,
  createInvitationRegistration,
  deleteInvitationRegistration,
  findInvitationById,
  findInvitationPaymentWithRegistration,
  findInvitationPaymentWithRegistrationByReference,
  findPendingInvitationParticipantsWithoutRegistration,
  findPendingInvitationPaymentByRegistrationIds,
  findPendingInvitationRegistrationsByInvitationId,
  linkInvitationParticipantsToRegistration,
  markInvitationPaymentPaid,
  updateInvitationPayment,
  markInvitationPaymentFailed,
  markInvitationPaymentExpired,
} from '@/lib/db'
import { ingestAdminLog } from '@/lib/axiom/ingest'

const XENDIT_SESSION_URL = 'https://api.xendit.co/sessions'
const XENDIT_PAYMENT_REQUEST_URL = 'https://api.xendit.co/payment_requests'
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
  try {
    return new URL(appUrl).protocol === 'https:'
  } catch {
    return false
  }
}

function getInvitationReturnUrls(paymentRef?: string) {
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!rawAppUrl || !canUseReturnUrl(rawAppUrl)) return {}
  const appUrl = rawAppUrl.replace(/\/+$/, '')
  const refQuery = paymentRef ? `&ref=${encodeURIComponent(paymentRef)}` : ''
  return {
    success_return_url: `${appUrl}/invitation-dashboard?payment=success${refQuery}`,
    cancel_return_url: `${appUrl}/invitation-dashboard?payment=cancelled${refQuery}`,
  }
}

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

function toXenditName(value: string | null | undefined) {
  return (value || 'Peserta').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50) || 'Peserta'
}

function isDemoSession(payment: { payment_method: string | null; xendit_session_id: string | null }) {
  return payment.payment_method === 'xendit_demo' || Boolean(payment.xendit_session_id?.startsWith('demo-xendit-session-'))
}

async function fetchXenditJson(url: string, authHeader: string) {
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json', Authorization: authHeader } })
  if (!res.ok) return { error: await res.text() }
  return { data: await res.json() }
}

async function resolveXenditPaymentMethod(sessionData: unknown, authHeader: string) {
  const sessionMethod = extractXenditPaymentMethod(sessionData)
  if (sessionMethod) return sessionMethod
  const paymentRequestId = extractXenditPaymentRequestId(sessionData)
  if (!paymentRequestId) return null
  const paymentRequest = await fetchXenditJson(`${XENDIT_PAYMENT_REQUEST_URL}/${encodeURIComponent(paymentRequestId)}`, authHeader)
  if (paymentRequest.error) return null
  return extractXenditPaymentMethod(paymentRequest.data)
}

/**
 * Pendaftaran gratis (harga kategori 0 atau voucher menutup penuh): lewati Xendit,
 * tandai invoice lunas, lalu kirim e-receipt + racepack seperti pembayaran biasa.
 */
async function settleFreeInvitationPayment(params: {
  invitationId: string
  invitationName: string
  paymentId: string
  registrationId: string
  reference: string
  participantCount: number
}) {
  await markInvitationPaymentPaid(params.paymentId, { payment_method: 'free' })

  await Promise.all([
    sendInvitationReceiptEmail(params.registrationId),
    sendInvitationRacepackEmailsForRegistration(params.registrationId),
    sendInvitationRacepackWhatsappsForRegistration(params.registrationId),
  ])

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'payment',
      event: 'invitation_payment_free_paid',
      message: `Pendaftaran invitation gratis langsung lunas: ${params.invitationName} (Ref: ${params.reference}).`,
      data: { invitationId: params.invitationId, paymentId: params.paymentId, reference: params.reference, amount: 0 },
    })
  } catch (logError) {
    console.error('Failed to log free invitation payment:', logError)
  }

  revalidatePath('/invitation-dashboard')

  return {
    success: true,
    freePaid: true as const,
    paymentId: params.paymentId,
    registrationId: params.registrationId,
    amount: 0,
    reference: params.reference,
    participantCount: params.participantCount,
  }
}

export async function createInvitationPayment() {
  const session = await getInvitationSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const invitation = await findInvitationById(session.id)
  const pendingRegistrations = await findPendingInvitationRegistrationsByInvitationId(session.id)

  if (pendingRegistrations.length > 0) {
    const existingPayment = await findPendingInvitationPaymentByRegistrationIds(pendingRegistrations.map((r) => r.id))
    if (existingPayment) {
      const existingRegistration = pendingRegistrations.find((r) => r.id === existingPayment.registration_id)

      if (existingPayment.amount === 0) {
        return settleFreeInvitationPayment({
          invitationId: session.id,
          invitationName: session.name,
          paymentId: existingPayment.id,
          registrationId: existingPayment.registration_id,
          reference: existingPayment.payment_reference,
          participantCount: existingRegistration?.total_participants || 0,
        })
      }

      // Invoice pending dibuat saat signup TANPA checkout Xendit — generate sekarang jika belum ada.
      if (!existingPayment.checkout_url && !existingPayment.xendit_session_id?.startsWith('demo-xendit-session-')) {
        const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
        const noRealKey = !xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')

        // Tanpa key asli → jalankan mode demo agar tombol simulasi muncul.
        if (noRealKey) {
          const demoSessionId = 'demo-xendit-session-' + Math.random().toString(36).substring(2, 15)
          await updateInvitationPayment(existingPayment.id, { payment_method: 'xendit_demo', xendit_session_id: demoSessionId })
          return {
            success: true,
            paymentId: existingPayment.id,
            registrationId: existingPayment.registration_id,
            checkoutUrl: null,
            xenditSessionId: demoSessionId,
            isDemoMode: true,
            amount: existingPayment.amount,
            reference: existingPayment.payment_reference,
            participantCount: existingRegistration?.total_participants || 0,
            reusedPendingPayment: true,
          }
        }

        let newCheckoutUrl: string | null = null
        let newXenditSessionId: string | null = null

        {
          try {
            const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')
            const res = await fetch(XENDIT_SESSION_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
              body: JSON.stringify({
                reference_id: existingPayment.payment_reference,
                session_type: 'PAY',
                currency: 'IDR',
                amount: existingPayment.amount,
                country: 'ID',
                mode: 'PAYMENT_LINK',
                capture_method: 'AUTOMATIC',
                allowed_payment_channels: getXenditChannels(),
                description: `TOPSELL RUN Invitation ${invitation?.category || ''} - ${existingRegistration?.total_participants || 0} peserta`.trim(),
                customer: {
                  reference_id: `${toXenditReference(session.id)}_${existingPayment.payment_reference}`,
                  type: 'INDIVIDUAL',
                  individual_detail: { given_names: toXenditName(invitation?.leader_name || invitation?.name) },
                  email: invitation?.email || undefined,
                },
                ...getInvitationReturnUrls(existingPayment.payment_reference),
              }),
            })

            if (res.ok) {
              const xenditData = await res.json()
              newXenditSessionId = xenditData.payment_session_id || xenditData.id || null
              newCheckoutUrl = xenditData.payment_link_url || null
              if (newCheckoutUrl && newXenditSessionId) {
                await updateInvitationPayment(existingPayment.id, {
                  payment_method: null,
                  snap_token: newCheckoutUrl,
                  provider: 'xendit',
                  checkout_url: newCheckoutUrl,
                  xendit_session_id: newXenditSessionId,
                })
              }
            } else {
              const errorText = await res.text()
              console.error('Xendit error (reused invitation):', res.status, errorText)
              return { error: `Gagal membuat checkout Xendit: ${errorText}` }
            }
          } catch (err) {
            console.error('Failed to generate checkout URL for existing invitation payment:', err)
            return { error: 'Gagal menghubungi Xendit. Periksa koneksi server dan konfigurasi XENDIT_SECRET_KEY.' }
          }
        }

        return {
          success: true,
          paymentId: existingPayment.id,
          registrationId: existingPayment.registration_id,
          checkoutUrl: newCheckoutUrl || existingPayment.checkout_url,
          xenditSessionId: newXenditSessionId || existingPayment.xendit_session_id,
          isDemoMode: isDemoSession(existingPayment),
          amount: existingPayment.amount,
          reference: existingPayment.payment_reference,
          participantCount: existingRegistration?.total_participants || 0,
          reusedPendingPayment: true,
        }
      }

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

  const participants = await findPendingInvitationParticipantsWithoutRegistration(session.id)
  if (participants.length === 0) {
    return { error: 'Tidak ada tagihan yang perlu dibayar. Refresh dashboard untuk melihat invoice pending.' }
  }

  const paymentWindow = await checkPaymentWindow('invitation', invitation?.category)
  if (!paymentWindow.ok) {
    return { error: paymentWindow.reason || 'Jendela pembayaran periode ini sedang tidak buka.' }
  }

  const period = await resolvePeriodForCategory('invitation', invitation?.category)
  const participantIds = participants.map((p) => p.id)
  const unitPrice = await resolvePackagePrice('invitation', invitation?.category)
  const totalAmount = participants.length * unitPrice

  // Terapkan voucher yang sudah tersimpan di profil invitation (disimpan saat signup)
  const voucherDiscount = invitation?.voucher_discount ?? 0
  const voucherCode = invitation?.voucher_code ?? null
  const finalAmount = Math.max(0, totalAmount - voucherDiscount)

  const paymentRef = toXenditReference(generateRandomReference('IND'))

  let registration
  try {
    registration = await createInvitationRegistration({
      invitation_id: session.id,
      total_participants: participants.length,
      total_amount: finalAmount,
      voucher_code: voucherCode,
      voucher_discount: voucherDiscount,
      status: 'pending',
    })
  } catch (error) {
    return { error: 'Gagal membuat registrasi: ' + (error instanceof Error ? error.message : 'Data kosong') }
  }

  try {
    await linkInvitationParticipantsToRegistration(participantIds, registration.id)
  } catch {
    await deleteInvitationRegistration(registration.id)
    return { error: 'Gagal menautkan peserta ke registrasi.' }
  }

  let payment
  try {
    payment = await dbCreateInvitationPayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })
  } catch {
    await deleteInvitationRegistration(registration.id)
    return { error: 'Gagal membuat invoice pembayaran.' }
  }

  if (finalAmount === 0) {
    return settleFreeInvitationPayment({
      invitationId: session.id,
      invitationName: session.name,
      paymentId: payment.id,
      registrationId: registration.id,
      reference: paymentRef,
      participantCount: participants.length,
    })
  }

  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  let checkoutUrl: string | null = null
  let xenditSessionId: string | null = null
  let isDemoMode = false

  if (!xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')) {
    isDemoMode = true
    xenditSessionId = 'demo-xendit-session-' + Math.random().toString(36).substring(2, 15)
  } else {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')
      const res = await fetch(XENDIT_SESSION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          reference_id: paymentRef,
          session_type: 'PAY',
          currency: 'IDR',
          amount: finalAmount,
          country: 'ID',
          mode: 'PAYMENT_LINK',
          capture_method: 'AUTOMATIC',
          allowed_payment_channels: getXenditChannels(),
          description: `TOPSELL RUN Invitation ${invitation?.category || ''} - ${participants.length} peserta`.trim(),
          customer: {
            reference_id: `${toXenditReference(session.id)}_${paymentRef}`,
            type: 'INDIVIDUAL',
            individual_detail: { given_names: toXenditName(invitation?.leader_name || invitation?.name) },
            email: invitation?.email || undefined,
          },
          items: participants.map((p) => ({
            reference_id: p.id,
            type: 'DIGITAL_PRODUCT',
            category: 'EVENT_TICKET',
            name: `TOPSELL RUN ${invitation?.category || ''} - ${p.full_name.substring(0, 40)}`.trim(),
            quantity: 1,
            net_unit_amount: participants.length > 0 ? Math.round(finalAmount / participants.length) : unitPrice,
            currency: 'IDR',
          })),
          ...getInvitationReturnUrls(paymentRef),
        }),
      })

      if (res.ok) {
        const xenditData = await res.json()
        xenditSessionId = xenditData.payment_session_id || xenditData.id || null
        checkoutUrl = xenditData.payment_link_url || null
      } else {
        const errorText = await res.text()
        console.error('Xendit error:', res.status, errorText)
        await deleteInvitationRegistration(registration.id)
        return { error: `Gagal membuat checkout Xendit: ${errorText}` }
      }
    } catch (err) {
      console.error('Xendit API failed:', err)
      await deleteInvitationRegistration(registration.id)
      return { error: 'Gagal menghubungi Xendit. Periksa koneksi server dan konfigurasi XENDIT_SECRET_KEY.' }
    }
  }

  try {
    await updateInvitationPayment(payment.id, {
      payment_method: isDemoMode ? 'xendit_demo' : null,
      snap_token: checkoutUrl,
      provider: 'xendit',
      xendit_session_id: xenditSessionId,
      checkout_url: checkoutUrl,
    })
  } catch (error) {
    await deleteInvitationRegistration(registration.id)
    return { error: 'Gagal menyimpan data checkout Xendit: ' + (error instanceof Error ? error.message : 'Unknown error') }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'payment',
      event: 'invitation_payment_created',
      message: `Invoice checkout pendaftaran invitation dibuat: ${session.name} (Ref: ${paymentRef}, Total: IDR ${finalAmount.toLocaleString('id-ID')}${voucherCode ? `, Voucher: ${voucherCode}, Diskon: ${voucherDiscount.toLocaleString('id-ID')}` : ''}).`,
      data: { invitationId: session.id, paymentId: payment.id, reference: paymentRef, amount: finalAmount, voucherCode, voucherDiscount, isDemoMode },
    })
  } catch (logError) {
    console.error('Failed to log invitation payment creation:', logError)
  }

  revalidatePath('/invitation-dashboard')

  return {
    success: true,
    paymentId: payment.id,
    registrationId: registration.id,
    checkoutUrl,
    xenditSessionId,
    isDemoMode,
    amount: finalAmount,
    reference: paymentRef,
    participantCount: participants.length,
  }
}

export async function simulateInvitationPaymentSuccess(paymentId: string) {
  const session = await getInvitationSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const payment = await findInvitationPaymentWithRegistration(paymentId)
  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.invitation_id !== session.id) return { error: 'Tidak memiliki akses.' }

  await markInvitationPaymentPaid(paymentId, { payment_method: 'xendit_demo' })

  await Promise.all([
    sendInvitationReceiptEmail(payment.registration_id),
    sendInvitationRacepackEmailsForRegistration(payment.registration_id),
    sendInvitationRacepackWhatsappsForRegistration(payment.registration_id),
  ])

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'payment',
      event: 'invitation_payment_simulated',
      message: `Simulasi pembayaran invitation sukses (ID: ${paymentId}, Ref: ${payment.payment_reference}, Jumlah: IDR ${payment.amount.toLocaleString('id-ID')}).`,
      data: { paymentId, reference: payment.payment_reference, amount: payment.amount }
    })
  } catch (logError) {
    console.error('Failed to log invitation payment simulation:', logError)
  }

  revalidatePath('/invitation-dashboard')
  return { success: true }
}

function isXenditPaidStatus(status: unknown) {
  const value = typeof status === 'string' ? status.toUpperCase() : ''
  return value === 'SUCCEEDED' || value === 'COMPLETED' || value === 'PAID' || value === 'SETTLED' || value === 'SUCCESS'
}

export async function syncXenditInvitationPaymentStatus(paymentReference: string) {
  const session = await getInvitationSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const payment = await findInvitationPaymentWithRegistrationByReference(paymentReference)
  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.invitation_id !== session.id) return { error: 'Tidak memiliki akses.' }
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
    const status = (xenditData?.status || '').toUpperCase()
    if (status === 'EXPIRED') await markInvitationPaymentExpired(payment.id)
    else if (status === 'FAILED') await markInvitationPaymentFailed(payment.id)
    if (status === 'EXPIRED' || status === 'FAILED') {
      try {
        await ingestAdminLog({
          level: 'warning',
          source: 'payment',
          event: status === 'EXPIRED' ? 'invitation_payment_synced_expired' : 'invitation_payment_synced_failed',
          message: `Sinkronisasi pembayaran invitation: ${status.toLowerCase()} (Ref: ${paymentReference}, Jumlah: IDR ${payment.amount.toLocaleString('id-ID')}).`,
          data: { paymentId: payment.id, reference: paymentReference, status }
        })
      } catch (logError) {
        console.error('Failed to log invitation payment sync failure:', logError)
      }
      revalidatePath('/invitation-dashboard')
      return { success: true, status }
    }

    try {
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: 'invitation_payment_synced_pending',
        message: `Sinkronisasi pembayaran invitation: status pending (${status}) (Ref: ${paymentReference}, Jumlah: IDR ${payment.amount.toLocaleString('id-ID')}).`,
        data: { paymentId: payment.id, reference: paymentReference, status }
      })
    } catch (logError) {
      console.error('Failed to log invitation payment sync pending:', logError)
    }

    return { success: true, status: xenditData?.status || 'UNKNOWN' }
  }

  const paymentMethod = (await resolveXenditPaymentMethod(xenditData, authHeader)) || payment.payment_method || 'xendit'
  await markInvitationPaymentPaid(payment.id, { payment_method: paymentMethod })

  await Promise.all([
    sendInvitationReceiptEmail(payment.registration_id),
    sendInvitationRacepackEmailsForRegistration(payment.registration_id),
    sendInvitationRacepackWhatsappsForRegistration(payment.registration_id),
  ])

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'payment',
      event: 'invitation_payment_synced_paid',
      message: `Sinkronisasi pembayaran invitation: lunas (Ref: ${paymentReference}, Method: ${paymentMethod}, Jumlah: IDR ${payment.amount.toLocaleString('id-ID')}).`,
      data: { paymentId: payment.id, reference: paymentReference, paymentMethod }
    })
  } catch (logError) {
    console.error('Failed to log invitation payment sync success:', logError)
  }

  revalidatePath('/invitation-dashboard')
  return { success: true, status: 'paid' as const, paymentMethod }
}
