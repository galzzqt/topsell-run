/**
 * Pasang / lihat URL webhook GHL per paket, langsung di database.
 *
 * Dipakai untuk memasang konfigurasi ke database yang tidak bisa dijangkau
 * halaman admin — misalnya database produksi, atau saat akun admin bukan
 * superadmin (penyimpanan pengaturan hanya untuk superadmin).
 *
 * Jalankan dari mesin Anda sendiri, bukan di server:
 *
 *   # 1. Lihat isi sekarang (tidak menulis apa pun)
 *   node scripts/set-webhook-url.mjs
 *
 *   # 2. Lihat perubahan yang akan dilakukan (masih belum menulis)
 *   node scripts/set-webhook-url.mjs pacer status https://services.leadconnectorhq.com/hooks/...
 *
 *   # 3. Tulis beneran
 *   node scripts/set-webhook-url.mjs pacer status https://... --yes
 *
 *   # Menyasar database lain (mis. produksi) — URI dari environment:
 *   MONGODB_URI="mongodb+srv://..." node scripts/set-webhook-url.mjs pacer status https://... --yes
 *
 * Tanpa MONGODB_URI di environment, skrip memakai .env.local seperti skrip lain
 * di folder ini. Host & nama database selalu dicetak sebelum menulis, supaya
 * tidak salah sasaran.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { MongoClient } from 'mongodb'

const PACKAGES = ['community', 'family', 'individual', 'pacer', 'umkm']
const KINDS = ['registration', 'payment', 'status']
const SETTINGS_KEY = 'registration_form'

function loadEnvFile() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
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
    // .env.local opsional kalau MONGODB_URI sudah ada di environment.
  }
}

function fail(message) {
  console.error(`\nGAGAL: ${message}\n`)
  process.exit(1)
}

/** Host + nama database, tanpa username/password. */
function describeTarget(uri, dbName) {
  const host = (uri.match(/@([^/?]+)/) || [])[1] || '(host tidak dikenali)'
  return `${host} → database "${dbName}"`
}

// URI yang diberikan lewat environment menang atas .env.local — itulah cara
// menyasar database lain tanpa mengubah file apa pun.
const uriFromEnv = process.env.MONGODB_URI || process.env.MONGODB_URI_STANDARD

loadEnvFile()

const args = process.argv.slice(2)
const confirmed = args.includes('--yes')
const [pkg, kind, url, token] = args.filter((a) => a !== '--yes')

if (pkg && !PACKAGES.includes(pkg)) fail(`paket "${pkg}" tidak dikenal. Pilihan: ${PACKAGES.join(', ')}`)
if (kind && !KINDS.includes(kind)) fail(`jenis "${kind}" tidak dikenal. Pilihan: ${KINDS.join(', ')}`)
if (pkg && !kind) fail('jenis webhook belum disebut. Contoh: node scripts/set-webhook-url.mjs pacer status https://...')
if (url && !/^https?:\/\//.test(url)) fail(`"${url}" bukan URL yang valid (harus diawali http:// atau https://)`)

// Dari .env.local, dahulukan bentuk standar: SRV (mongodb+srv://) butuh DNS
// yang tidak selalu tersedia di jaringan kantor/VPN.
const uri = uriFromEnv || process.env.MONGODB_URI_STANDARD || process.env.MONGODB_URI
if (!uri) fail('MONGODB_URI tidak ada di environment maupun .env.local')
const dbName = process.env.MONGODB_DB_NAME || 'topsell-run'

console.log(`\nTarget: ${describeTarget(uri, dbName)}`)

const client = new MongoClient(uri)
try {
  await client.connect()
} catch (error) {
  const hint = /querySrv|ENOTFOUND|ECONNREFUSED/.test(String(error?.message))
    ? '\nPetunjuk: kalau URI-nya mongodb+srv:// dan DNS diblokir, pakai URI bentuk standar (mongodb://host1,host2,host3/...).'
    : '\nPetunjuk: pastikan IP Anda masuk daftar izin Network Access di MongoDB Atlas.'
  fail(`tidak bisa terhubung ke database: ${error?.message}${hint}`)
}

try {
  const db = client.db(dbName)
  const doc = await db.collection('app_settings').findOne({ key: SETTINGS_KEY })
  if (!doc) fail(`dokumen app_settings "${SETTINGS_KEY}" tidak ada di database ini — pastikan targetnya benar`)

  const webhooks = doc.value?.webhookSettings || {}

  console.log('\nIsi webhook saat ini:')
  for (const p of PACKAGES) {
    const cfg = webhooks[p] || {}
    const parts = KINDS.map((k) => `${k}=${cfg[k]?.url ? 'terisi' : '-'}`)
    console.log(`  ${p.padEnd(11)} ${parts.join('  ')}`)
  }

  if (!pkg) {
    console.log('\n(hanya menampilkan — sebutkan paket, jenis, dan URL untuk mengubah)\n')
    process.exit(0)
  }

  const current = webhooks[pkg]?.[kind]?.url || '(kosong)'
  console.log(`\nPerubahan pada ${pkg}.${kind}:`)
  console.log(`  sebelum : ${current}`)
  console.log(`  sesudah : ${url || '(kosong — menghapus URL)'}`)

  if (!confirmed) {
    console.log('\nBelum ditulis. Tambahkan --yes untuk benar-benar menyimpan.\n')
    process.exit(0)
  }

  const result = await db.collection('app_settings').updateOne(
    { key: SETTINGS_KEY },
    {
      $set: {
        [`value.webhookSettings.${pkg}.${kind}`]: { url: url || '', token: token || '' },
        updated_at: new Date().toISOString(),
      },
    },
  )

  const after = await db.collection('app_settings').findOne({ key: SETTINGS_KEY })
  const saved = after.value.webhookSettings[pkg][kind].url

  if (saved !== (url || '')) fail('nilai setelah ditulis tidak sesuai — periksa manual')

  console.log(`\nTersimpan (matched ${result.matchedCount}, modified ${result.modifiedCount}).`)
  console.log(`${pkg}.${kind} sekarang: ${saved || '(kosong)'}\n`)
} finally {
  await client.close()
}
