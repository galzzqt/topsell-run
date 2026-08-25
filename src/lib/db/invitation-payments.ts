import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { InvitationPayment } from '@/lib/types'
import { docToInvitationPayment, newId, nowIso, stripMongoId } from './utils'

type InvitationPaymentDoc = InvitationPayment & { _id?: unknown }

export async function findInvitationPaymentById(id: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationPaymentDoc>('invitation_payments').findOne({ id })
  return stripMongoId(doc) as InvitationPayment | null
}

export async function findInvitationPaymentByReference(reference: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationPaymentDoc>('invitation_payments').findOne({ payment_reference: reference })
  return stripMongoId(doc) as InvitationPayment | null
}

export async function findInvitationPaymentsByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return []
  const db = await getDb()
  const docs = await db.collection<InvitationPaymentDoc>('invitation_payments')
    .find({ registration_id: { $in: registrationIds } })
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToInvitationPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function findPendingInvitationPaymentByRegistrationIds(registrationIds: string[]) {
  if (registrationIds.length === 0) return null
  const db = await getDb()
  const doc = await db.collection<InvitationPaymentDoc>('invitation_payments')
    .find({ registration_id: { $in: registrationIds }, status: 'pending' })
    .sort({ created_at: -1 })
    .limit(1)
    .next()
  return stripMongoId(doc) as InvitationPayment | null
}

export async function createInvitationPayment(input: {
  registration_id: string
  amount: number
  payment_reference: string
  status?: InvitationPayment['status']
  period_key?: string | null
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const payment: InvitationPayment = {
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

  await db.collection('invitation_payments').insertOne({ ...payment })
  return payment
}

export async function updateInvitationPayment(id: string, values: Partial<InvitationPayment>) {
  const db = await getDb()
  await db.collection('invitation_payments').updateOne({ id }, { $set: { ...values, updated_at: nowIso() } })
}

export async function updateInvitationPaymentsBySessionId(sessionId: string, values: Partial<InvitationPayment>) {
  const db = await getDb()
  const result = await db.collection<InvitationPaymentDoc>('invitation_payments').find({ xendit_session_id: sessionId }).toArray()
  if (result.length === 0) return []
  await db.collection('invitation_payments').updateMany({ xendit_session_id: sessionId }, { $set: { ...values, updated_at: nowIso() } })
  return result.map((doc) => docToInvitationPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function updateInvitationPaymentsByReference(reference: string, values: Partial<InvitationPayment>) {
  const db = await getDb()
  const result = await db.collection<InvitationPaymentDoc>('invitation_payments').find({ payment_reference: reference }).toArray()
  if (result.length === 0) return []
  await db.collection('invitation_payments').updateMany({ payment_reference: reference }, { $set: { ...values, updated_at: nowIso() } })
  return result.map((doc) => docToInvitationPayment(stripMongoId(doc) as Record<string, unknown>))
}

export async function listInvitationPaymentsWithRelations() {
  const db = await getDb()
  const payments = await db.collection<InvitationPaymentDoc>('invitation_payments').find({}).sort({ created_at: -1 }).toArray()
  const registrationIds = [...new Set(payments.map((p) => p.registration_id))]
  const registrations = await db.collection('invitation_registrations').find({ id: { $in: registrationIds } }).toArray()
  const invitationIds = [...new Set(registrations.map((r) => r.invitation_id as string))]
  const invitations = await db.collection('invitations').find({ id: { $in: invitationIds } }).toArray()

  const registrationMap = new Map(registrations.map((r) => [r.id as string, r]))
  const invitationMap = new Map(invitations.map((f) => [f.id as string, f]))

  return payments.map((payment) => {
    const registration = registrationMap.get(payment.registration_id)
    const invitation = registration ? invitationMap.get(registration.invitation_id as string) : null
    return {
      ...docToInvitationPayment(stripMongoId(payment) as Record<string, unknown>),
      registration: registration
        ? {
            invitation_id: registration.invitation_id as string,
            total_participants: Number(registration.total_participants) || 0,
            invitation: invitation
              ? {
                  id: invitation.id as string,
                  name: invitation.name as string,
                  leader_name: invitation.leader_name as string,
                  email: (invitation.email as string | null) ?? null,
                  phone: invitation.phone as string,
                  category: (invitation.category as string | null) ?? null,
                  invitation_code: invitation.invitation_code as string,
                  provinsi: (invitation.provinsi as string | null) ?? null,
                  kota: (invitation.kota as string | null) ?? null,
                  kecamatan: (invitation.kecamatan as string | null) ?? null,
                }
              : null,
          }
        : null,
    }
  })
}

export async function findInvitationPaymentWithRegistration(id: string) {
  const payment = await findInvitationPaymentById(id)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('invitation_registrations').findOne({ id: payment.registration_id })
  return { ...payment, registration: registration ? { invitation_id: registration.invitation_id as string } : null }
}

export async function findInvitationPaymentWithRegistrationByReference(reference: string) {
  const payment = await findInvitationPaymentByReference(reference)
  if (!payment) return null
  const db = await getDb()
  const registration = await db.collection('invitation_registrations').findOne({ id: payment.registration_id })
  return { ...payment, registration: registration ? { invitation_id: registration.invitation_id as string } : null }
}
