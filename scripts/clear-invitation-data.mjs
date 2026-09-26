// Hapus SEMUA data pendaftaran invitation (untuk bersih-bersih data testing).
// Paket lain, pengaturan admin, dan index TIDAK disentuh.
//
//   node scripts/clear-invitation-data.mjs            → dry-run: tampilkan jumlah data saja
//   node scripts/clear-invitation-data.mjs --confirm  → benar-benar menghapus

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'

const COLLECTIONS = [
  'invitation_participants',
  'invitation_registrations',
  'invitation_payments',
  'invitation_auth',
  'invitations',
]

function loadEnvFile() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue
      let value = match[2] || ''
      if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1)
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  } catch {
    console.warn('Could not read .env.local — using existing process.env only.')
  }
}

loadEnvFile()

const confirm = process.argv.includes('--confirm')
const uri = process.env.MONGODB_URI_STANDARD || process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME || 'topsell-run'
if (!uri) {
  console.error('MONGODB_URI / MONGODB_URI_STANDARD belum diatur.')
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(dbName)

// Tampilkan host (tanpa kredensial) supaya jelas database mana yang akan dihapus.
console.log(`Database: ${dbName} @ ${uri.split('@').pop().split(/[,/:?]/)[0]}`)
console.log(confirm ? 'MODE: HAPUS\n' : 'MODE: dry-run (tambahkan --confirm untuk menghapus)\n')

for (const name of COLLECTIONS) {
  const collection = db.collection(name)
  if (confirm) {
    const { deletedCount } = await collection.deleteMany({})
    console.log(`✅ ${name}: ${deletedCount} dihapus`)
  } else {
    console.log(`• ${name}: ${await collection.countDocuments()} dokumen`)
  }
}

await client.close()
