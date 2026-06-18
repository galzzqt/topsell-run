import { randomBytes } from 'crypto'
import type { Community, Participant, Payment, Registration } from '@/lib/types'

export function nowIso() {
  return new Date().toISOString()
}

export function newId() {
  return crypto.randomUUID()
}

export function generateCommunityCode() {
  return `COMM-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function docToCommunity(doc: Record<string, unknown>): Community {
  return doc as unknown as Community
}

export function docToParticipant(doc: Record<string, unknown>): Participant {
  return doc as unknown as Participant
}

export function docToRegistration(doc: Record<string, unknown>): Registration {
  return doc as unknown as Registration
}

export function docToPayment(doc: Record<string, unknown>): Payment {
  return doc as unknown as Payment
}

export function stripMongoId<T extends Record<string, unknown>>(doc: T | null) {
  if (!doc) return null
  const { _id, ...rest } = doc
  void _id
  return rest
}
