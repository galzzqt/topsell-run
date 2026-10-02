import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import type { LaberRegistration } from '@/lib/types'
import {
  docToLaber,
  generateLaberCode,
  newId,
  nowIso,
  stripMongoId,
} from './utils'

type LaberDoc = LaberRegistration & { _id?: unknown }

export async function findLaberById(id: string) {
  const db = await getDb()
  const doc = await db.collection<LaberDoc>('laber_registrations').findOne({ id })
  return stripMongoId(doc) as LaberRegistration | null
}

export async function findLaberByPhone(phone: string) {
  const db = await getDb()
  const doc = await db.collection<LaberDoc>('laber_registrations').findOne({ phone })
  return stripMongoId(doc) as LaberRegistration | null
}

export async function listLabers() {
  const db = await getDb()
  const docs = await db
    .collection<LaberDoc>('laber_registrations')
    .find({})
    .sort({ created_at: -1 })
    .toArray()
  return docs.map((doc) => docToLaber(stripMongoId(doc) as Record<string, unknown>))
}

export async function createUniqueLaberCode() {
  const db = await getDb()
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateLaberCode()
    const existing = await db.collection('laber_registrations').findOne({ laber_code: code })
    if (!existing) return code
  }
  throw new Error('Gagal membuat kode laber unik.')
}

let laberIndexesPromise: Promise<void> | null = null
export function ensureLaberIndexes() {
  laberIndexesPromise ??= (async () => {
    const db = await getDb()
    await db.collection('laber_registrations').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
      { key: { laber_code: 1 }, unique: true },
      { key: { community: 1 } },
      { key: { created_at: -1 } },
    ])
  })().catch((error) => {
    laberIndexesPromise = null
    console.error('Failed to create laber indexes:', error)
  })
  return laberIndexesPromise
}

export async function createLaber(input: {
  name: string
  phone: string
  community: string
}) {
  const db = await getDb()
  await ensureLaberIndexes()

  const id = newId()
  const timestamp = nowIso()
  const laberCode = await createUniqueLaberCode()

  const laber: LaberRegistration = {
    id,
    name: input.name.trim(),
    phone: input.phone.trim(),
    community: input.community.trim(),
    laber_code: laberCode,
    status: 'registered',
    created_at: timestamp,
    updated_at: timestamp,
  }

  await db.collection('laber_registrations').insertOne({ ...laber })
  return laber
}

export async function deleteLaber(id: string) {
  const db = await getDb()
  await db.collection('laber_registrations').deleteOne({ id })
}
