/**
 * Dry-run reminder pembayaran: cetak siapa saja yang akan dikirimi email dan
 * simpan preview HTML-nya. Tidak mengirim email dan tidak mengubah database.
 *
 * Usage: node scripts/preview-payment-reminders.mjs [baseUrl]
 * Default baseUrl: http://localhost:3000 (server harus sedang jalan)
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

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
      if (!process.env[match[1]]) process.env[match[1]] = value.trim()
    }
  } catch {
    console.warn('.env.local tidak terbaca, mengandalkan environment variable yang ada.')
  }
}

loadEnvFile()

const baseUrl = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '')
const secret = process.env.CRON_SECRET

if (!secret) {
  console.error('CRON_SECRET belum diisi di .env.local.')
  process.exit(1)
}

const res = await fetch(`${baseUrl}/api/cron/payment-reminder?dry=1`, {
  headers: { Authorization: `Bearer ${secret}` },
})

if (!res.ok) {
  console.error(`Gagal: HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`)
  process.exit(1)
}

const { targets = [] } = await res.json()

if (targets.length === 0) {
  console.log('Tidak ada peserta pending yang jatuh tempo reminder saat ini.')
  process.exit(0)
}

const outDir = resolve(process.cwd(), 'tmp/reminder-preview')
mkdirSync(outDir, { recursive: true })

console.log(`\n${targets.length} email akan dikirim:\n`)
console.table(
  targets.map((t) => ({
    Pool: t.pool,
    Tahap: t.stage,
    Kode: t.code,
    Email: t.email,
    Tagihan: `Rp ${t.amount.toLocaleString('id-ID')}`,
    Referensi: t.reference,
  }))
)

for (const t of targets) {
  const file = resolve(outDir, `${t.code}-tahap${t.stage}.html`)
  writeFileSync(file, t.html, 'utf8')
  console.log(`Preview: ${file}`)
}

console.log(`\nSubjek contoh: ${targets[0].subject}`)
console.log('Tidak ada email yang dikirim dan tidak ada data yang diubah.')
