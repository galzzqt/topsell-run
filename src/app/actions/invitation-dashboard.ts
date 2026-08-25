'use server'

import { getInvitationSession } from '@/lib/auth/invitation'
import {
  findInvitationById,
  findInvitationPaymentsByRegistrationIds,
  findInvitationParticipantsByInvitationId,
  findInvitationRegistrationsByInvitationId,
} from '@/lib/db'
import type { Invitation, InvitationParticipant, InvitationPayment, InvitationRegistration } from '@/lib/types'

export async function getInvitationSessionAction() {
  const session = await getInvitationSession()
  if (!session) return { user: null }
  return { user: { id: session.id, phone: session.phone, name: session.name } }
}

export async function fetchInvitationDashboardDataAction() {
  const session = await getInvitationSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const [invitation, participants, registrations] = await Promise.all([
    findInvitationById(session.id),
    findInvitationParticipantsByInvitationId(session.id),
    findInvitationRegistrationsByInvitationId(session.id),
  ])

  let payments: InvitationPayment[] = []
  if (registrations.length > 0) {
    payments = await findInvitationPaymentsByRegistrationIds(registrations.map((r) => r.id))
  }

  return {
    invitation: invitation as Invitation | null,
    participants: participants as InvitationParticipant[],
    registrations: registrations as InvitationRegistration[],
    payments,
  }
}
