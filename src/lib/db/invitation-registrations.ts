import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { InvitationRegistration } from '@/lib/types'
import { docToInvitationRegistration, newId, nowIso, stripMongoId } from './utils'

type InvitationRegistrationDoc = InvitationRegistration & { _id?: unknown }

export async function findInvitationRegistrationById(id: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationRegistrationDoc>('invitation_registrations').findOne({ id })
  return stripMongoId(doc) as InvitationRegistration | null
}

export async function findInvitationRegistrationsByInvitationId(invitationId: string) {
  const db = await getDb()
  const docs = await db.collection<InvitationRegistrationDoc>('invitation_registrations')
    .find({ invitation_id: invitationId })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToInvitationRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingInvitationRegistrationsByInvitationId(invitationId: string) {
  const db = await getDb()
  const docs = await db.collection<InvitationRegistrationDoc>('invitation_registrations')
    .find({ invitation_id: invitationId, status: 'pending' })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToInvitationRegistration(stripMongoId(doc) as Record<string, unknown>))
}

export async function createInvitationRegistration(input: {
  invitation_id: string
  total_participants: number
  total_amount: number
  status?: InvitationRegistration['status']
  voucher_code?: string | null
  voucher_discount?: number
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const registration: InvitationRegistration = {
    id,
    invitation_id: input.invitation_id,
    total_participants: input.total_participants,
    total_amount: input.total_amount,
    voucher_code: input.voucher_code ?? null,
    voucher_discount: input.voucher_discount ?? 0,
    status: input.status || 'pending',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('invitation_registrations').insertOne({ ...registration })
  return registration
}

export async function updateInvitationRegistration(id: string, values: Partial<InvitationRegistration>) {
  const db = await getDb()
  await db.collection('invitation_registrations').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
}

export async function deleteInvitationRegistration(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('invitation_registrations').deleteOne({ id }),
    db.collection('invitation_payments').deleteMany({ registration_id: id }),
    db.collection('invitation_participants').updateMany(
      { registration_id: id },
      { $set: { registration_id: null, updated_at: nowIso() } }
    ),
  ])
}

export async function findPaidInvitationRegistrationWithInvitation(registrationId: string) {
  const db = await getDb()
  const registration = await db.collection<InvitationRegistrationDoc>('invitation_registrations').findOne({
    id: registrationId,
    status: 'paid',
  })
  if (!registration) return null

  const invitation = await db.collection('invitations').findOne({ id: registration.invitation_id })
  return {
    ...docToInvitationRegistration(stripMongoId(registration) as Record<string, unknown>),
    invitation: invitation
      ? {
          id: invitation.id as string,
          name: invitation.name as string,
          leader_name: invitation.leader_name as string,
          email: (invitation.email as string | null) ?? null,
          phone: invitation.phone as string,
          invitation_code: invitation.invitation_code as string,
        }
      : null,
  }
}
