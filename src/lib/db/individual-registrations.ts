import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { IndividualRegistration } from '@/lib/types'
import { docToIndividualRegistration, newId, nowIso, stripMongoId } from './utils'

type IndividualRegistrationDoc = IndividualRegistration & { _id?: unknown }

export async function findIndividualRegistrationById(id: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualRegistrationDoc>('individual_registrations').findOne({ id })
  return stripMongoId(doc) as IndividualRegistration | null
}

export async function findIndividualRegistrationsByIndividualId(individualId: string) {
  const db = await getDb()
  const docs = await db.collection<IndividualRegistrationDoc>('individual_registrations')
    .find({ individual_id: individualId })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToIndividualRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingIndividualRegistrationsByIndividualId(individualId: string) {
  const db = await getDb()
  const docs = await db.collection<IndividualRegistrationDoc>('individual_registrations')
    .find({ individual_id: individualId, status: 'pending' })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToIndividualRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function createIndividualRegistration(input: {
  individual_id: string
  total_participants: number
  total_amount: number
  status?: IndividualRegistration['status']
  voucher_code?: string | null
  voucher_discount?: number
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const registration: IndividualRegistration = {
    id,
    individual_id: input.individual_id,
    total_participants: input.total_participants,
    total_amount: input.total_amount,
    voucher_code: input.voucher_code ?? null,
    voucher_discount: input.voucher_discount ?? 0,
    status: input.status || 'pending',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('individual_registrations').insertOne({ ...registration })
  return registration
}

export async function updateIndividualRegistration(id: string, values: Partial<IndividualRegistration>) {
  const db = await getDb()
  await db.collection('individual_registrations').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
}

export async function deleteIndividualRegistration(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('individual_registrations').deleteOne({ id }),
    db.collection('individual_payments').deleteMany({ registration_id: id }),
    db.collection('individual_participants').updateMany(
      { registration_id: id },
      { $set: { registration_id: null, updated_at: nowIso() } }
    ),
  ])
}

export async function findPaidIndividualRegistrationWithIndividual(registrationId: string) {
  const db = await getDb()
  const registration = await db.collection<IndividualRegistrationDoc>('individual_registrations').findOne({
    id: registrationId,
    status: 'paid',
  })
  if (!registration) return null

  const individual = await db.collection('individuals').findOne({ id: registration.individual_id })
  return {
    ...docToIndividualRegistration(stripMongoId(registration) as Record<string, unknown>),
    individual: individual
      ? {
          id: individual.id as string,
          name: individual.name as string,
          leader_name: individual.leader_name as string,
          email: (individual.email as string | null) ?? null,
          phone: individual.phone as string,
          individual_code: individual.individual_code as string,
        }
      : null,
  }
}
