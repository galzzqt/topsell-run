import 'server-only'

import { getDb } from '@/lib/mongodb/client'
import { nowIso } from './utils'

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const db = await getDb()
  const doc = await db.collection('app_settings').findOne({ key })
  return (doc?.value as T | undefined) ?? null
}

export async function upsertAppSetting(key: string, value: unknown) {
  const db = await getDb()
  const timestamp = nowIso()
  await db.collection('app_settings').updateOne(
    { key },
    {
      $set: { key, value, updated_at: timestamp },
      $setOnInsert: { created_at: timestamp },
    },
    { upsert: true }
  )
}
