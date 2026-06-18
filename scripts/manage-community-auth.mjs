import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'
import { createHmac, randomUUID, scryptSync } from 'crypto'

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

function hashScryptPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex')
}

function createPasswordRecord(password) {
  const salt = createHmac('sha256', randomUUID()).update(`${Date.now()}`).digest('hex').slice(0, 24)
  return {
    password_salt: salt,
    password_hash: hashScryptPassword(password, salt),
    password_scheme: 'scrypt',
  }
}

async function run() {
  const args = process.argv.slice(2)
  const mode = args[0] // 'set-plain', 'set-plain-all', or 'import-hashes'
  
  if (!mode || (mode !== 'set-plain' && mode !== 'set-plain-all' && mode !== 'import-hashes')) {
    console.log('Usage:')
    console.log('  node scripts/manage-community-auth.mjs set-plain <phone> <password>')
    console.log('  node scripts/manage-community-auth.mjs set-plain-all <password>')
    console.log('  node scripts/manage-community-auth.mjs import-hashes <path-to-json-file>')
    process.exit(1)
  }

  const dbName = process.env.MONGODB_DB_NAME || 'topsell-run'
  const client = await connectMongo()
  const db = client.db(dbName)

  if (mode === 'set-plain') {
    const phone = args[1]
    const password = args[2]
    if (!phone || !password) {
      console.error('Error: phone and password are required.')
      process.exit(1)
    }

    const community = await db.collection('communities').findOne({ phone })
    if (!community) {
      console.error(`Error: Community with phone ${phone} not found.`)
      process.exit(1)
    }

    const passwordRecord = createPasswordRecord(password)
    const timestamp = new Date().toISOString()

    await db.collection('community_auth').updateOne(
      { id: community.id },
      {
        $set: {
          id: community.id,
          phone: community.phone,
          ...passwordRecord,
          updated_at: timestamp,
        },
        $setOnInsert: { created_at: timestamp },
      },
      { upsert: true }
    )

    console.log(`Successfully set password for community ${phone} (${community.name})`)
  } else if (mode === 'set-plain-all') {
    const password = args[1]
    if (!password) {
      console.error('Error: password is required.')
      process.exit(1)
    }

    const communities = await db.collection('communities').find({}).toArray()
    console.log(`Setting password to "${password}" for ${communities.length} communities...`)
    
    for (const community of communities) {
      const passwordRecord = createPasswordRecord(password)
      const timestamp = new Date().toISOString()

      await db.collection('community_auth').updateOne(
        { id: community.id },
        {
          $set: {
            id: community.id,
            phone: community.phone,
            ...passwordRecord,
            updated_at: timestamp,
          },
          $setOnInsert: { created_at: timestamp },
        },
        { upsert: true }
      )
      console.log(`  - Set password for ${community.phone}`)
    }
    console.log('All communities passwords updated.')
  } else if (mode === 'import-hashes') {
    const jsonPath = args[1]
    if (!jsonPath) {
      console.error('Error: path to JSON file is required.')
      process.exit(1)
    }

    const data = JSON.parse(readFileSync(resolve(jsonPath), 'utf8'))
    const communities = await db.collection('communities').find({}).toArray()
    const communityById = new Map(communities.map((c) => [c.id, c]))

    let importedCount = 0
    for (const item of data) {
      const userId = item.id
      const hash = item.encrypted_password
      if (!userId || !hash) continue

      const community = communityById.get(userId)
      if (!community) continue

      const timestamp = new Date().toISOString()
      await db.collection('community_auth').updateOne(
        { id: userId },
        {
          $set: {
            id: userId,
            phone: community.phone,
            password_hash: hash,
            password_salt: '',
            password_scheme: 'bcrypt',
            updated_at: timestamp,
          },
          $setOnInsert: { created_at: timestamp },
        },
        { upsert: true }
      )
      console.log(`  - Imported password hash for community ${community.phone}`)
      importedCount++
    }

    console.log(`Imported ${importedCount} password hashes successfully.`)
  }

  await client.close()
}

run().catch(console.error)
