import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { PacerRegistration } from '@/lib/types'
import type { PasswordRecord } from '@/lib/auth/password'
import { docToPacer, exactEmailRegex, generatePacerCode, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type PacerDoc = PacerRegistration & { _id?: unknown }

export async function findPacerById(id: string) {
  const db = await getDb()
  const doc = await db.collection<PacerDoc>('pacer_registrations').findOne({ id })
  return stripMongoId(doc) as PacerRegistration | null
}

export async function findPacerByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<PacerDoc>('pacer_registrations').findOne({ phone })
  return stripMongoId(doc) as PacerRegistration | null
}

export async function findPacerByEmail(email: string) {
  const db = await getDb()
  const doc = await db.collection<PacerDoc>('pacer_registrations').findOne({ email: { $regex: exactEmailRegex(email) } })
  return stripMongoId(doc) as PacerRegistration | null
}

export async function findPacerByPhoneExcept(phone: string, excludeId: string) {
  const db = await getDb()
  const doc = await db.collection<PacerDoc>('pacer_registrations').findOne({ phone, id: { $ne: excludeId } })
  return stripMongoId(doc) as PacerRegistration | null
}

export async function listPacers() {
  const db = await getDb()
  const docs = await db.collection<PacerDoc>('pacer_registrations').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => docToPacer(stripMongoId(doc) as Record<string, unknown>))
}

export async function createUniquePacerCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generatePacerCode()
    const existing = await db.collection('pacer_registrations').findOne({ pacer_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode pacer unik.')
}

export async function createPacer(input: {
  name: string
  email: string
  phone: string
  category: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const pacer: PacerRegistration = {
    id,
    name: input.name,
    email: normalizeEmail(input.email),
    phone: input.phone,
    category: input.category,
    pacer_code: await createUniquePacerCode(),
    provinsi: input.provinsi,
    kota: input.kota,
    kecamatan: input.kecamatan,
    status: 'pending',
    status_note: null,
    reviewed_at: null,
    email_verified: false,
    verification_token: null,
    verification_token_expires: null,
    verification_sent_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('pacer_registrations').insertOne({ ...pacer })
  return pacer
}

export async function updatePacer(id: string, values: Partial<PacerRegistration>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('pacer_registrations').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function deletePacer(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('pacer_registrations').deleteOne({ id }),
    db.collection('pacer_auth').deleteOne({ id }),
    db.collection('pacer_participants').deleteMany({ pacer_id: id }),
  ])
}

export async function savePacerAuth(id: string, phone: string, password: PasswordRecord) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('pacer_auth').updateOne(
    { id },
    {
      $set: { id, phone, ...password, updated_at: timestamp },
      $setOnInsert: { created_at: timestamp },
    },
    { upsert: true }
  )
}

export async function findPacerAuthByPhone(phone: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('pacer_auth').findOne({ phone })
}

export async function findPacerAuthById(id: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('pacer_auth').findOne({ id })
}

export async function updatePacerAuthPhone(id: string, phone: string) {
  const db = await getDb()
  await db.collection('pacer_auth').updateOne({ id }, { $set: { phone, updated_at: nowIso() } })
}

export async function updatePacerAuthPassword(id: string, password: PasswordRecord) {
  const db = await getDb()
  await db.collection('pacer_auth').updateOne({ id }, { $set: { ...password, updated_at: nowIso() } })
}

export async function setPacerVerificationToken(pacerId: string, token: string, expiresAt: Date) {
  const db = await getDb()
  await db.collection('pacer_registrations').updateOne(
    { id: pacerId },
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

export async function findPacerByVerificationToken(token: string) {
  const db = await getDb()
  const doc = await db.collection<PacerDoc>('pacer_registrations').findOne({ verification_token: token })
  return stripMongoId(doc) as PacerRegistration | null
}

export async function verifyPacerEmail(pacerId: string) {
  const db = await getDb()
  await db.collection('pacer_registrations').updateOne(
    { id: pacerId },
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
