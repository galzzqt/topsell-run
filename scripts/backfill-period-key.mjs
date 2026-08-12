/**
 * Backfill `period_key` pada participants/payments lama (sebelum fitur Periode ada)
 * menjadi 'periode-1' — sesuai migrasi otomatis di normalizePackageConfig yang
 * membungkus periodStart/periodEnd/categories lama sebagai "Periode 1".
 * Usage: node scripts/backfill-period-key.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'

function loadEnvFile() {
  const envPath = resolve(process.cwd(), '.env.local')
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue
      let value = match[2] || ''
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  } catch {
    // ignore
  }
}

loadEnvFile()

async function connectMongo() {
  const standard = process.env.MONGODB_URI_STANDARD
  const srv = process.env.MONGODB_URI

  if (standard) {
    try {
      const client = new MongoClient(standard)
      await client.connect()
      return client
    } catch (error) {
      if (!srv) throw error
    }
  }

  const client = new MongoClient(srv || standard)
  await client.connect()
  return client
}

const COLLECTIONS = [
  'participants',
  'payments',
  'family_participants',
  'family_payments',
  'individual_participants',
  'individual_payments',
]

async function main() {
  const dbName = process.env.MONGODB_DB_NAME || 'topsell-run'
  const client = await connectMongo()
  const db = client.db(dbName)

  for (const name of COLLECTIONS) {
    const result = await db.collection(name).updateMany(
      { period_key: { $exists: false } },
      { $set: { period_key: 'periode-1' } }
    )
    console.log(`${name}: ${result.modifiedCount} dokumen di-backfill ke period_key='periode-1'.`)
  }

  console.log(`Backfill period_key selesai pada database "${dbName}".`)
  await client.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
