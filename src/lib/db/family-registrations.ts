import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { FamilyRegistration } from '@/lib/types'
import { docToFamilyRegistration, newId, nowIso, stripMongoId } from './utils'

type FamilyRegistrationDoc = FamilyRegistration & { _id?: unknown }

export async function findFamilyRegistrationById(id: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyRegistrationDoc>('family_registrations').findOne({ id })
  return stripMongoId(doc) as FamilyRegistration | null
}

export async function findFamilyRegistrationsByFamilyId(familyId: string) {
  const db = await getDb()
  const docs = await db.collection<FamilyRegistrationDoc>('family_registrations')
    .find({ family_id: familyId })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToFamilyRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingFamilyRegistrationsByFamilyId(familyId: string) {
  const db = await getDb()
  const docs = await db.collection<FamilyRegistrationDoc>('family_registrations')
    .find({ family_id: familyId, status: 'pending' })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToFamilyRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function createFamilyRegistration(input: {
  family_id: string
  total_participants: number
  total_amount: number
  status?: FamilyRegistration['status']
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const registration: FamilyRegistration = {
    id,
    family_id: input.family_id,
    total_participants: input.total_participants,
    total_amount: input.total_amount,
    status: input.status || 'pending',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('family_registrations').insertOne({ ...registration })
  return registration
}

export async function updateFamilyRegistration(id: string, values: Partial<FamilyRegistration>) {
  const db = await getDb()
  await db.collection('family_registrations').updateOne(
    { id },
    { $set: { ...values, updated_at: nowIso() } }
  )
}

export async function deleteFamilyRegistration(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('family_registrations').deleteOne({ id }),
    db.collection('family_payments').deleteMany({ registration_id: id }),
    db.collection('family_participants').updateMany(
      { registration_id: id },
      { $set: { registration_id: null, updated_at: nowIso() } }
    ),
  ])
}

export async function findPaidFamilyRegistrationWithFamily(registrationId: string) {
  const db = await getDb()
  const registration = await db.collection<FamilyRegistrationDoc>('family_registrations').findOne({
    id: registrationId,
    status: 'paid',
  })
  if (!registration) return null

  const family = await db.collection('families').findOne({ id: registration.family_id })
  return {
    ...docToFamilyRegistration(stripMongoId(registration) as Record<string, unknown>),
    family: family
      ? {
          id: family.id as string,
          name: family.name as string,
          leader_name: family.leader_name as string,
          email: (family.email as string | null) ?? null,
          phone: family.phone as string,
          family_code: family.family_code as string,
        }
      : null,
  }
}
