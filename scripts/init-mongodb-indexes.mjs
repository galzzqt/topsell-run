/**
 * Initialize MongoDB indexes for topsell-run.
 * Usage: node scripts/init-mongodb-indexes.mjs
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

async function main() {
  const dbName = process.env.MONGODB_DB_NAME || 'topsell-run'
  const client = await connectMongo()
  const db = client.db(dbName)

  await Promise.all([
    db.collection('communities').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
      { key: { community_code: 1 }, unique: true },
    ]),
    db.collection('participants').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { community_id: 1 } },
      { key: { registration_id: 1 } },
      { key: { participant_code: 1 }, unique: true, sparse: true },
      { key: { payment_status: 1 } },
    ]),
    db.collection('registrations').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { community_id: 1 } },
      { key: { status: 1 } },
    ]),
    db.collection('payments').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { registration_id: 1 } },
      { key: { payment_reference: 1 }, unique: true },
      { key: { xendit_session_id: 1 }, sparse: true },
      { key: { status: 1 } },
    ]),
    db.collection('app_settings').createIndexes([{ key: { key: 1 }, unique: true }]),
    db.collection('community_auth').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
    ]),
  ])

  console.log(`MongoDB indexes initialized on database "${dbName}".`)
  await client.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
