import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Payment } from '@/lib/types'
import { docToPayment, newId, nowIso, stripMongoId } from './utils'

type PaymentDoc = Payment & { _id?: unknown }

export async function findPaymentById(id: string) {
  const db = await getDb()
  const doc = await db.collection<PaymentDoc>('payments').findOne({ id })
  return stripMongoId(doc) as Payment | null
}

export async function findPaymentByReference(reference: string) {
  const db = await getDb()
  const doc = await db.collection<PaymentDoc>('payments').findOne({ payment_reference: reference })
  return stripMongoId(doc) as Payment | null
}

export async function findPaymentsByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return []
  const db = await getDb()
  const docs = await db.collection<PaymentDoc>('payments')
    .find({ registration_id: { $in: registrationIds } })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingPaymentByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return null
  const db = await getDb()
  const doc = await db.collection<PaymentDoc>('payments')
    .find({ registration_id: { $in: registrationIds }, status: 'pending' })
    .sort({ created_at: -1 })
    .limit(1)
    .next()
  return stripMongoId(doc) as Payment | null
}

export async function createPayment(input: {
  registration_id: string
  amount: number
  payment_reference: string
  status?: Payment['status']
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const payment: Payment = {
    id,
    registration_id: input.registration_id,
    amount: input.amount,
    payment_method: null,
    payment_reference: input.payment_reference,
    snap_token: null,
    provider: 'xendit',
    xendit_session_id: null,
    checkout_url: null,
    status: input.status || 'pending',
    paid_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('payments').insertOne({ ...payment })
  return payment
}

export async function updatePayment(id: string, values: Partial<Payment>) {
  const db = await getDb()
  await db.collection('payments').updateOne(
    { id },
    { $set: { ...values, updated_at: nowIso() } }
  )
}

export async function updatePaymentsBySessionId(sessionId: string, values: Partial<Payment>) {
  const db = await getDb()
  const result = await db.collection<PaymentDoc>('payments').find({
    xendit_session_id: sessionId,
  }).toArray()
  if (result.length === 0) return []

  await db.collection('payments').updateMany(
    { xendit_session_id: sessionId },
    { $set: { ...values, updated_at: nowIso() } }
  )
  return result.map((doc) => docToPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function updatePaymentsByReference(reference: string, values: Partial<Payment>) {
  const db = await getDb()
  const result = await db.collection<PaymentDoc>('payments').find({
    payment_reference: reference,
  }).toArray()
  if (result.length === 0) return []

  await db.collection('payments').updateMany(
    { payment_reference: reference },
    { $set: { ...values, updated_at: nowIso() } }
  )
  return result.map((doc) => docToPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function listPaymentsWithRelations() {
  const db = await getDb()
  const payments = await db.collection<PaymentDoc>('payments').find({}).sort({ created_at: -1 }).toArray()
  const registrationIds = [...new Set(payments.map((p) => p.registration_id))]
  const registrations = await db.collection('registrations').find({ id: { $in: registrationIds } }).toArray()
  const communityIds = [...new Set(registrations.map((r) => r.community_id as string))]
  const communities = await db.collection('communities').find({ id: { $in: communityIds } }).toArray()

  const registrationMap = new Map(registrations.map((r) => [r.id as string, r]))
  const communityMap = new Map(communities.map((c) => [c.id as string, c]))

  return payments.map((payment) => {
    const registration = registrationMap.get(payment.registration_id)
    const community = registration ? communityMap.get(registration.community_id as string) : null
    return {
      ...docToPayment(stripMongoId(payment) as Record<string, unknown>),
      registration: registration
        ? {
            community_id: registration.community_id as string,
            community: community
              ? {
                  id: community.id as string,
                  name: community.name as string,
                  leader_name: community.leader_name as string,
                  email: (community.email as string | null) ?? null,
                  phone: community.phone as string,
                  community_code: community.community_code as string,
                  provinsi: (community.provinsi as string | null) ?? null,
                  kota: (community.kota as string | null) ?? null,
                  kecamatan: (community.kecamatan as string | null) ?? null,
                }
              : null,
          }
        : null,
    }
  })
}

export async function findPaymentWithRegistration(id: string) {
  const payment = await findPaymentById(id)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('registrations').findOne({ id: payment.registration_id })
  return {
    ...payment,
    registration: registration
      ? { community_id: registration.community_id as string }
      : null,
  }
}

export async function findPaymentWithRegistrationByReference(reference: string) {
  const payment = await findPaymentByReference(reference)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('registrations').findOne({ id: payment.registration_id })
  return {
    ...payment,
    registration: registration
      ? { community_id: registration.community_id as string }
      : null,
  }
}
