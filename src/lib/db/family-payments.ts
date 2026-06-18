import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { FamilyPayment } from '@/lib/types'
import { docToFamilyPayment, newId, nowIso, stripMongoId } from './utils'

type FamilyPaymentDoc = FamilyPayment & { _id?: unknown }

export async function findFamilyPaymentById(id: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyPaymentDoc>('family_payments').findOne({ id })
  return stripMongoId(doc) as FamilyPayment | null
}

export async function findFamilyPaymentByReference(reference: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyPaymentDoc>('family_payments').findOne({ payment_reference: reference })
  return stripMongoId(doc) as FamilyPayment | null
}

export async function findFamilyPaymentsByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return []
  const db = await getDb()
  const docs = await db.collection<FamilyPaymentDoc>('family_payments')
    .find({ registration_id: { $in: registrationIds } })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToFamilyPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingFamilyPaymentByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return null
  const db = await getDb()
  const doc = await db.collection<FamilyPaymentDoc>('family_payments')
    .find({ registration_id: { $in: registrationIds }, status: 'pending' })
    .sort({ created_at: -1 })
    .limit(1)
    .next()
  return stripMongoId(doc) as FamilyPayment | null
}

export async function createFamilyPayment(input: {
  registration_id: string
  amount: number
  payment_reference: string
  status?: FamilyPayment['status']
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const payment: FamilyPayment = {
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

  await db.collection('family_payments').insertOne({ ...payment })
  return payment
}

export async function updateFamilyPayment(id: string, values: Partial<FamilyPayment>) {
  const db = await getDb()
  await db.collection('family_payments').updateOne(
    { id },
    { $set: { ...values, updated_at: nowIso() } }
  )
}

export async function updateFamilyPaymentsBySessionId(sessionId: string, values: Partial<FamilyPayment>) {
  const db = await getDb()
  const result = await db.collection<FamilyPaymentDoc>('family_payments').find({
    xendit_session_id: sessionId,
  }).toArray()
  if (result.length === 0) return []

  await db.collection('family_payments').updateMany(
    { xendit_session_id: sessionId },
    { $set: { ...values, updated_at: nowIso() } }
  )
  return result.map((doc) => docToFamilyPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function updateFamilyPaymentsByReference(reference: string, values: Partial<FamilyPayment>) {
  const db = await getDb()
  const result = await db.collection<FamilyPaymentDoc>('family_payments').find({
    payment_reference: reference,
  }).toArray()
  if (result.length === 0) return []

  await db.collection('family_payments').updateMany(
    { payment_reference: reference },
    { $set: { ...values, updated_at: nowIso() } }
  )
  return result.map((doc) => docToFamilyPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function listFamilyPaymentsWithRelations() {
  const db = await getDb()
  const payments = await db.collection<FamilyPaymentDoc>('family_payments').find({}).sort({ created_at: -1 }).toArray()
  const registrationIds = [...new Set(payments.map((p) => p.registration_id))]
  const registrations = await db.collection('family_registrations').find({ id: { $in: registrationIds } }).toArray()
  const familyIds = [...new Set(registrations.map((r) => r.family_id as string))]
  const families = await db.collection('families').find({ id: { $in: familyIds } }).toArray()

  const registrationMap = new Map(registrations.map((r) => [r.id as string, r]))
  const familyMap = new Map(families.map((f) => [f.id as string, f]))

  return payments.map((payment) => {
    const registration = registrationMap.get(payment.registration_id)
    const family = registration ? familyMap.get(registration.family_id as string) : null
    return {
      ...docToFamilyPayment(stripMongoId(payment) as Record<string, unknown>),
      registration: registration
        ? {
            family_id: registration.family_id as string,
            family: family
              ? {
                  id: family.id as string,
                  name: family.name as string,
                  leader_name: family.leader_name as string,
                  email: (family.email as string | null) ?? null,
                  phone: family.phone as string,
                  family_code: family.family_code as string,
                  provinsi: (family.provinsi as string | null) ?? null,
                  kota: (family.kota as string | null) ?? null,
                  kecamatan: (family.kecamatan as string | null) ?? null,
                }
              : null,
          }
        : null,
    }
  })
}

export async function findFamilyPaymentWithRegistration(id: string) {
  const payment = await findFamilyPaymentById(id)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('family_registrations').findOne({ id: payment.registration_id })
  return {
    ...payment,
    registration: registration
      ? { family_id: registration.family_id as string }
      : null,
  }
}

export async function findFamilyPaymentWithRegistrationByReference(reference: string) {
  const payment = await findFamilyPaymentByReference(reference)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('family_registrations').findOne({ id: payment.registration_id })
  return {
    ...payment,
    registration: registration
      ? { family_id: registration.family_id as string }
      : null,
  }
}
