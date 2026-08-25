import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { InvitationParticipant } from '@/lib/types'
import { docToInvitationParticipant, exactEmailRegex, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type InvitationParticipantDoc = InvitationParticipant & { _id?: unknown }

export async function findInvitationParticipantById(id: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationParticipantDoc>('invitation_participants').findOne({ id })
  return stripMongoId(doc) as InvitationParticipant | null
}

export async function findInvitationParticipantsByInvitationId(invitationId: string) {
  const db = await getDb()
  const docs = await db.collection<InvitationParticipantDoc>('invitation_participants')
    .find({ invitation_id: invitationId })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToInvitationParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function findInvitationParticipantsByRegistrationId(registrationId: string, filter?: Record<string, unknown>) {
  const db = await getDb()
  const docs = await db.collection<InvitationParticipantDoc>('invitation_participants')
    .find({ registration_id: registrationId, ...filter })
    .toArray()
  return docs.map((doc) => docToInvitationParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countInvitationParticipantsWithCode() {
  const db = await getDb()
  return db.collection('invitation_participants').countDocuments({ participant_code: { $ne: null } })
}

// Cek peserta aktif (pending/paid) di SEMUA pool: invitation, family, community.
export async function findActiveCrossInvitationParticipant(email: string, phone: string) {
  const db = await getDb()
  const activeStatuses: ('pending' | 'paid')[] = ['pending', 'paid']
  const match = {
    $and: [
      { $or: [{ email: { $regex: exactEmailRegex(email) } }, { phone }] },
      { payment_status: { $in: activeStatuses } },
    ],
  }

  const invitationDoc = await db.collection<InvitationParticipantDoc>('invitation_participants').findOne(match)
  if (invitationDoc) return { type: 'invitation' as const, participant: stripMongoId(invitationDoc) as InvitationParticipant }

  const familyDoc = await db.collection('family_participants').findOne(match)
  if (familyDoc) return { type: 'family' as const, participant: stripMongoId(familyDoc) }

  const communityDoc = await db.collection('participants').findOne(match)
  if (communityDoc) return { type: 'community' as const, participant: stripMongoId(communityDoc) }

  return null
}

export async function listInvitationParticipantsWithInvitation() {
  const db = await getDb()
  const participants = await db.collection<InvitationParticipantDoc>('invitation_participants').find({}).toArray()
  const invitationIds = [...new Set(participants.map((p) => p.invitation_id))]
  const invitations = await db.collection('invitations')
    .find({ id: { $in: invitationIds } })
    .project({ id: 1, name: 1, leader_name: 1, email: 1, phone: 1, category: 1, invitation_code: 1, community_name: 1, provinsi: 1, kota: 1, kecamatan: 1 })
    .toArray()
  const invitationMap = new Map(invitations.map((f) => [f.id as string, f]))

  return participants.map((participant) => {
    const invitation = invitationMap.get(participant.invitation_id)
    const rawParticipant = docToInvitationParticipant(stripMongoId(participant) as Record<string, unknown>)
    return {
      ...rawParticipant,
      community_name: rawParticipant.community_name || (invitation?.community_name as string | null) || null,
      invitation: invitation
        ? {
            id: invitation.id as string,
            name: invitation.name as string,
            leader_name: invitation.leader_name as string,
            email: (invitation.email as string | null) ?? null,
            phone: invitation.phone as string,
            category: (invitation.category as string | null) ?? null,
            invitation_code: invitation.invitation_code as string,
            community_name: (invitation.community_name as string | null) ?? null,
            provinsi: (invitation.provinsi as string | null) ?? null,
            kota: (invitation.kota as string | null) ?? null,
            kecamatan: (invitation.kecamatan as string | null) ?? null,
          }
        : null,
    }
  })
}

export async function insertInvitationParticipants(values: Omit<InvitationParticipant, 'id' | 'created_at' | 'updated_at'>[]) {
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
  await db.collection('invitation_participants').insertMany(docs)
  return docs as InvitationParticipant[]
}

export async function updateInvitationParticipants(filter: Record<string, unknown>, values: Partial<InvitationParticipant>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('invitation_participants').updateMany(filter, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function updateInvitationParticipantById(id: string, values: Partial<InvitationParticipant>, options?: { protectPaid?: boolean }) {
  if (options?.protectPaid) {
    const existing = await findInvitationParticipantById(id)
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
  await db.collection('invitation_participants').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
  return { success: true as const }
}

export async function updateInvitationParticipantIds(ids: string[], values: Partial<InvitationParticipant>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('invitation_participants').updateMany({ id: { $in: ids } }, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function linkInvitationParticipantsToRegistration(participantIds: string[], registrationId: string) {
  const db = await getDb()
  await db.collection('invitation_participants').updateMany(
    { id: { $in: participantIds } },
    { $set: { registration_id: registrationId, updated_at: nowIso() } }
  )
}

export async function findPendingInvitationParticipantsWithoutRegistration(invitationId: string) {
  const db = await getDb()
  const docs = await db.collection<InvitationParticipantDoc>('invitation_participants')
    .find({
      invitation_id: invitationId,
      payment_status: 'pending',
      $or: [{ registration_id: null }, { registration_id: { $exists: false } }],
    })
    .sort({ created_at: 1 })
    .toArray()
  return docs.map((doc) => docToInvitationParticipant(stripMongoId(doc) as Record<string, unknown>))
}

export async function countUnsentInvitationRacepackWhatsapps(registrationId: string) {
  const db = await getDb()
  return db.collection('invitation_participants').countDocuments({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_whatsapp_sent_at: null }, { racepack_whatsapp_sent_at: { $exists: false } }],
  })
}

export async function findPaidInvitationParticipantsForRacepackEmail(registrationId: string) {
  const db = await getDb()
  const docs = await db.collection<InvitationParticipantDoc>('invitation_participants').find({
    registration_id: registrationId,
    payment_status: 'paid',
    $or: [{ racepack_email_sent_at: null }, { racepack_email_sent_at: { $exists: false } }],
  }).toArray()

  const invitationIds = [...new Set(docs.map((doc) => doc.invitation_id))]
  const invitations = await db.collection('invitations')
    .find({ id: { $in: invitationIds } })
    .project({ id: 1, name: 1, invitation_code: 1, email: 1 })
    .toArray()
  const invitationMap = new Map(invitations.map((f) => [f.id as string, f]))

  return docs.map((doc) => {
    const invitation = invitationMap.get(doc.invitation_id)
    return {
      ...docToInvitationParticipant(stripMongoId(doc) as Record<string, unknown>),
      invitation: invitation
        ? {
            name: invitation.name as string,
            invitation_code: invitation.invitation_code as string,
            email: (invitation.email as string | null) ?? null,
          }
        : null,
    }
  })
}

export async function findInvitationParticipantWithInvitationById(id: string) {
  const participant = await findInvitationParticipantById(id)
  if (!participant) return null

  const db = await getDb()
  const invitation = await db.collection('invitations').findOne({ id: participant.invitation_id })
  if (!invitation) return { ...participant, invitation: null }

  return {
    ...participant,
    invitation: {
      name: invitation.name as string,
      invitation_code: invitation.invitation_code as string,
    },
  }
}

export async function markInvitationParticipantCheckedIn(id: string) {
  const db = await getDb()
  const pickedUpAt = nowIso()
  await db.collection('invitation_participants').updateOne(
    { id },
    { $set: { checked_in: true, checked_in_at: pickedUpAt, updated_at: pickedUpAt } }
  )
  return pickedUpAt
}
