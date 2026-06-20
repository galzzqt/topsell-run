import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { FamilyParticipant } from '@/lib/types'
import { docToFamilyParticipant, newId, nowIso, stripMongoId } from './utils'

type FamilyParticipantDoc = FamilyParticipant & { _id?: unknown }

export async function findFamilyParticipantById(id: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyParticipantDoc>('family_participants').findOne({ id })
  return stripMongoId(doc) as FamilyParticipant | null
}

export async function findFamilyParticipantsByFamilyId(familyId: string) {
  const db = await getDb()
  const docs = await db.collection<FamilyParticipantDoc>('family_participants')
    .find({ family_id: familyId })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToFamilyParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function findFamilyParticipantsByRegistrationId(registrationId: string, filter?: Record<string, unknown>) {
  const db = await getDb()
  const docs = await db.collection<FamilyParticipantDoc>('family_participants')
    .find({ registration_id: registrationId, ...filter })
    .toArray()
  return docs.map((doc) => docToFamilyParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countFamilyParticipantsWithCode() {
  const db = await getDb()
  return db.collection('family_participants').countDocuments({ participant_code: { $ne: null } })
}

export async function findDuplicateFamilyParticipants(email: string, phone: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyParticipantDoc>('family_participants').findOne({
    $or: [
      { email: email.toLowerCase() },
      { phone: phone },
    ]
  })
  return stripMongoId(doc) as FamilyParticipant | null
}

export async function findActiveFamilyParticipants(email: string, phone: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyParticipantDoc>('family_participants').findOne({
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
  return stripMongoId(doc) as FamilyParticipant | null
}

export async function findActiveCrossFamilyParticipant(email: string, phone: string) {
  const db = await getDb()
  // Check BOTH community and family participants - return whichever is found active
  const familyDoc = await db.collection<FamilyParticipantDoc>('family_participants').findOne({
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
    return { type: 'family' as const, participant: stripMongoId(familyDoc) as FamilyParticipant }
  }

  const communityDoc = await db.collection('participants').findOne({
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
    return { type: 'community' as const, participant: stripMongoId(communityDoc) }
  }

  return null
}

export async function listFamilyParticipantsWithFamily() {
  const db = await getDb()
  const participants = await db.collection<FamilyParticipantDoc>('family_participants').find({}).toArray()
  const familyIds = [...new Set(participants.map((p) => p.family_id))]
  const families = await db.collection('families')
    .find({ id: { $in: familyIds } })
    .project({ id: 1, name: 1, leader_name: 1, email: 1, phone: 1, family_code: 1, provinsi: 1, kota: 1, kecamatan: 1 })
    .toArray()
  const familyMap = new Map(families.map((f) => [f.id as string, f]))

  return participants.map((participant) => {
    const family = familyMap.get(participant.family_id)
    return {
      ...docToFamilyParticipant(stripMongoId(participant) as Record<string, unknown>),
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
  })
}

export async function insertFamilyParticipants(values: Omit<FamilyParticipant, 'id' | 'created_at' | 'updated_at'>[]) {
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
  await db.collection('family_participants').insertMany(docs)
  return docs as FamilyParticipant[]
}

export async function updateFamilyParticipants(filter: Record<string, unknown>, values: Partial<FamilyParticipant>) {
  const db = await getDb()
  await db.collection('family_participants').updateMany(filter, { $set: { ...values, updated_at: nowIso() } })
}

export async function updateFamilyParticipantById(id: string, values: Partial<FamilyParticipant>, options?: { protectPaid?: boolean }) {
  if (options?.protectPaid) {
    const existing = await findFamilyParticipantById(id)
    if (!existing) return { error: 'Peserta tidak ditemukan.' }
    if (existing.payment_status !== 'pending') {
      return { error: 'Paid or failed participants cannot be edited by client users.' }
    }
  }

  const db = await getDb()
  await db.collection('family_participants').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
  return { success: true as const }
}

export async function updateFamilyParticipantIds(ids: string[], values: Partial<FamilyParticipant>) {
  const db = await getDb()
  await db.collection('family_participants').updateMany({ id: { $in: ids } }, { $set: { ...values, updated_at: nowIso() } })
}

export async function linkFamilyParticipantsToRegistration(participantIds: string[], registrationId: string) {
  const db = await getDb()
  await db.collection('family_participants').updateMany(
    { id: { $in: participantIds } },
    { $set: { registration_id: registrationId, updated_at: nowIso() } }
  )
}

export async function findPendingFamilyParticipantsWithoutRegistration(familyId: string) {
  const db = await getDb()
  const docs = await db.collection<FamilyParticipantDoc>('family_participants')
    .find({
      family_id: familyId,
      payment_status: 'pending',
      $or: [{ registration_id: null }, { registration_id: { $exists: false } }],
    })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToFamilyParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countUnsentFamilyRacepackWhatsapps(registrationId: string) {
  const db = await getDb()
  return db.collection('family_participants').countDocuments({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_whatsapp_sent_at: null }, { racepack_whatsapp_sent_at: { $exists: false } }],
  })
}

export async function findPaidFamilyParticipantsForRacepackEmail(registrationId: string) {
  const db = await getDb()
  const docs = await db.collection<FamilyParticipantDoc>('family_participants').find({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_email_sent_at: null }, { racepack_email_sent_at: { $exists: false } }],
  }).toArray()

  const familyIds = [...new Set(docs.map((doc) => doc.family_id))]
  const families = await db.collection('families')
    .find({ id: { $in: familyIds } })
    .project({ id: 1, name: 1, family_code: 1, email: 1 })
    .toArray()
  const familyMap = new Map(families.map((f) => [f.id as string, f]))

  return docs.map((doc) => {
    const family = familyMap.get(doc.family_id)
    return {
      ...docToFamilyParticipant(stripMongoId(doc) as Record<string, unknown>),
      family: family
        ? {
            name: family.name as string,
            family_code: family.family_code as string,
            email: (family.email as string | null) ?? null,
          }
        : null,
    }
  })
}

export async function findFamilyParticipantWithFamilyById(id: string) {
  const participant = await findFamilyParticipantById(id)
  if (!participant) return null

  const db = await getDb()
  const family = await db.collection('families').findOne({ id: participant.family_id })
  if (!family) return { ...participant, family: null }

  return {
    ...participant,
    family: {
      name: family.name as string,
      family_code: family.family_code as string,
    },
  }
}

export async function markFamilyParticipantCheckedIn(id: string) {
  const db = await getDb()
  const pickedUpAt = nowIso()
  await db.collection('family_participants').updateOne(
    { id },
    { $set: { checked_in: true, checked_in_at: pickedUpAt, updated_at: pickedUpAt } }
  )
  return pickedUpAt
}
