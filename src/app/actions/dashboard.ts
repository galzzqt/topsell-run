'use server'

import { getCommunitySession } from '@/lib/auth/community'
import {
  findCommunityById,
  findPaymentsByRegistrationIds,
  findParticipantsByCommunityId,
  findRegistrationsByCommunityId,
} from '@/lib/db'
import type { Community, Participant, Payment, Registration } from '@/lib/types'

export async function getCommunitySessionAction() {
  const session = await getCommunitySession()
  if (!session) return { user: null }

  return {
    user: {
      id: session.id,
      phone: session.phone,
      name: session.name,
    },
  }
}

export async function fetchCommunityDashboardDataAction() {
  const session = await getCommunitySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const [community, participants, registrations] = await Promise.all([
    findCommunityById(session.id),
    findParticipantsByCommunityId(session.id),
    findRegistrationsByCommunityId(session.id),
  ])

  let payments: Payment[] = []
  if (registrations.length > 0) {
    payments = await findPaymentsByRegistrationIds(registrations.map((registration) => registration.id))
  }

  return {
    community: community as Community | null,
    participants: participants as Participant[],
    registrations: registrations as Registration[],
    payments,
  }
}
