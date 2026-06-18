'use server'

import { getFamilySession } from '@/lib/auth/family'
import {
  findFamilyById,
  findFamilyPaymentsByRegistrationIds,
  findFamilyParticipantsByFamilyId,
  findFamilyRegistrationsByFamilyId,
} from '@/lib/db'
import type { Family, FamilyParticipant, FamilyPayment, FamilyRegistration } from '@/lib/types'

export async function getFamilySessionAction() {
  const session = await getFamilySession()
  if (!session) return { user: null }

  return {
    user: {
      id: session.id,
      phone: session.phone,
      name: session.name,
    },
  }
}

export async function fetchFamilyDashboardDataAction() {
  const session = await getFamilySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const [family, participants, registrations] = await Promise.all([
    findFamilyById(session.id),
    findFamilyParticipantsByFamilyId(session.id),
    findFamilyRegistrationsByFamilyId(session.id),
  ])

  let payments: FamilyPayment[] = []
  if (registrations.length > 0) {
    payments = await findFamilyPaymentsByRegistrationIds(registrations.map((registration) => registration.id))
  }

  return {
    family: family as Family | null,
    participants: participants as FamilyParticipant[],
    registrations: registrations as FamilyRegistration[],
    payments,
  }
}
