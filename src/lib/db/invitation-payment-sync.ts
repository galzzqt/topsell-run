import 'server-only'

import {
  countInvitationParticipantsWithCode,
  findInvitationParticipantsByRegistrationId,
  updateInvitationParticipantById,
  updateInvitationParticipants,
} from './invitation-participants'
import { updateInvitationRegistration } from './invitation-registrations'
import { findInvitationPaymentById, updateInvitationPayment } from './invitation-payments'
import type { InvitationPayment } from '@/lib/types'

async function activatePaidInvitationParticipants(registrationId: string) {
  await updateInvitationRegistration(registrationId, { status: 'paid' })

  const participants = await findInvitationParticipantsByRegistrationId(registrationId)
  let sequence = await countInvitationParticipantsWithCode()

  for (const participant of participants) {
    if (participant.payment_status === 'paid' && participant.participant_code) continue

    sequence += 1
    const participantCode = `TSR-INV-${sequence}`
    const qrPayload = `TSR_PARTICIPANT:${participant.id}|BIB:${participantCode}|NAME:${participant.bib_name || participant.full_name}`

    await updateInvitationParticipantById(participant.id, {
      payment_status: 'paid',
      participant_code: participantCode,
      qr_code_data: qrPayload,
    })
  }
}

async function failInvitationRegistrationParticipants(registrationId: string) {
  await updateInvitationRegistration(registrationId, { status: 'failed' })
  await updateInvitationParticipants({ registration_id: registrationId }, { payment_status: 'failed' })
}

async function expireInvitationRegistrationParticipants(registrationId: string) {
  await updateInvitationRegistration(registrationId, { status: 'expired' })
  await updateInvitationParticipants({ registration_id: registrationId }, { payment_status: 'expired' })
}

export async function markInvitationPaymentPaid(paymentId: string, values: Partial<InvitationPayment>) {
  const payment = await findInvitationPaymentById(paymentId)
  if (!payment) return null
  if (payment.status === 'paid') return payment

  await updateInvitationPayment(paymentId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  await activatePaidInvitationParticipants(payment.registration_id)
  return findInvitationPaymentById(paymentId)
}

export async function markInvitationPaymentFailed(paymentId: string) {
  const payment = await findInvitationPaymentById(paymentId)
  if (!payment || payment.status === 'failed') return payment
  await updateInvitationPayment(paymentId, { status: 'failed' })
  await failInvitationRegistrationParticipants(payment.registration_id)
  return findInvitationPaymentById(paymentId)
}

export async function markInvitationPaymentExpired(paymentId: string) {
  const payment = await findInvitationPaymentById(paymentId)
  if (!payment || payment.status === 'expired') return payment
  await updateInvitationPayment(paymentId, { status: 'expired' })
  await expireInvitationRegistrationParticipants(payment.registration_id)
  return findInvitationPaymentById(paymentId)
}

async function testingInvitationRegistrationParticipants(registrationId: string) {
  await updateInvitationRegistration(registrationId, { status: 'testing' })
  await updateInvitationParticipants({ registration_id: registrationId }, { payment_status: 'testing' })
}

export async function markInvitationPaymentTesting(paymentId: string) {
  const payment = await findInvitationPaymentById(paymentId)
  if (!payment) return null
  await updateInvitationPayment(paymentId, { status: 'testing' })
  await testingInvitationRegistrationParticipants(payment.registration_id)
  return findInvitationPaymentById(paymentId)
}

export async function markInvitationPaymentsPaidBySessionId(sessionId: string, values: Partial<InvitationPayment>) {
  const { updateInvitationPaymentsBySessionId } = await import('./invitation-payments')
  const payments = await updateInvitationPaymentsBySessionId(sessionId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })
  for (const payment of payments) await activatePaidInvitationParticipants(payment.registration_id)
  return payments
}

export async function markInvitationPaymentsPaidByReference(reference: string, values: Partial<InvitationPayment>) {
  const { updateInvitationPaymentsByReference } = await import('./invitation-payments')
  const payments = await updateInvitationPaymentsByReference(reference, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })
  for (const payment of payments) await activatePaidInvitationParticipants(payment.registration_id)
  return payments
}
