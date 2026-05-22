import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

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

function getPaymentMethod(payload: XenditWebhookPayload) {
  const method = payload.data?.payment_method
  return (
    method?.virtual_account?.channel_code ||
    method?.qr_code?.channel_code ||
    method?.type ||
    'xendit'
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

export async function POST(request: Request) {
  const callbackToken = process.env.XENDIT_CALLBACK_TOKEN
  const incomingToken = request.headers.get('x-callback-token')

  if (callbackToken && incomingToken !== callbackToken) {
    return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 })
  }

  const payload = (await request.json()) as XenditWebhookPayload

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
    payment_method: getPaymentMethod(payload),
  }

  for (const sessionId of sessionCandidates) {
    const { data, error } = await supabase
      .from('payments')
      .update(update)
      .eq('xendit_session_id', sessionId)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data && data.length > 0) return NextResponse.json({ received: true })
  }

  for (const referenceId of referenceCandidates) {
    const { data, error } = await supabase
      .from('payments')
      .update(update)
      .eq('payment_reference', referenceId)
      .select('id')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data && data.length > 0) return NextResponse.json({ received: true })
  }

  return NextResponse.json(
    { error: 'Payment not found', referenceCandidates, sessionCandidates },
    { status: 404 }
  )
}
