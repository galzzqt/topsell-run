import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { Community } from '@/lib/types'
import type { PasswordRecord } from '@/lib/auth/password'
import { docToCommunity, generateCommunityCode, newId, nowIso, stripMongoId } from './utils'

type CommunityDoc = Community & { _id?: unknown }

export async function findCommunityById(id: string) {
  const db = await getDb()
  const doc = await db.collection<CommunityDoc>('communities').findOne({ id })
  return stripMongoId(doc) as Community | null
}

export async function findCommunityByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<CommunityDoc>('communities').findOne({ phone })
  return stripMongoId(doc) as Community | null
}

export async function findCommunityByEmail(email: string) {
  const db = await getDb()
  const doc = await db.collection<CommunityDoc>('communities').findOne({ email: { $regex: new RegExp(`^${email.trim()}$`, 'i') } })
  return stripMongoId(doc) as Community | null
}

export async function findCommunityByPhoneExcept(phone: string, excludeId: string) {
  const db = await getDb()
  const doc = await db.collection<CommunityDoc>('communities').findOne({ phone, id: { $ne: excludeId } })
  return stripMongoId(doc) as Community | null
}

export async function listCommunities() {
  const db = await getDb()
  const docs = await db.collection<CommunityDoc>('communities').find({}).sort({ created_at: -1 }).toArray()
  return docs.map((doc) => docToCommunity(stripMongoId(doc) as Record<string, unknown>))
}

export async function createUniqueCommunityCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateCommunityCode()
    const existing = await db.collection('communities').findOne({ community_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode komunitas unik.')
}

export async function createCommunity(input: {
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
  const community: Community = {
    id,
    name: input.name,
    leader_name: input.leader_name,
    email: input.email,
    phone: input.phone,
    category: input.category,
    community_code: await createUniqueCommunityCode(),
    provinsi: input.provinsi,
    kota: input.kota,
    kecamatan: input.kecamatan,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('communities').insertOne({ ...community })
  return community
}

export async function updateCommunity(id: string, values: Partial<Community>) {
  const db = await getDb()
  const updatedAt = nowIso()
  await db.collection('communities').updateOne(
    { id },
    { $set: { ...values, updated_at: updatedAt } }
  )
}

export async function deleteCommunity(id: string) {
  const db = await getDb()
  await Promise.all([
    db.collection('communities').deleteOne({ id }),
    db.collection('community_auth').deleteOne({ id }),
    db.collection('participants').deleteMany({ community_id: id }),
    db.collection('registrations').deleteMany({ community_id: id }),
  ])
}

export async function saveCommunityAuth(id: string, phone: string, password: PasswordRecord) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('community_auth').updateOne(
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

export async function findCommunityAuthByPhone(phone: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('community_auth').findOne({ phone })
}

export async function findCommunityAuthById(id: string) {
  const db = await getDb()
  return db.collection<PasswordRecord & { id: string; phone: string }>('community_auth').findOne({ id })
}

export async function updateCommunityAuthPhone(id: string, phone: string) {
  const db = await getDb()
  await db.collection('community_auth').updateOne({ id }, { $set: { phone, updated_at: nowIso() } })
}

export async function updateCommunityAuthPassword(id: string, password: PasswordRecord) {
  const db = await getDb()
  await db.collection('community_auth').updateOne(
    { id },
    { $set: { ...password, updated_at: nowIso() } }
  )
}

export async function deleteCommunityAuth(id: string) {
  const db = await getDb()
  await db.collection('community_auth').deleteOne({ id })
}
