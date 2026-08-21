import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Individual } from '@/lib/types'
import type { PasswordRecord } from '@/lib/auth/password'
import { docToIndividual, exactEmailRegex, generateIndividualCode, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type IndividualDoc = Individual & { _id?: unknown }

export async function findIndividualById(id: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualDoc>('individuals').findOne({ id })
  return stripMongoId(doc) as Individual | null
}

export async function findIndividualByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualDoc>('individuals').findOne({ phone })
  return stripMongoId(doc) as Individual | null
}

export async function findIndividualByEmail(email: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualDoc>('individuals').findOne({ email: { $regex: exactEmailRegex(email) } })
  return stripMongoId(doc) as Individual | null
}

export async function findIndividualByPhoneExcept(phone: string, excludeId: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualDoc>('individuals').findOne({ phone, id: { $ne: excludeId } })
  return stripMongoId(doc) as Individual | null
}

export async function listIndividuals() {
  const db = await getDb()
  const docs = await db.collection<IndividualDoc>('individuals').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => docToIndividual(stripMongoId(doc) as Record<string, unknown>))
}

export async function createUniqueIndividualCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateIndividualCode()
    const existing = await db.collection('individuals').findOne({ individual_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode peserta unik.')
}

export async function createIndividual(input: {
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
  const individual: Individual = {
    id,
    name: input.name,
    leader_name: input.leader_name,
    email: input.email ? normalizeEmail(input.email) : null,
    phone: input.phone,
    category: input.category,
    individual_code: await createUniqueIndividualCode(),
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

  await db.collection('individuals').insertOne({ ...individual })
  return individual
}

export async function updateIndividual(id: string, values: Partial<Individual>) {
  const db = await getDb()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('individuals').updateOne({ id }, { $set: { ...nextValues, updated_at: nowIso() } })
}

export async function deleteIndividual(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('individuals').deleteOne({ id }),
    db.collection('individual_auth').deleteOne({ id }),
    db.collection('individual_participants').deleteMany({ individual_id: id }),
    db.collection('individual_registrations').deleteMany({ individual_id: id }),
  ])
}

export async function saveIndividualAuth(id: string, phone: string, password: PasswordRecord) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('individual_auth').updateOne(
    { id },
    {
      $set: { id, phone, ...password, updated_at: timestamp },
      $setOnInsert: { created_at: timestamp },
    },
    { upsert: true }
  )
}

export async function findIndividualAuthByPhone(phone: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('individual_auth').findOne({ phone })
}

export async function findIndividualAuthById(id: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('individual_auth').findOne({ id })
}

export async function updateIndividualAuthPhone(id: string, phone: string) {
  const db = await getDb()
  await db.collection('individual_auth').updateOne({ id }, { $set: { phone, updated_at: nowIso() } })
}

export async function updateIndividualAuthPassword(id: string, password: PasswordRecord) {
  const db = await getDb()
  await db.collection('individual_auth').updateOne({ id }, { $set: { ...password, updated_at: nowIso() } })
}

export async function setIndividualVerificationToken(individualId: string, token: string, expiresAt: Date) {
  const db = await getDb()
  await db.collection('individuals').updateOne(
    { id: individualId },
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

export async function findIndividualByVerificationToken(token: string) {
  const db = await getDb()
  const doc = await db.collection<IndividualDoc>('individuals').findOne({ verification_token: token })
  return stripMongoId(doc) as Individual | null
}

export async function verifyIndividualEmail(individualId: string) {
  const db = await getDb()
  await db.collection('individuals').updateOne(
    { id: individualId },
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
