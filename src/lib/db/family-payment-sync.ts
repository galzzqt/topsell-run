import 'server-only'

import {
  countFamilyParticipantsWithCode,
  findFamilyParticipantsByRegistrationId,
  updateFamilyParticipantById,
  updateFamilyParticipants,
} from './family-participants'
import { updateFamilyRegistration } from './family-registrations'
import { findFamilyPaymentById, updateFamilyPayment } from './family-payments'
import type { FamilyPayment } from '@/lib/types'

async function activatePaidFamilyParticipants(registrationId: string) {
  await updateFamilyRegistration(registrationId, { status: 'paid' })

  const participants = await findFamilyParticipantsByRegistrationId(registrationId)
  let sequence = await countFamilyParticipantsWithCode()

  for (const participant of participants) {
    if (participant.payment_status === 'paid' && participant.participant_code) {
      continue
    }

    sequence += 1
    const participantCode = `TSR-FAM-${sequence}`
    const qrPayload = `TSR_PARTICIPANT:${participant.id}|BIB:${participantCode}|NAME:${participant.bib_name || participant.full_name}`

    await updateFamilyParticipantById(participant.id, {
      payment_status: 'paid',
      participant_code: participantCode,
      qr_code_data: qrPayload,
    })
  }
}

async function failFamilyRegistrationParticipants(registrationId: string) {
  await updateFamilyRegistration(registrationId, { status: 'failed' })
  await updateFamilyParticipants({ registration_id: registrationId }, { payment_status: 'failed' })
}

export async function markFamilyPaymentPaid(paymentId: string, values: Partial<FamilyPayment>) {
  const payment = await findFamilyPaymentById(paymentId)
  if (!payment) return null
  if (payment.status === 'paid') return payment

  await updateFamilyPayment(paymentId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  await activatePaidFamilyParticipants(payment.registration_id)
  return findFamilyPaymentById(paymentId)
}

export async function markFamilyPaymentFailed(paymentId: string) {
  const payment = await findFamilyPaymentById(paymentId)
  if (!payment || payment.status === 'failed') return payment

  await updateFamilyPayment(paymentId, { status: 'failed' })
  await failFamilyRegistrationParticipants(payment.registration_id)
  return findFamilyPaymentById(paymentId)
}

async function expireFamilyRegistrationParticipants(registrationId: string) {
  await updateFamilyRegistration(registrationId, { status: 'expired' })
  await updateFamilyParticipants({ registration_id: registrationId }, { payment_status: 'expired' })
}

export async function markFamilyPaymentExpired(paymentId: string) {
  const payment = await findFamilyPaymentById(paymentId)
  if (!payment || payment.status === 'expired') return payment

  await updateFamilyPayment(paymentId, { status: 'expired' })
  await expireFamilyRegistrationParticipants(payment.registration_id)
  return findFamilyPaymentById(paymentId)
}

export async function markFamilyPaymentsPaidBySessionId(sessionId: string, values: Partial<FamilyPayment>) {
  const { updateFamilyPaymentsBySessionId } = await import('./family-payments')
  const payments = await updateFamilyPaymentsBySessionId(sessionId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  for (const payment of payments) {
    await activatePaidFamilyParticipants(payment.registration_id)
  }

  return payments
}

export async function markFamilyPaymentsPaidByReference(reference: string, values: Partial<FamilyPayment>) {
  const { updateFamilyPaymentsByReference } = await import('./family-payments')
  const payments = await updateFamilyPaymentsByReference(reference, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  for (const payment of payments) {
    await activatePaidFamilyParticipants(payment.registration_id)
  }

  return payments
}
