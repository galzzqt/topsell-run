// Script to CLEAN ALL DATA from the database (for testing only!)
// ⚠️ WARNING: This will delete ALL data! Use with caution!

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

async function clearAllData() {
  const force = process.argv.includes('--force') || process.argv.includes('-f')

  console.log('⚠️ ⚠️ ⚠️ WARNING ⚠️ ⚠️ ⚠️')
  console.log('This will DELETE ALL DATA from the database!')
  console.log('This includes:')
  console.log('- All participants (community and family)')
  console.log('- All registrations')
  console.log('- All payments')
  console.log('- All communities and families')
  console.log('- All auth emails')
  console.log('- All community and family auth')
  console.log('')

  if (!force) {
    const readline = (await import('readline/promises')).default
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const confirm1 = await rl.question('Type "DELETE ALL" to continue: ')
    if (confirm1 !== 'DELETE ALL') {
      console.log('❌ Operation cancelled.')
      rl.close()
      return
    }

    const confirm2 = await rl.question('Type "CONFIRM" to REALLY DELETE ALL DATA: ')
    if (confirm2 !== 'CONFIRM') {
      console.log('❌ Operation cancelled.')
      rl.close()
      return
    }

    rl.close()
  } else {
    console.log('ℹ️  --force flag used: skipping confirmations!')
  }

  try {
    const dbName = process.env.MONGODB_DB_NAME || 'topsell-run'
    const client = await connectMongo()
    const db = client.db(dbName)

    // List of collections to clean
    const collectionsToClean = [
      'family_participants',
      'participants',
      'family_registrations',
      'registrations',
      'family_payments',
      'payments',
      'families',
      'communities',
      'family_auth',
      'community_auth',
      'auth_emails'
    ]

    console.log('\nStarting to clean database...')
    console.log('--------------------------------')

    for (const collectionName of collectionsToClean) {
      try {
        const result = await db.collection(collectionName).deleteMany({})
        console.log(`✅ Cleared ${result.deletedCount} documents from "${collectionName}"`)
      } catch (err) {
        // Ignore error if collection doesn't exist
        if (err.codeName === 'NamespaceNotFound') {
          console.log(`ℹ️  Collection "${collectionName}" doesn't exist (skipping)`)
        } else {
          console.error(`❌ Failed to clear "${collectionName}":`, err)
        }
      }
    }

    await client.close()

    console.log('--------------------------------')
    console.log('🎉 ALL DATA CLEARED SUCCESSFULLY!')
    console.log('You can now start testing fresh!')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error cleaning database:', error)
    process.exit(1)
  }
}

clearAllData()
