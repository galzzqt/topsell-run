import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { IndividualPayment } from '@/lib/types'
import { docToIndividualPayment, newId, nowIso, stripMongoId } from './utils'

type IndividualPaymentDoc = IndividualPayment & { _id?: unknown }

export async function findIndividualPaymentById(id: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualPaymentDoc>('individual_payments').findOne({ id })
  return stripMongoId(doc) as IndividualPayment | null
}

export async function findIndividualPaymentByReference(reference: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualPaymentDoc>('individual_payments').findOne({ payment_reference: reference })
  return stripMongoId(doc) as IndividualPayment | null
}

export async function findIndividualPaymentsByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return []
  const db = await getDb()
  const docs = await db.collection<IndividualPaymentDoc>('individual_payments')
    .find({ registration_id: { $in: registrationIds } })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToIndividualPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingIndividualPaymentByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return null
  const db = await getDb()
  const doc = await db.collection<IndividualPaymentDoc>('individual_payments')
    .find({ registration_id: { $in: registrationIds }, status: 'pending' })
    .sort({ created_at: -1 })
    .limit(1)
    .next()
  return stripMongoId(doc) as IndividualPayment | null
}

export async function createIndividualPayment(input: {
  registration_id: string
  amount: number
  payment_reference: string
  status?: IndividualPayment['status']
  period_key?: string | null
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const payment: IndividualPayment = {
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
    period_key: input.period_key ?? null,
    paid_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('individual_payments').insertOne({ ...payment })
  return payment
}

export async function updateIndividualPayment(id: string, values: Partial<IndividualPayment>) {
  const db = await getDb()
  await db.collection('individual_payments').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
}

export async function updateIndividualPaymentsBySessionId(sessionId: string, values: Partial<IndividualPayment>) {
  const db = await getDb()
  const result = await db.collection<IndividualPaymentDoc>('individual_payments').find({ xendit_session_id: sessionId }).toArray()
  if (result.length === 0) return []
  await db.collection('individual_payments').updateMany({ xendit_session_id: sessionId }, { $set: { ...values, updated_at: nowIso() } })
  return result.map((doc) => docToIndividualPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function updateIndividualPaymentsByReference(reference: string, values: Partial<IndividualPayment>) {
  const db = await getDb()
  const result = await db.collection<IndividualPaymentDoc>('individual_payments').find({ payment_reference: reference }).toArray()
  if (result.length === 0) return []
  await db.collection('individual_payments').updateMany({ payment_reference: reference }, { $set: { ...values, updated_at: nowIso() } })
  return result.map((doc) => docToIndividualPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function listIndividualPaymentsWithRelations() {
  const db = await getDb()
  const payments = await db.collection<IndividualPaymentDoc>('individual_payments').find({}).sort({ created_at: -1 }).toArray()
  const registrationIds = [...new Set(payments.map((p) => p.registration_id))]
  const registrations = await db.collection('individual_registrations').find({ id: { $in: registrationIds } }).toArray()
  const individualIds = [...new Set(registrations.map((r) => r.individual_id as string))]
  const individuals = await db.collection('individuals').find({ id: { $in: individualIds } }).toArray()

  const registrationMap = new Map(registrations.map((r) => [r.id as string, r]))
  const individualMap = new Map(individuals.map((f) => [f.id as string, f]))

  return payments.map((payment) => {
    const registration = registrationMap.get(payment.registration_id)
    const individual = registration ? individualMap.get(registration.individual_id as string) : null
    return {
      ...docToIndividualPayment(stripMongoId(payment) as Record<string, unknown>),
      registration: registration
        ? {
            individual_id: registration.individual_id as string,
            total_participants: Number(registration.total_participants) || 0,
            individual: individual
              ? {
                  id: individual.id as string,
                  name: individual.name as string,
                  leader_name: individual.leader_name as string,
                  email: (individual.email as string | null) ?? null,
                  phone: individual.phone as string,
                  category: (individual.category as string | null) ?? null,
                  individual_code: individual.individual_code as string,
                  provinsi: (individual.provinsi as string | null) ?? null,
                  kota: (individual.kota as string | null) ?? null,
                  kecamatan: (individual.kecamatan as string | null) ?? null,
                }
              : null,
          }
        : null,
    }
  })
}

export async function findIndividualPaymentWithRegistration(id: string) {
  const payment = await findIndividualPaymentById(id)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('individual_registrations').findOne({ id: payment.registration_id })
  return { ...payment, registration: registration ? { individual_id: registration.individual_id as string } : null }
}

export async function findIndividualPaymentWithRegistrationByReference(reference: string) {
  const payment = await findIndividualPaymentByReference(reference)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('individual_registrations').findOne({ id: payment.registration_id })
  return { ...payment, registration: registration ? { individual_id: registration.individual_id as string } : null }
}
