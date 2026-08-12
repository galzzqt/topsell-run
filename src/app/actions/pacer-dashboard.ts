'use server'

import { getPacerSession } from '@/lib/auth/pacer'
import { findPacerById, findPacerParticipantByPacerId } from '@/lib/db'
import type { PacerRegistration, PacerParticipant } from '@/lib/types'

export async function getPacerSessionAction() {
  const session = await getPacerSession()
  if (!session) return { user: null }
  return { user: { id: session.id, phone: session.phone, name: session.name } }
}

export async function fetchPacerDashboardDataAction() {
  const session = await getPacerSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const [pacer, participant] = await Promise.all([
    findPacerById(session.id),
    findPacerParticipantByPacerId(session.id),
  ])

  return {
    pacer: pacer as PacerRegistration | null,
    participant: participant as PacerParticipant | null,
  }
}
