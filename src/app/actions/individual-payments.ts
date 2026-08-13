'use server'

import { getIndividualSession } from '@/lib/auth/individual'
import { generateRandomReference } from '@/lib/utils/format'
import { extractXenditPaymentMethod, extractXenditPaymentRequestId, hasSpecificPaymentMethod } from '@/lib/utils/xendit'
import { sendIndividualRacepackEmailsForRegistration, sendIndividualReceiptEmail } from '@/lib/email/individual'
import { sendIndividualRacepackWhatsappsForRegistration } from '@/lib/whatsapp/individual'
import { resolvePackagePrice, checkPaymentWindow, resolvePeriodForCategory } from '@/lib/admin/settings'
import { revalidatePath } from 'next/cache'
import {
  createIndividualPayment as dbCreateIndividualPayment,
  createIndividualRegistration,
  deleteIndividualRegistration,
  findIndividualById,
  findIndividualPaymentWithRegistration,
  findIndividualPaymentWithRegistrationByReference,
  findPendingIndividualParticipantsWithoutRegistration,
  findPendingIndividualPaymentByRegistrationIds,
  findPendingIndividualRegistrationsByIndividualId,
  linkIndividualParticipantsToRegistration,
  markIndividualPaymentPaid,
  updateIndividualPayment,
  markIndividualPaymentFailed,
  markIndividualPaymentExpired,
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

function getIndividualReturnUrls(paymentRef?: string) {
  const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!rawAppUrl || !canUseReturnUrl(rawAppUrl)) return {}
  const appUrl = rawAppUrl.replace(/\/+$/, '')
  const refQuery = paymentRef ? `&ref=${encodeURIComponent(paymentRef)}` : ''
  return {
    success_return_url: `${appUrl}/individu-dashboard?payment=success${refQuery}`,
    cancel_return_url: `${appUrl}/individu-dashboard?payment=cancelled${refQuery}`,
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

export async function createIndividualPayment() {
  const session = await getIndividualSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const individual = await findIndividualById(session.id)
  const pendingRegistrations = await findPendingIndividualRegistrationsByIndividualId(session.id)

  if (pendingRegistrations.length > 0) {
    const existingPayment = await findPendingIndividualPaymentByRegistrationIds(pendingRegistrations.map((r) => r.id))
    if (existingPayment) {
      const existingRegistration = pendingRegistrations.find((r) => r.id === existingPayment.registration_id)

      // Invoice pending dibuat saat signup TANPA checkout Xendit — generate sekarang jika belum ada.
      if (!existingPayment.checkout_url && !existingPayment.xendit_session_id?.startsWith('demo-xendit-session-')) {
        const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
        const noRealKey = !xenditSecretKey || xenditSecretKey.includes('XXXXXX') || xenditSecretKey.includes('your-')

        // Tanpa key asli → jalankan mode demo agar tombol simulasi muncul.
        if (noRealKey) {
          const demoSessionId = 'demo-xendit-session-' + Math.random().toString(36).substring(2, 15)
          await updateIndividualPayment(existingPayment.id, { payment_method: 'xendit_demo', xendit_session_id: demoSessionId })
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
                description: `TOPSELL RUN Individu ${individual?.category || ''} - ${existingRegistration?.total_participants || 0} peserta`.trim(),
                customer: {
                  reference_id: `${toXenditReference(session.id)}_${existingPayment.payment_reference}`,
                  type: 'INDIVIDUAL',
                  individual_detail: { given_names: toXenditName(individual?.leader_name || individual?.name) },
                  email: individual?.email || undefined,
                },
                ...getIndividualReturnUrls(existingPayment.payment_reference),
              }),
            })

            if (res.ok) {
              const xenditData = await res.json()
              newXenditSessionId = xenditData.payment_session_id || xenditData.id || null
              newCheckoutUrl = xenditData.payment_link_url || null
              if (newCheckoutUrl && newXenditSessionId) {
                await updateIndividualPayment(existingPayment.id, {
                  payment_method: null,
                  snap_token: newCheckoutUrl,
                  provider: 'xendit',
                  checkout_url: newCheckoutUrl,
                  xendit_session_id: newXenditSessionId,
                })
              }
            } else {
              const errorText = await res.text()
              console.error('Xendit error (reused individual):', res.status, errorText)
            }
          } catch (err) {
            console.error('Failed to generate checkout URL for existing individual payment:', err)
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

  const participants = await findPendingIndividualParticipantsWithoutRegistration(session.id)
  if (participants.length === 0) {
    return { error: 'Tidak ada tagihan yang perlu dibayar. Refresh dashboard untuk melihat invoice pending.' }
  }

  const paymentWindow = await checkPaymentWindow('individual', individual?.category)
  if (!paymentWindow.ok) {
    return { error: paymentWindow.reason || 'Jendela pembayaran periode ini sedang tidak buka.' }
  }

  const period = await resolvePeriodForCategory('individual', individual?.category)
  const participantIds = participants.map((p) => p.id)
  const unitPrice = await resolvePackagePrice('individual', individual?.category)
  const totalAmount = participants.length * unitPrice

  // Terapkan voucher yang sudah tersimpan di profil individual (disimpan saat signup)
  const voucherDiscount = individual?.voucher_discount ?? 0
  const voucherCode = individual?.voucher_code ?? null
  const finalAmount = Math.max(0, totalAmount - voucherDiscount)

  const paymentRef = toXenditReference(generateRandomReference('IND'))

  let registration
  try {
    registration = await createIndividualRegistration({
      individual_id: session.id,
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
    await linkIndividualParticipantsToRegistration(participantIds, registration.id)
  } catch {
    await deleteIndividualRegistration(registration.id)
    return { error: 'Gagal menautkan peserta ke registrasi.' }
  }

  let payment
  try {
    payment = await dbCreateIndividualPayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })
  } catch {
    await deleteIndividualRegistration(registration.id)
    return { error: 'Gagal membuat invoice pembayaran.' }
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
          description: `TOPSELL RUN Individu ${individual?.category || ''} - ${participants.length} peserta`.trim(),
          customer: {
            reference_id: `${toXenditReference(session.id)}_${paymentRef}`,
            type: 'INDIVIDUAL',
            individual_detail: { given_names: toXenditName(individual?.leader_name || individual?.name) },
            email: individual?.email || undefined,
          },
          items: participants.map((p) => ({
            reference_id: p.id,
            type: 'DIGITAL_PRODUCT',
            category: 'EVENT_TICKET',
            name: `TOPSELL RUN ${individual?.category || ''} - ${p.full_name.substring(0, 40)}`.trim(),
            quantity: 1,
            net_unit_amount: participants.length > 0 ? Math.round(finalAmount / participants.length) : unitPrice,
            currency: 'IDR',
          })),
          ...getIndividualReturnUrls(paymentRef),
        }),
      })

      if (res.ok) {
        const xenditData = await res.json()
        xenditSessionId = xenditData.payment_session_id || xenditData.id || null
        checkoutUrl = xenditData.payment_link_url || null
      } else {
        const errorText = await res.text()
        console.error('Xendit error:', res.status, errorText)
        await deleteIndividualRegistration(registration.id)
        return { error: `Gagal membuat checkout Xendit: ${errorText}` }
      }
    } catch (err) {
      console.error('Xendit API failed:', err)
      await deleteIndividualRegistration(registration.id)
      return { error: 'Gagal menghubungi Xendit. Periksa koneksi server dan konfigurasi XENDIT_SECRET_KEY.' }
    }
  }

  try {
    await updateIndividualPayment(payment.id, {
      payment_method: isDemoMode ? 'xendit_demo' : null,
      snap_token: checkoutUrl,
      provider: 'xendit',
      xendit_session_id: xenditSessionId,
      checkout_url: checkoutUrl,
    })
  } catch (error) {
    await deleteIndividualRegistration(registration.id)
    return { error: 'Gagal menyimpan data checkout Xendit: ' + (error instanceof Error ? error.message : 'Unknown error') }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'payment',
      event: 'individual_payment_created',
      message: `Invoice checkout pendaftaran individu dibuat: ${session.name} (Ref: ${paymentRef}, Total: IDR ${finalAmount.toLocaleString('id-ID')}${voucherCode ? `, Voucher: ${voucherCode}, Diskon: ${voucherDiscount.toLocaleString('id-ID')}` : ''}).`,
      data: { individualId: session.id, paymentId: payment.id, reference: paymentRef, amount: finalAmount, voucherCode, voucherDiscount, isDemoMode },
    })
  } catch (logError) {
    console.error('Failed to log individual payment creation:', logError)
  }

  revalidatePath('/individu-dashboard')

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

