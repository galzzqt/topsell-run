import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Participant } from '@/lib/types'
import { docToParticipant, newId, nowIso, stripMongoId } from './utils'

type ParticipantDoc = Participant & { _id?: unknown }

export async function findParticipantById(id: string) {
  const db = await getDb()
  const doc = await db.collection<ParticipantDoc>('participants').findOne({ id })
  return stripMongoId(doc) as Participant | null
}

export async function findParticipantsByCommunityId(communityId: string) {
  const db = await getDb()
  const docs = await db.collection<ParticipantDoc>('participants')
    .find({ community_id: communityId })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function findParticipantsByRegistrationId(registrationId: string, filter?: Record<string, unknown>) {
  const db = await getDb()
  const docs = await db.collection<ParticipantDoc>('participants')
    .find({ registration_id: registrationId, ...filter })
    .toArray()
  return docs.map((doc) => docToParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countParticipantsWithCode() {
  const db = await getDb()
  return db.collection('participants').countDocuments({ participant_code: { $ne: null } })
}

export async function findDuplicateParticipants(email: string, phone: string) {
  const db = await getDb()
  const doc = await db.collection<ParticipantDoc>('participants').findOne({
    $or: [
      { email: email.toLowerCase() },
      { phone: phone },
    ]
  })
  return stripMongoId(doc) as Participant | null
}

export async function findActiveParticipants(email: string, phone: string) {
  const db = await getDb()
  const doc = await db.collection<ParticipantDoc>('participants').findOne({
    $and: [
      {
        $or: [
          { email: email.toLowerCase() },
          { phone: phone },
        ]
      },
      {
        payment_status: { $in: ['pending', 'paid'] }  // Only active participants
      }
    ]
  })
  return stripMongoId(doc) as Participant | null
}

export async function findActiveCrossParticipant(email: string, phone: string) {
  const db = await getDb()
  // Check BOTH community and family participants - return whichever is found active
  const communityDoc = await db.collection<ParticipantDoc>('participants').findOne({
    $and: [
      {
        $or: [
          { email: email.toLowerCase() },
          { phone: phone },
        ]
      },
      {
        payment_status: { $in: ['pending', 'paid'] }
      }
    ]
  })
  
  if (communityDoc) {
    return { type: 'community' as const, participant: stripMongoId(communityDoc) as Participant }
  }

  const familyDoc = await db.collection('family_participants').findOne({
    $and: [
      {
        $or: [
          { email: email.toLowerCase() },
          { phone: phone },
        ]
      },
      {
        payment_status: { $in: ['pending', 'paid'] }
      }
    ]
  })

  if (familyDoc) {
    return { type: 'family' as const, participant: stripMongoId(familyDoc) }
  }

  return null
}

export async function listParticipantsWithCommunity() {
  const db = await getDb()
  const participants = await db.collection<ParticipantDoc>('participants').find({}).toArray()
  const communityIds = [...new Set(participants.map((p) => p.community_id))]
  const communities = await db.collection('communities')
    .find({ id: { $in: communityIds } })
    .project({ id: 1, name: 1, leader_name: 1, email: 1, phone: 1, community_code: 1, provinsi: 1, kota: 1, kecamatan: 1 })
    .toArray()
  const communityMap = new Map(communities.map((c) => [c.id as string, c]))

  return participants.map((participant) => {
    const community = communityMap.get(participant.community_id)
    return {
      ...docToParticipant(stripMongoId(participant) as Record<string, unknown>),
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
  })
}

export async function insertParticipants(values: Omit<Participant, 'id' | 'created_at' | 'updated_at'>[]) {
  const db = await getDb()
  const timestamp = nowIso()
  const docs = values.map((value) => {
    const id = newId()
    return {
      ...value,
      id,
      created_at: timestamp,
      updated_at: timestamp,
    }
  })

  if (docs.length === 0) return []
  await db.collection('participants').insertMany(docs)
  return docs as Participant[]
}

export async function updateParticipants(filter: Record<string, unknown>, values: Partial<Participant>) {
  const db = await getDb()
  await db.collection('participants').updateMany(filter, { $set: { ...values, updated_at: nowIso() } })
}

export async function updateParticipantById(id: string, values: Partial<Participant>, options?: { protectPaid?: boolean }) {
  if (options?.protectPaid) {
    const existing = await findParticipantById(id)
    if (!existing) return { error: 'Peserta tidak ditemukan.' }
    if (existing.payment_status !== 'pending') {
      return { error: 'Paid or failed participants cannot be edited by client users.' }
    }
  }

  const db = await getDb()
  await db.collection('participants').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
  return { success: true as const }
}

export async function updateParticipantIds(ids: string[], values: Partial<Participant>) {
  const db = await getDb()
  await db.collection('participants').updateMany({ id: { $in: ids } }, { $set: { ...values, updated_at: nowIso() } })
}

export async function linkParticipantsToRegistration(participantIds: string[], registrationId: string) {
  const db = await getDb()
  await db.collection('participants').updateMany(
    { id: { $in: participantIds } },
    { $set: { registration_id: registrationId, updated_at: nowIso() } }
  )
}

export async function findPendingParticipantsWithoutRegistration(communityId: string) {
  const db = await getDb()
  const docs = await db.collection<ParticipantDoc>('participants')
    .find({
      community_id: communityId,
      payment_status: 'pending',
      $or: [{ registration_id: null }, { registration_id: { $exists: false } }],
    })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countUnsentRacepackWhatsapps(registrationId: string) {
  const db = await getDb()
  return db.collection('participants').countDocuments({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_whatsapp_sent_at: null }, { racepack_whatsapp_sent_at: { $exists: false } }],
  })
}

export async function findPaidParticipantsForRacepackEmail(registrationId: string) {
  const db = await getDb()
  const docs = await db.collection<ParticipantDoc>('participants').find({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_email_sent_at: null }, { racepack_email_sent_at: { $exists: false } }],
  }).toArray()

  const communityIds = [...new Set(docs.map((doc) => doc.community_id))]
  const communities = await db.collection('communities')
    .find({ id: { $in: communityIds } })
    .project({ id: 1, name: 1, community_code: 1, email: 1 })
    .toArray()
  const communityMap = new Map(communities.map((c) => [c.id as string, c]))

  return docs.map((doc) => {
    const community = communityMap.get(doc.community_id)
    return {
      ...docToParticipant(stripMongoId(doc) as Record<string, unknown>),
      community: community
        ? {
            name: community.name as string,
            community_code: community.community_code as string,
            email: (community.email as string | null) ?? null,
          }
        : null,
    }
  })
}

export async function findParticipantWithCommunityById(id: string) {
  const participant = await findParticipantById(id)
  if (!participant) return null

  const db = await getDb()
  const community = await db.collection('communities').findOne({ id: participant.community_id })
  if (!community) return { ...participant, community: null }

  return {
    ...participant,
    community: {
      name: community.name as string,
      community_code: community.community_code as string,
    },
  }
}

export async function markParticipantCheckedIn(id: string) {
  const db = await getDb()
  const pickedUpAt = nowIso()
  await db.collection('participants').updateOne(
    { id },
    { $set: { checked_in: true, checked_in_at: pickedUpAt, updated_at: pickedUpAt } }
  )
  return pickedUpAt
}
