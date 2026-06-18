import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Registration } from '@/lib/types'
import { docToRegistration, newId, nowIso, stripMongoId } from './utils'

type RegistrationDoc = Registration & { _id?: unknown }

export async function findRegistrationById(id: string) {
  const db = await getDb()
  const doc = await db.collection<RegistrationDoc>('registrations').findOne({ id })
  return stripMongoId(doc) as Registration | null
}

export async function findRegistrationsByCommunityId(communityId: string) {
  const db = await getDb()
  const docs = await db.collection<RegistrationDoc>('registrations')
    .find({ community_id: communityId })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingRegistrationsByCommunityId(communityId: string) {
  const db = await getDb()
  const docs = await db.collection<RegistrationDoc>('registrations')
    .find({ community_id: communityId, status: 'pending' })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function createRegistration(input: {
  community_id: string
  total_participants: number
  total_amount: number
  status?: Registration['status']
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const registration: Registration = {
    id,
    community_id: input.community_id,
    total_participants: input.total_participants,
    total_amount: input.total_amount,
    status: input.status || 'pending',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('registrations').insertOne({ ...registration })
  return registration
}

export async function updateRegistration(id: string, values: Partial<Registration>) {
  const db = await getDb()
  await db.collection('registrations').updateOne(
    { id },
    { $set: { ...values, updated_at: nowIso() } }
  )
}

export async function deleteRegistration(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('registrations').deleteOne({ id }),
    db.collection('payments').deleteMany({ registration_id: id }),
    db.collection('participants').updateMany(
      { registration_id: id },
      { $set: { registration_id: null, updated_at: nowIso() } }
    ),
  ])
}

export async function findPaidRegistrationWithCommunity(registrationId: string) {
  const db = await getDb()
  const registration = await db.collection<RegistrationDoc>('registrations').findOne({
    id: registrationId,
    status: 'paid',
  })
  if (!registration) return null

  const community = await db.collection('communities').findOne({ id: registration.community_id })
  return {
    ...docToRegistration(stripMongoId(registration) as Record<string, unknown>),
    community: community
      ? {
          id: community.id as string,
          name: community.name as string,
          leader_name: community.leader_name as string,
          email: (community.email as string | null) ?? null,
          phone: community.phone as string,
          community_code: community.community_code as string,
        }
      : null,
  }
}
