import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendRacepackEmailsForRegistration } from '@/lib/email/racepack'
import { sendRacepackWhatsappsForRegistration } from '@/lib/whatsapp/racepack'
import { extractXenditPaymentMethod, extractXenditPaymentRequestId } from '@/lib/utils/xendit'

type XenditWebhookPayload = {
  event?: string
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

  if (!isPaidEvent(payload)) {
    return NextResponse.json({ received: true, ignored: true })
  }

  const referenceCandidates = extractReferenceCandidates(payload)
  const sessionCandidates = extractSessionCandidates(payload)

  if (referenceCandidates.length === 0 && sessionCandidates.length === 0) {
    return NextResponse.json({ error: 'Missing Xendit reference' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const update = {
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: await resolvePaymentMethod(payload),
  }

  for (const sessionId of sessionCandidates) {
    const { data, error } = await supabase
      .from('payments')
      .update(update)
      .eq('xendit_session_id', sessionId)
      .select('id, registration_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data && data.length > 0) {
      await Promise.all(data.flatMap((payment) => [
        sendRacepackEmailsForRegistration(payment.registration_id),
        sendRacepackWhatsappsForRegistration(payment.registration_id),
      ]))
      return NextResponse.json({ received: true })
    }
  }

  for (const referenceId of referenceCandidates) {
    const { data, error } = await supabase
      .from('payments')
      .update(update)
      .eq('payment_reference', referenceId)
      .select('id, registration_id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data && data.length > 0) {
      await Promise.all(data.flatMap((payment) => [
        sendRacepackEmailsForRegistration(payment.registration_id),
        sendRacepackWhatsappsForRegistration(payment.registration_id),
      ]))
      return NextResponse.json({ received: true })
    }
  }

  return NextResponse.json(
    { error: 'Payment not found' },
    { status: 404 }
  )
}
