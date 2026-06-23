import { NextResponse } from 'next/server'
import {
  markPaymentsPaidByReference,
  markPaymentsPaidBySessionId,
  markFamilyPaymentsPaidByReference,
  markFamilyPaymentsPaidBySessionId,
  markPaymentFailed,
  markPaymentExpired,
  markFamilyPaymentFailed,
  markFamilyPaymentExpired,
} from '@/lib/db'
import {
  sendRacepackEmailsForRegistration,
  sendFamilyRacepackEmailsForRegistration,
} from '@/lib/email/racepack'
import {
  sendRacepackWhatsappsForRegistration,
  sendFamilyRacepackWhatsappsForRegistration,
} from '@/lib/whatsapp/racepack'
import { extractXenditPaymentMethod, extractXenditPaymentRequestId } from '@/lib/utils/xendit'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { getDb } from '@/lib/mongodb/client'

type XenditWebhookPayload = {
  event?: string
  status?: string
  reference_id?: string
  referenceId?: string
  reference?: string
  data?: {
    id?: string
    payment_session_id?: string
    paymentSessionId?: string
    payment_session?: {
      id?: string
      payment_session_id?: string
    }
    reference_id?: string
    referenceId?: string
    reference?: string
    payment_request_id?: string
    status?: string
    payment_method?: {
      type?: string
      reusability?: string
      virtual_account?: {
        channel_code?: string
      }
      qr_code?: {
        channel_code?: string
      }
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

function isPaidEvent(payload: XenditWebhookPayload) {
  const event = (payload.event || '').toLowerCase()
  const status = (payload.data?.status || '').toUpperCase()

  if (
    event === 'payment_session.completed' ||
    event === 'payment_session.succeeded' ||
    event === 'payment_session.paid' ||
    event === 'invoice.paid' ||
    event === 'invoice.settled'
  ) {
    return true
  }

  return (
    status === 'SUCCEEDED' ||
    status === 'COMPLETED' ||
    status === 'PAID' ||
    status === 'SETTLED' ||
    status === 'SUCCESS'
  )
}

function normalizeReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '')
}

function extractReferenceCandidates(payload: XenditWebhookPayload) {
  const candidates: string[] = []
  const possible = [
    payload?.data?.reference_id,
    payload?.data?.referenceId,
    payload?.data?.reference,
    payload?.reference_id,
    payload?.referenceId,
    payload?.reference,
  ]

  for (const value of possible) {
    if (typeof value === 'string' && value.trim()) candidates.push(value.trim())
  }

  const normalized = candidates.map((c) => normalizeReference(c)).filter(Boolean)
  return Array.from(new Set([...candidates, ...normalized]))
}

function extractSessionCandidates(payload: XenditWebhookPayload) {
  const candidates: string[] = []
  const possible = [
    payload?.data?.payment_session_id,
    payload?.data?.paymentSessionId,
    payload?.data?.payment_session?.id,
    payload?.data?.payment_session?.payment_session_id,
    payload?.data?.id,
  ]

  for (const value of possible) {
    if (typeof value === 'string' && value.trim()) candidates.push(value.trim())
  }

  return Array.from(new Set(candidates))
}

async function resolvePaymentMethod(payload: XenditWebhookPayload) {
  const payloadMethod = extractXenditPaymentMethod(payload)
  if (payloadMethod) return payloadMethod

  const paymentRequestId = extractXenditPaymentRequestId(payload)
  const xenditSecretKey = process.env.XENDIT_SECRET_KEY || ''
  if (!paymentRequestId || !xenditSecretKey) return 'xendit'

  const authHeader = 'Basic ' + Buffer.from(`${xenditSecretKey}:`).toString('base64')
  const res = await fetch(`https://api.xendit.co/payment_requests/${encodeURIComponent(paymentRequestId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: authHeader },
  })

  if (!res.ok) return 'xendit'

  return extractXenditPaymentMethod(await res.json()) || 'xendit'
}

export async function POST(request: Request) {
  const callbackToken = process.env.XENDIT_CALLBACK_TOKEN
  const incomingToken = request.headers.get('x-callback-token')

  if (!callbackToken && process.env.NODE_ENV === 'production') {
    console.error('XENDIT_CALLBACK_TOKEN is required in production.')
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 })
  }

  if (callbackToken && incomingToken !== callbackToken) {
    return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 })
  }

  const rawPayload = await request.text()
  if (rawPayload.length > 64 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let payload: XenditWebhookPayload
  try {
    payload = JSON.parse(rawPayload) as XenditWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const referenceCandidates = extractReferenceCandidates(payload)
  const sessionCandidates = extractSessionCandidates(payload)

  if (!isPaidEvent(payload)) {
    const status = (payload.data?.status || payload.status || '').toUpperCase()
    const event = (payload.event || '').toLowerCase()
    const isExpired = status === 'EXPIRED' || event.includes('expired')
    const isFailed = status === 'FAILED' || event.includes('failed')

    if (isExpired || isFailed) {
      if (referenceCandidates.length > 0 || sessionCandidates.length > 0) {
        const db = await getDb()
        const orQuery = [
          ...(referenceCandidates.length > 0 ? [{ payment_reference: { $in: referenceCandidates } }] : []),
          ...(sessionCandidates.length > 0 ? [{ xendit_session_id: { $in: sessionCandidates } }] : []),
        ]

        let processedAny = false

        // Update community payments
        const communityPayments = await db.collection('payments').find({ $or: orQuery }).toArray()
        for (const p of communityPayments) {
          if (isExpired) {
            await markPaymentExpired(p.id)
          } else {
            await markPaymentFailed(p.id)
          }
          await ingestAdminLog({
            level: 'warning',
            source: 'payment',
            event: isExpired ? 'community_payment_webhook_expired' : 'community_payment_webhook_failed',
            message: `Pembayaran komunitas ${isExpired ? 'expired' : 'gagal'} via webhook (Ref: ${p.payment_reference}).`,
            data: { paymentId: p.id, reference: p.payment_reference, amount: p.amount, status }
          })
          processedAny = true
        }

        // Update family payments
        const familyPayments = await db.collection('family_payments').find({ $or: orQuery }).toArray()
        for (const p of familyPayments) {
          if (isExpired) {
            await markFamilyPaymentExpired(p.id)
          } else {
            await markFamilyPaymentFailed(p.id)
          }
          await ingestAdminLog({
            level: 'warning',
            source: 'payment',
            event: isExpired ? 'family_payment_webhook_expired' : 'family_payment_webhook_failed',
            message: `Pembayaran Brother & Sister Package ${isExpired ? 'expired' : 'gagal'} via webhook (Ref: ${p.payment_reference}).`,
            data: { paymentId: p.id, reference: p.payment_reference, amount: p.amount, status }
          })
          processedAny = true
        }

        if (processedAny) {
          return NextResponse.json({ received: true, processed: true })
        }
      }
    }

    return NextResponse.json({ received: true, ignored: true })
  }

  if (referenceCandidates.length === 0 && sessionCandidates.length === 0) {
    return NextResponse.json({ error: 'Missing Xendit reference' }, { status: 400 })
  }

  const update = {
    paid_at: new Date().toISOString(),
    payment_method: await resolvePaymentMethod(payload),
  }

  for (const sessionId of sessionCandidates) {
    // Try community first
    const payments = await markPaymentsPaidBySessionId(sessionId, update)
    if (payments.length > 0) {
      await Promise.all(payments.flatMap((payment) => [
        sendRacepackEmailsForRegistration(payment.registration_id),
        sendRacepackWhatsappsForRegistration(payment.registration_id),
      ]))
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: 'community_payment_webhook_paid',
        message: `Pembayaran komunitas sukses via webhook (Session: ${sessionId}).`,
        data: { sessionId, reference: payments[0]?.payment_reference, amount: payments[0]?.amount }
      })
      return NextResponse.json({ received: true })
    }

    // Try family next
    const familyPayments = await markFamilyPaymentsPaidBySessionId(sessionId, update)
    if (familyPayments.length > 0) {
      await Promise.all(familyPayments.flatMap((payment) => [
        sendFamilyRacepackEmailsForRegistration(payment.registration_id),
        sendFamilyRacepackWhatsappsForRegistration(payment.registration_id),
      ]))
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: 'family_payment_webhook_paid',
        message: `Pembayaran Brother & Sister Package sukses via webhook (Session: ${sessionId}).`,
        data: { sessionId, reference: familyPayments[0]?.payment_reference, amount: familyPayments[0]?.amount }
      })
      return NextResponse.json({ received: true })
    }
  }

  for (const referenceId of referenceCandidates) {
    // Try community first
    const payments = await markPaymentsPaidByReference(referenceId, update)
    if (payments.length > 0) {
      await Promise.all(payments.flatMap((payment) => [
        sendRacepackEmailsForRegistration(payment.registration_id),
        sendRacepackWhatsappsForRegistration(payment.registration_id),
      ]))
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: 'community_payment_webhook_paid',
        message: `Pembayaran komunitas sukses via webhook (Ref: ${referenceId}).`,
        data: { referenceId, amount: payments[0]?.amount }
      })
      return NextResponse.json({ received: true })
    }

    // Try family next
    const familyPayments = await markFamilyPaymentsPaidByReference(referenceId, update)
    if (familyPayments.length > 0) {
      await Promise.all(familyPayments.flatMap((payment) => [
        sendFamilyRacepackEmailsForRegistration(payment.registration_id),
        sendFamilyRacepackWhatsappsForRegistration(payment.registration_id),
      ]))
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: 'family_payment_webhook_paid',
        message: `Pembayaran Brother & Sister Package sukses via webhook (Ref: ${referenceId}).`,
        data: { referenceId, amount: familyPayments[0]?.amount }
      })
      return NextResponse.json({ received: true })
    }
  }

  return NextResponse.json(
    { error: 'Payment not found' },
    { status: 404 }
  )
}
