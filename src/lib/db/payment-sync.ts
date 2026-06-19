import 'server-only'

import {
  countParticipantsWithCode,
  findParticipantsByRegistrationId,
  updateParticipantById,
  updateParticipants,
} from './participants'
import { updateRegistration } from './registrations'
import { findPaymentById, updatePayment } from './payments'
import type { Payment } from '@/lib/types'

async function activatePaidParticipants(registrationId: string) {
  await updateRegistration(registrationId, { status: 'paid' })

  const participants = await findParticipantsByRegistrationId(registrationId)
  let sequence = await countParticipantsWithCode()

  for (const participant of participants) {
    if (participant.payment_status === 'paid' && participant.participant_code) {
      continue
    }

    sequence += 1
    const participantCode = `TSR-6K-${sequence}`
    const qrPayload = `TSR_PARTICIPANT:${participant.id}|BIB:${participantCode}|NAME:${participant.bib_name || participant.full_name}`

    await updateParticipantById(participant.id, {
      payment_status: 'paid',
      participant_code: participantCode,
      qr_code_data: qrPayload,
    })
  }
}

async function failRegistrationParticipants(registrationId: string) {
  await updateRegistration(registrationId, { status: 'failed' })
  await updateParticipants({ registration_id: registrationId }, { payment_status: 'failed' })
}

export async function markPaymentPaid(paymentId: string, values: Partial<Payment>) {
  const payment = await findPaymentById(paymentId)
  if (!payment) return null
  if (payment.status === 'paid') return payment

  await updatePayment(paymentId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  await activatePaidParticipants(payment.registration_id)
  return findPaymentById(paymentId)
}

export async function markPaymentFailed(paymentId: string) {
  const payment = await findPaymentById(paymentId)
  if (!payment || payment.status === 'failed') return payment

  await updatePayment(paymentId, { status: 'failed' })
  await failRegistrationParticipants(payment.registration_id)
  return findPaymentById(paymentId)
}

async function expireRegistrationParticipants(registrationId: string) {
  await updateRegistration(registrationId, { status: 'expired' })
  await updateParticipants({ registration_id: registrationId }, { payment_status: 'expired' })
}

export async function markPaymentExpired(paymentId: string) {
  const payment = await findPaymentById(paymentId)
  if (!payment || payment.status === 'expired') return payment

  await updatePayment(paymentId, { status: 'expired' })
  await expireRegistrationParticipants(payment.registration_id)
  return findPaymentById(paymentId)
}

export async function markPaymentsPaidBySessionId(sessionId: string, values: Partial<Payment>) {
  const { updatePaymentsBySessionId } = await import('./payments')
  const payments = await updatePaymentsBySessionId(sessionId, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  for (const payment of payments) {
    await activatePaidParticipants(payment.registration_id)
  }

  return payments
}

export async function markPaymentsPaidByReference(reference: string, values: Partial<Payment>) {
  const { updatePaymentsByReference } = await import('./payments')
  const payments = await updatePaymentsByReference(reference, {
    ...values,
    status: 'paid',
    paid_at: values.paid_at || new Date().toISOString(),
  })

  for (const payment of payments) {
    await activatePaidParticipants(payment.registration_id)
  }

  return payments
}
