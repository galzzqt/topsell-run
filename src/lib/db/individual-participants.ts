import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { IndividualParticipant } from '@/lib/types'
import { docToIndividualParticipant, exactEmailRegex, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type IndividualParticipantDoc = IndividualParticipant & { _id?: unknown }

export async function findIndividualParticipantById(id: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualParticipantDoc>('individual_participants').findOne({ id })
  return stripMongoId(doc) as IndividualParticipant | null
}

export async function findIndividualParticipantsByIndividualId(individualId: string) {
  const db = await getDb()
  const docs = await db.collection<IndividualParticipantDoc>('individual_participants')
    .find({ individual_id: individualId })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToIndividualParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function findIndividualParticipantsByRegistrationId(registrationId: string, filter?: Record<string, unknown>) {
  const db = await getDb()
  const docs = await db.collection<IndividualParticipantDoc>('individual_participants')
    .find({ registration_id: registrationId, ...filter })
    .toArray()
  return docs.map((doc) => docToIndividualParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countIndividualParticipantsWithCode() {
  const db = await getDb()
  return db.collection('individual_participants').countDocuments({ participant_code: { $ne: null } })
}

// Cek peserta aktif (pending/paid) di SEMUA pool: individu, family, community.
export async function findActiveCrossIndividualParticipant(email: string, phone: string) {
  const db = await getDb()
  const activeStatuses: ('pending' | 'paid')[] = ['pending', 'paid']
  const match = {
    $and: [
      { $or: [{ email: { $regex: exactEmailRegex(email) } }, { phone }] },
      { payment_status: { $in: activeStatuses } },
    ],
  }

  const individualDoc = await db.collection<IndividualParticipantDoc>('individual_participants').findOne(match)
  if (individualDoc) return { type: 'individual' as const, participant: stripMongoId(individualDoc) as IndividualParticipant }

  const familyDoc = await db.collection('family_participants').findOne(match)
  if (familyDoc) return { type: 'family' as const, participant: stripMongoId(familyDoc) }

  const communityDoc = await db.collection('participants').findOne(match)
  if (communityDoc) return { type: 'community' as const, participant: stripMongoId(communityDoc) }

  return null
}

export async function listIndividualParticipantsWithIndividual() {
  const db = await getDb()
  const participants = await db.collection<IndividualParticipantDoc>('individual_participants').find({}).toArray()
  const individualIds = [...new Set(participants.map((p) => p.individual_id))]
  const individuals = await db.collection('individuals')
    .find({ id: { $in: individualIds } })
    .project({ id: 1, name: 1, leader_name: 1, email: 1, phone: 1, category: 1, individual_code: 1, provinsi: 1, kota: 1, kecamatan: 1 })
    .toArray()
  const individualMap = new Map(individuals.map((f) => [f.id as string, f]))

  return participants.map((participant) => {
    const individual = individualMap.get(participant.individual_id)
    return {
      ...docToIndividualParticipant(stripMongoId(participant) as Record<string, unknown>),
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
  })
}

export async function insertIndividualParticipants(values: Omit<IndividualParticipant, 'id' | 'created_at' | 'updated_at'>[]) {
  const db = await getDb()
  const timestamp = nowIso()
  const docs = values.map((value) => ({
    ...value,
    email: normalizeEmail(value.email),
    id: newId(),
    created_at: timestamp,
    updated_at: timestamp,
  }))

  if (docs.length === 0) return []
  await db.collection('individual_participants').insertMany(docs)
  return docs as IndividualParticipant[]
}

export async function updateIndividualParticipants(filter: Record<string, unknown>, values: Partial<IndividualParticipant>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('individual_participants').updateMany(filter, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function updateIndividualParticipantById(id: string, values: Partial<IndividualParticipant>, options?: { protectPaid?: boolean }) {
  if (options?.protectPaid) {
    const existing = await findIndividualParticipantById(id)
    if (!existing) return { error: 'Peserta tidak ditemukan.' }
    if (existing.payment_status !== 'pending') {
      return { error: 'Paid or failed participants cannot be edited by client users.' }
    }
  }

  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('individual_participants').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
  return { success: true as const }
}

export async function updateIndividualParticipantIds(ids: string[], values: Partial<IndividualParticipant>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('individual_participants').updateMany({ id: { $in: ids } }, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function linkIndividualParticipantsToRegistration(participantIds: string[], registrationId: string) {
  const db = await getDb()
  await db.collection('individual_participants').updateMany(
    { id: { $in: participantIds } },
    { $set: { registration_id: registrationId, updated_at: nowIso() } }
  )
}

export async function findPendingIndividualParticipantsWithoutRegistration(individualId: string) {
  const db = await getDb()
  const docs = await db.collection<IndividualParticipantDoc>('individual_participants')
    .find({
      individual_id: individualId,
      payment_status: 'pending',
      $or: [{ registration_id: null }, { registration_id: { $exists: false } }],
    })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToIndividualParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countUnsentIndividualRacepackWhatsapps(registrationId: string) {
  const db = await getDb()
  return db.collection('individual_participants').countDocuments({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_whatsapp_sent_at: null }, { racepack_whatsapp_sent_at: { $exists: false } }],
  })
}

export async function findPaidIndividualParticipantsForRacepackEmail(registrationId: string) {
  const db = await getDb()
  const docs = await db.collection<IndividualParticipantDoc>('individual_participants').find({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_email_sent_at: null }, { racepack_email_sent_at: { $exists: false } }],
  }).toArray()

  const individualIds = [...new Set(docs.map((doc) => doc.individual_id))]
  const individuals = await db.collection('individuals')
    .find({ id: { $in: individualIds } })
    .project({ id: 1, name: 1, individual_code: 1, email: 1 })
    .toArray()
  const individualMap = new Map(individuals.map((f) => [f.id as string, f]))

  return docs.map((doc) => {
    const individual = individualMap.get(doc.individual_id)
    return {
      ...docToIndividualParticipant(stripMongoId(doc) as Record<string, unknown>),
      individual: individual
        ? {
            name: individual.name as string,
            individual_code: individual.individual_code as string,
            email: (individual.email as string | null) ?? null,
          }
        : null,
    }
  })
}

export async function findIndividualParticipantWithIndividualById(id: string) {
  const participant = await findIndividualParticipantById(id)
  if (!participant) return null

  const db = await getDb()
  const individual = await db.collection('individuals').findOne({ id: participant.individual_id })
  if (!individual) return { ...participant, individual: null }

  return {
    ...participant,
    individual: {
      name: individual.name as string,
      individual_code: individual.individual_code as string,
    },
  }
}

export async function markIndividualParticipantCheckedIn(id: string) {
  const db = await getDb()
  const pickedUpAt = nowIso()
  await db.collection('individual_participants').updateOne(
    { id },
    { $set: { checked_in: true, checked_in_at: pickedUpAt, updated_at: pickedUpAt } }
  )
  return pickedUpAt
}
