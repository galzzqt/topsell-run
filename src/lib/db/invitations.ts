import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Invitation } from '@/lib/types'
import type { PasswordRecord } from '@/lib/auth/password'
import { docToInvitation, exactEmailRegex, generateInvitationCode, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type InvitationDoc = Invitation & { _id?: unknown }

export async function findInvitationById(id: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationDoc>('invitations').findOne({ id })
  return stripMongoId(doc) as Invitation | null
}

export async function findInvitationByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationDoc>('invitations').findOne({ phone })
  return stripMongoId(doc) as Invitation | null
}

export async function findInvitationByEmail(email: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationDoc>('invitations').findOne({ email: { $regex: exactEmailRegex(email) } })
  return stripMongoId(doc) as Invitation | null
}

export async function findInvitationByPhoneExcept(phone: string, excludeId: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationDoc>('invitations').findOne({ phone, id: { $ne: excludeId } })
  return stripMongoId(doc) as Invitation | null
}

export async function listInvitations() {
  const db = await getDb()
  const docs = await db.collection<InvitationDoc>('invitations').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => docToInvitation(stripMongoId(doc) as Record<string, unknown>))
}

export async function createUniqueInvitationCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateInvitationCode()
    const existing = await db.collection('invitations').findOne({ invitation_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode peserta unik.')
}

export async function createInvitation(input: {
  name: string
  leader_name: string
  email: string | null
  phone: string
  category: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  community_name?: string | null
  voucher_code?: string | null
  voucher_discount?: number
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const invitation: Invitation = {
    id,
    name: input.name,
    leader_name: input.leader_name,
    email: input.email ? normalizeEmail(input.email) : null,
    phone: input.phone,
    category: input.category,
    invitation_code: await createUniqueInvitationCode(),
    community_name: input.community_name ?? null,
    provinsi: input.provinsi,
    kota: input.kota,
    kecamatan: input.kecamatan,
    email_verified: false,
    verification_token: null,
    verification_token_expires: null,
    verification_sent_at: null,
    voucher_code: input.voucher_code ?? null,
    voucher_discount: input.voucher_discount ?? 0,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('invitations').insertOne({ ...invitation })
  return invitation
}

export async function updateInvitation(id: string, values: Partial<Invitation>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('invitations').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function deleteInvitation(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('invitations').deleteOne({ id }),
    db.collection('invitation_auth').deleteOne({ id }),
    db.collection('invitation_participants').deleteMany({ invitation_id: id }),
    db.collection('invitation_registrations').deleteMany({ invitation_id: id }),
  ])
}

export async function saveInvitationAuth(id: string, phone: string, password: PasswordRecord) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('invitation_auth').updateOne(
    { id },
    {
      $set: { id, phone, ...password, updated_at: timestamp },
      $setOnInsert: { created_at: timestamp },
    },
    { upsert: true }
  )
}

export async function findInvitationAuthByPhone(phone: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('invitation_auth').findOne({ phone })
}

export async function findInvitationAuthById(id: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('invitation_auth').findOne({ id })
}

export async function updateInvitationAuthPhone(id: string, phone: string) {
  const db = await getDb()
  await db.collection('invitation_auth').updateOne({ id }, { $set: { phone, updated_at: nowIso() } })
}

export async function updateInvitationAuthPassword(id: string, password: PasswordRecord) {
  const db = await getDb()
  await db.collection('invitation_auth').updateOne({ id }, { $set: { ...password, updated_at: nowIso() } })
}

export async function setInvitationVerificationToken(invitationId: string, token: string, expiresAt: Date) {
  const db = await getDb()
  await db.collection('invitations').updateOne(
    { id: invitationId },
    {
      $set: {
        verification_token: token,
        verification_token_expires: expiresAt.toISOString(),
        verification_sent_at: nowIso(),
        updated_at: nowIso(),
      },
    }
  )
}

export async function findInvitationByVerificationToken(token: string) {
  const db = await getDb()
  const doc = await db.collection<InvitationDoc>('invitations').findOne({ verification_token: token })
  return stripMongoId(doc) as Invitation | null
}

export async function verifyInvitationEmail(invitationId: string) {
  const db = await getDb()
  await db.collection('invitations').updateOne(
    { id: invitationId },
    {
      $set: {
        email_verified: true,
        verification_token: null,
        verification_token_expires: null,
        updated_at: nowIso(),
      },
    }
  )
}
