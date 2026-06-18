/**
 * Migrate all data from Supabase PostgreSQL to MongoDB Atlas.
 *
 * Usage:
 *   node scripts/migrate-supabase-to-mongodb.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   MONGODB_URI (or MONGODB_URI_STANDARD)
 *   MONGODB_DB_NAME (optional, default: topsell-run)
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
      if (!process.env[match[1]]) {
        process.env[match[1]] = value
      }
    }
  } catch {
    console.warn('Could not read .env.local — using existing process.env only.')
  }
}

loadEnvFile()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_STANDARD
const DB_NAME = process.env.MONGODB_DB_NAME || 'topsell-run'

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI or MONGODB_URI_STANDARD')
  process.exit(1)
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

async function fetchAllRows(table, select = '*') {
  const rows = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${pageSize}&offset=${offset}`
    const res = await fetch(url, { headers: { ...headers, Prefer: 'count=exact' } })
    if (!res.ok) {
      throw new Error(`Failed to fetch ${table}: ${res.status} ${await res.text()}`)
    }

    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < pageSize) break
    offset += pageSize
  }

  return rows
}

async function fetchAuthUsers() {
  const users = []
  const perPage = 1000

  for (let page = 1; page <= 50; page += 1) {
    const url = `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`Failed to fetch auth users: ${res.status} ${await res.text()}`)
    }

    const data = await res.json()
    users.push(...(data.users || []))
    if ((data.users || []).length < perPage) break
  }

  return users
}

async function fetchAuthPasswords() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/users?select=id,email,encrypted_password`
    const res = await fetch(url, {
      headers: {
        ...headers,
        Accept: 'application/json',
        'Accept-Profile': 'auth',
      },
    })

    if (!res.ok) {
      console.warn('Could not fetch auth.users encrypted_password via REST. Passwords will need reset if missing.')
      return new Map()
    }

    const rows = await res.json()
    const map = new Map()
    for (const row of rows) {
      if (row.id && row.encrypted_password) {
        map.set(row.id, row.encrypted_password)
      }
    }
    return map
  } catch (error) {
    console.warn('Auth password export failed:', error)
    return new Map()
  }
}

function toMongoDoc(row) {
  const { ...rest } = row
  return { ...rest, _id: row.id }
}

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
      console.warn('Standard URI failed, trying SRV...')
    }
  }

  const client = new MongoClient(srv || standard)
  await client.connect()
  return client
}

async function main() {
  console.log('Starting Supabase → MongoDB migration...\n')

  const [communities, participants, registrations, payments, appSettings, authUsers, authPasswords] = await Promise.all([
    fetchAllRows('communities'),
    fetchAllRows('participants'),
    fetchAllRows('registrations'),
    fetchAllRows('payments'),
    fetchAllRows('app_settings'),
    fetchAuthUsers(),
    fetchAuthPasswords(),
  ])

  console.log('Fetched from Supabase:')
  console.log(`  communities:   ${communities.length}`)
  console.log(`  participants:  ${participants.length}`)
  console.log(`  registrations: ${registrations.length}`)
  console.log(`  payments:      ${payments.length}`)
  console.log(`  app_settings:  ${appSettings.length}`)
  console.log(`  auth users:    ${authUsers.length}`)
  console.log(`  auth passwords:${authPasswords.size}\n`)

  const client = await connectMongo()
  const db = client.db(DB_NAME)

  const collections = ['communities', 'participants', 'registrations', 'payments', 'app_settings', 'community_auth']

  console.log('Clearing existing MongoDB collections (if any)...')
  for (const name of collections) {
    await db.collection(name).deleteMany({})
  }

  if (communities.length > 0) {
    await db.collection('communities').insertMany(communities.map(toMongoDoc))
  }

  if (participants.length > 0) {
    await db.collection('participants').insertMany(participants.map(toMongoDoc))
  }

  if (registrations.length > 0) {
    await db.collection('registrations').insertMany(registrations.map(toMongoDoc))
  }

  if (payments.length > 0) {
    await db.collection('payments').insertMany(payments.map(toMongoDoc))
  }

  if (appSettings.length > 0) {
    await db.collection('app_settings').insertMany(appSettings.map((row) => ({ ...row, _id: row.key })))
  }

  const communityById = new Map(communities.map((c) => [c.id, c]))
  const authDocs = []

  for (const user of authUsers) {
    const community = communityById.get(user.id)
    if (!community) continue

    const bcryptHash = authPasswords.get(user.id)
    if (!bcryptHash) {
      console.warn(`  Warning: no password hash for community ${community.phone} (${user.id}) — login may fail until password reset`)
      continue
    }

    authDocs.push({
      _id: user.id,
      id: user.id,
      phone: community.phone,
      password_hash: bcryptHash,
      password_salt: '',
      password_scheme: 'bcrypt',
      created_at: community.created_at,
      updated_at: community.updated_at,
    })
  }

  if (authDocs.length > 0) {
    await db.collection('community_auth').insertMany(authDocs)
  }

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
    ]),
    db.collection('registrations').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { community_id: 1 } },
    ]),
    db.collection('payments').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { payment_reference: 1 }, unique: true },
      { key: { xendit_session_id: 1 }, sparse: true },
    ]),
    db.collection('app_settings').createIndexes([{ key: { key: 1 }, unique: true }]),
    db.collection('community_auth').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
    ]),
  ])

  const verify = {
    communities: await db.collection('communities').countDocuments(),
    participants: await db.collection('participants').countDocuments(),
    registrations: await db.collection('registrations').countDocuments(),
    payments: await db.collection('payments').countDocuments(),
    app_settings: await db.collection('app_settings').countDocuments(),
    community_auth: await db.collection('community_auth').countDocuments(),
  }

  console.log('\nMongoDB document counts:')
  for (const [name, count] of Object.entries(verify)) {
    console.log(`  ${name}: ${count}`)
  }

  await client.close()

  const mismatches = [
    ['communities', communities.length, verify.communities],
    ['participants', participants.length, verify.participants],
    ['registrations', registrations.length, verify.registrations],
    ['payments', payments.length, verify.payments],
    ['app_settings', appSettings.length, verify.app_settings],
  ].filter(([, source, target]) => source !== target)

  if (mismatches.length > 0) {
    console.error('\nMigration verification failed:')
    for (const [name, source, target] of mismatches) {
      console.error(`  ${name}: source=${source}, mongo=${target}`)
    }
    process.exit(1)
  }

  if (authDocs.length < communities.length) {
    console.warn(`\nWarning: only ${authDocs.length}/${communities.length} community auth records migrated.`)
    console.warn('Communities without auth records cannot login until admin resets their password.')
  }

  console.log('\nMigration completed successfully.')
}

main().catch((error) => {
  console.error('\nMigration failed:', error)
  process.exit(1)
})
