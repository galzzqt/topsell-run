import 'server-only'

import {
  countIndividualParticipantsWithCode,
  findIndividualParticipantsByRegistrationId,
  updateIndividualParticipantById,
  updateIndividualParticipants,
} from './individual-participants'
import { updateIndividualRegistration } from './individual-registrations'
import { findIndividualPaymentById, updateIndividualPayment } from './individual-payments'
import type { IndividualPayment } from '@/lib/types'

async function activatePaidIndividualParticipants(registrationId: string) {
  await updateIndividualRegistration(registrationId, { status: 'paid' })

  const participants = await findIndividualParticipantsByRegistrationId(registrationId)
  let sequence = await countIndividualParticipantsWithCode()

  for (const participant of participants) {
    if (participant.payment_status === 'paid' && participant.participant_code) continue

    sequence += 1
    const participantCode = `TSR-IND-${sequence}`
    const qrPayload = `TSR_PARTICIPANT:${participant.id}|BIB:${participantCode}|NAME:${participant.bib_name || participant.full_name}`

    await updateIndividualParticipantById(participant.id, {
      payment_status: 'paid',
      participant_code: participantCode,
      qr_code_data: qrPayload,
    })
  }
}

async function failIndividualRegistrationParticipants(registrationId: string) {
  await updateIndividualRegistration(registrationId, { status: 'failed' })
  await updateIndividualParticipants({ registration_id: registrationId }, { payment_status: 'failed' })
}

async function expireIndividualRegistrationParticipants(registrationId: string) {
  await updateIndividualRegistration(registrationId, { status: 'expired' })
  await updateIndividualParticipants({ registration_id: registrationId }, { payment_status: 'expired' })
}

export async function markIndividualPaymentPaid(paymentId: string, values: Partial<IndividualPayment>) {
  const payment = await findIndividualPaymentById(paymentId)
  if (!payment) return null
  if (payment.status === 'paid') return payment

  await updateIndividualPayment(paymentId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  await activatePaidIndividualParticipants(payment.registration_id)
  return findIndividualPaymentById(paymentId)
}

export async function markIndividualPaymentFailed(paymentId: string) {
  const payment = await findIndividualPaymentById(paymentId)
  if (!payment || payment.status === 'failed') return payment
  await updateIndividualPayment(paymentId, { status: 'failed' })
  await failIndividualRegistrationParticipants(payment.registration_id)
  return findIndividualPaymentById(paymentId)
}

export async function markIndividualPaymentExpired(paymentId: string) {
  const payment = await findIndividualPaymentById(paymentId)
  if (!payment || payment.status === 'expired') return payment
  await updateIndividualPayment(paymentId, { status: 'expired' })
  await expireIndividualRegistrationParticipants(payment.registration_id)
  return findIndividualPaymentById(paymentId)
}

async function testingIndividualRegistrationParticipants(registrationId: string) {
  await updateIndividualRegistration(registrationId, { status: 'testing' })
  await updateIndividualParticipants({ registration_id: registrationId }, { payment_status: 'testing' })
}

export async function markIndividualPaymentTesting(paymentId: string) {
  const payment = await findIndividualPaymentById(paymentId)
  if (!payment) return null
  await updateIndividualPayment(paymentId, { status: 'testing' })
  await testingIndividualRegistrationParticipants(payment.registration_id)
  return findIndividualPaymentById(paymentId)
}

export async function markIndividualPaymentsPaidBySessionId(sessionId: string, values: Partial<IndividualPayment>) {
  const { updateIndividualPaymentsBySessionId } = await import('./individual-payments')
  const payments = await updateIndividualPaymentsBySessionId(sessionId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })
  for (const payment of payments) await activatePaidIndividualParticipants(payment.registration_id)
  return payments
}

export async function markIndividualPaymentsPaidByReference(reference: string, values: Partial<IndividualPayment>) {
  const { updateIndividualPaymentsByReference } = await import('./individual-payments')
  const payments = await updateIndividualPaymentsByReference(reference, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })
  for (const payment of payments) await activatePaidIndividualParticipants(payment.registration_id)
  return payments
}
