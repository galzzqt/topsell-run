import { randomBytes } from 'crypto'
import type {
  Community, Participant, Payment, Registration,
  Family, FamilyParticipant, FamilyRegistration, FamilyPayment,
  Individual, IndividualParticipant, IndividualRegistration, IndividualPayment,
  Invitation, InvitationParticipant, InvitationRegistration, InvitationPayment,
  PacerRegistration, PacerParticipant
} from '@/lib/types'

export function nowIso() {
  return new Date().toISOString()
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function exactEmailRegex(email: string) {
  const escaped = normalizeEmail(email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped}$`, 'i')
}

export function newId() {
  return crypto.randomUUID()
}

export function generateCommunityCode() {
  return `COMM-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function generateFamilyCode() {
  return `FAM-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function generateIndividualCode() {
  return `IND-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function generateInvitationCode() {
  return `INV-${randomBytes(3).toString('hex').toUpperCase()}`
}

export function generatePacerCode() {
  return `PCR-${randomBytes(3).toString('hex').toUpperCase()}`
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

export function docToFamily(doc: Record<string, unknown>): Family {
  return doc as unknown as Family
}

export function docToFamilyParticipant(doc: Record<string, unknown>): FamilyParticipant {
  return doc as unknown as FamilyParticipant
}

export function docToFamilyRegistration(doc: Record<string, unknown>): FamilyRegistration {
  return doc as unknown as FamilyRegistration
}

export function docToFamilyPayment(doc: Record<string, unknown>): FamilyPayment {
  return doc as unknown as FamilyPayment
}

export function docToIndividual(doc: Record<string, unknown>): Individual {
  return doc as unknown as Individual
}

export function docToInvitation(doc: Record<string, unknown>): Invitation {
  return doc as unknown as Invitation
}

export function docToIndividualParticipant(doc: Record<string, unknown>): IndividualParticipant {
  return doc as unknown as IndividualParticipant
}

export function docToInvitationParticipant(doc: Record<string, unknown>): InvitationParticipant {
  return doc as unknown as InvitationParticipant
}

export function docToIndividualRegistration(doc: Record<string, unknown>): IndividualRegistration {
  return doc as unknown as IndividualRegistration
}

export function docToInvitationRegistration(doc: Record<string, unknown>): InvitationRegistration {
  return doc as unknown as InvitationRegistration
}

export function docToIndividualPayment(doc: Record<string, unknown>): IndividualPayment {
  return doc as unknown as IndividualPayment
}

export function docToInvitationPayment(doc: Record<string, unknown>): InvitationPayment {
  return doc as unknown as InvitationPayment
}

export function docToPacer(doc: Record<string, unknown>): PacerRegistration {
  return doc as unknown as PacerRegistration
}

export function docToPacerParticipant(doc: Record<string, unknown>): PacerParticipant {
  return doc as unknown as PacerParticipant
}

export function stripMongoId<T extends Record<string, unknown>>(doc: T | null) {
  if (!doc) return null
  const { _id, ...rest } = doc
  void _id
  return rest
}