export async function simulateIndividualPaymentSuccess(paymentId: string) {
  const session = await getIndividualSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const payment = await findIndividualPaymentWithRegistration(paymentId)
  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.individual_id !== session.id) return { error: 'Tidak memiliki akses.' }

  await markIndividualPaymentPaid(paymentId, { payment_method: 'xendit_demo' })

  await Promise.all([
    sendIndividualReceiptEmail(payment.registration_id),
    sendIndividualRacepackEmailsForRegistration(payment.registration_id),
    sendIndividualRacepackWhatsappsForRegistration(payment.registration_id),
  ])

  revalidatePath('/individu-dashboard')
  return { success: true }
}

function isXenditPaidStatus(status: unknown) {
  const value = typeof status === 'string' ? status.toUpperCase() : ''
  return value === 'SUCCEEDED' || value === 'COMPLETED' || value === 'PAID' || value === 'SETTLED' || value === 'SUCCESS'
}

export async function syncXenditIndividualPaymentStatus(paymentReference: string) {
  const session = await getIndividualSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const payment = await findIndividualPaymentWithRegistrationByReference(paymentReference)
  if (!payment) return { error: 'Invoice tidak ditemukan.' }
  if (payment.registration?.individual_id !== session.id) return { error: 'Tidak memiliki akses.' }
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
    if (status === 'EXPIRED') await markIndividualPaymentExpired(payment.id)
    else if (status === 'FAILED') await markIndividualPaymentFailed(payment.id)
    if (status === 'EXPIRED' || status === 'FAILED') {
      revalidatePath('/individu-dashboard')
      return { success: true, status }
    }
    return { success: true, status: xenditData?.status || 'UNKNOWN' }
  }

  const paymentMethod = (await resolveXenditPaymentMethod(xenditData, authHeader)) || payment.payment_method || 'xendit'
  await markIndividualPaymentPaid(payment.id, { payment_method: paymentMethod })

  await Promise.all([
    sendIndividualReceiptEmail(payment.registration_id),
    sendIndividualRacepackEmailsForRegistration(payment.registration_id),
    sendIndividualRacepackWhatsappsForRegistration(payment.registration_id),
  ])

  revalidatePath('/individu-dashboard')
  return { success: true, status: 'paid' as const, paymentMethod }
}
