'use server'

import { getIndividualSession } from '@/lib/auth/individual'
import {
  findIndividualById,
  findIndividualPaymentsByRegistrationIds,
  findIndividualParticipantsByIndividualId,
  findIndividualRegistrationsByIndividualId,
} from '@/lib/db'
import type { Individual, IndividualParticipant, IndividualPayment, IndividualRegistration } from '@/lib/types'

export async function getIndividualSessionAction() {
  const session = await getIndividualSession()
  if (!session) return { user: null }
  return { user: { id: session.id, phone: session.phone, name: session.name } }
}

export async function fetchIndividualDashboardDataAction() {
  const session = await getIndividualSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const [individual, participants, registrations] = await Promise.all([
    findIndividualById(session.id),
    findIndividualParticipantsByIndividualId(session.id),
    findIndividualRegistrationsByIndividualId(session.id),
  ])

  let payments: IndividualPayment[] = []
  if (registrations.length > 0) {
    payments = await findIndividualPaymentsByRegistrationIds(registrations.map((r) => r.id))
  }

  return {
    individual: individual as Individual | null,
    participants: participants as IndividualParticipant[],
    registrations: registrations as IndividualRegistration[],
    payments,
  }
}
