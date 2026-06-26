import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Family } from '@/lib/types'
import type { PasswordRecord } from '@/lib/auth/password'
import { docToFamily, exactEmailRegex, generateFamilyCode, newId, normalizeEmail, nowIso, stripMongoId } from './utils'

type FamilyDoc = Family & { _id?: unknown }

export async function findFamilyById(id: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyDoc>('families').findOne({ id })
  return stripMongoId(doc) as Family | null
}

export async function findFamilyByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyDoc>('families').findOne({ phone })
  return stripMongoId(doc) as Family | null
}

export async function findFamilyByEmail(email: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyDoc>('families').findOne({ email: { $regex: exactEmailRegex(email) } })
  return stripMongoId(doc) as Family | null
}

export async function findFamilyByPhoneExcept(phone: string, excludeId: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyDoc>('families').findOne({ phone, id: { $ne: excludeId } })
  return stripMongoId(doc) as Family | null
}

export async function listFamilies() {
  const db = await getDb()
  const docs = await db.collection<FamilyDoc>('families').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => docToFamily(stripMongoId(doc) as Record<string, unknown>))
}

export async function createUniqueFamilyCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateFamilyCode()
    const existing = await db.collection('families').findOne({ family_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode grup unik.')
}

export async function createFamily(input: {
  name: string
  leader_name: string
  email: string | null
  phone: string
  category: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
}) {
  const db = await getDb()
  const id = newId()
  const timestamp = nowIso()
  const family: Family = {
    id,
    name: input.name,
    leader_name: input.leader_name,
    email: input.email ? normalizeEmail(input.email) : null,
    phone: input.phone,
    category: input.category,
    family_code: await createUniqueFamilyCode(),
    provinsi: input.provinsi,
    kota: input.kota,
    kecamatan: input.kecamatan,
    email_verified: false,
    verification_token: null,
    verification_token_expires: null,
    verification_sent_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('families').insertOne({ ...family })
  return family
}

export async function updateFamily(id: string, values: Partial<Family>) {
  const db = await getDb()
  const updatedAt = nowIso()
  const nextValues = {
    ...values,
    ...(typeof values.email === 'string' ? { email: normalizeEmail(values.email) } : {}),
  }
  await db.collection('families').updateOne(
    { id },
    { $set: { ...nextValues, updated_at: updatedAt } }
  )
}

export async function deleteFamily(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('families').deleteOne({ id }),
    db.collection('family_auth').deleteOne({ id }),
    db.collection('family_participants').deleteMany({ family_id: id }),
    db.collection('family_registrations').deleteMany({ family_id: id }),
  ])
}

export async function saveFamilyAuth(id: string, phone: string, password: PasswordRecord) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('family_auth').updateOne(
    { id },
    {
      $set: {
        id,
        phone,
        ...password,
        updated_at: timestamp,
      },
      $setOnInsert: { created_at: timestamp },
    },
    { upsert: true }
  )
}

export async function findFamilyAuthByPhone(phone: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('family_auth').findOne({ phone })
}

export async function findFamilyAuthById(id: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('family_auth').findOne({ id })
}

export async function updateFamilyAuthPhone(id: string, phone: string) {
  const db = await getDb()
  await db.collection('family_auth').updateOne({ id }, { $set: { phone, updated_at: nowIso() } })
}

export async function updateFamilyAuthPassword(id: string, password: PasswordRecord) {
  const db = await getDb()
  await db.collection('family_auth').updateOne(
    { id },
    { $set: { ...password, updated_at: nowIso() } }
  )
}

export async function deleteFamilyAuth(id: string) {
  const db = await getDb()
  await db.collection('family_auth').deleteOne({ id })
}

export async function setFamilyVerificationToken(familyId: string, token: string, expiresAt: Date) {
  const db = await getDb()
  await db.collection('families').updateOne(
    { id: familyId },
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

export async function findFamilyByVerificationToken(token: string) {
  const db = await getDb()
  const doc = await db.collection<FamilyDoc>('families').findOne({ verification_token: token })
  return stripMongoId(doc) as Family | null
}

export async function verifyFamilyEmail(familyId: string) {
  const db = await getDb()
  await db.collection('families').updateOne(
    { id: familyId },
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

export async function clearFamilyVerificationToken(familyId: string) {
  const db = await getDb()
  await db.collection('families').updateOne(
    { id: familyId },
    {
      $set: {
        verification_token: null,
        verification_token_expires: null,
        updated_at: nowIso(),
      },
    }
  )
}
