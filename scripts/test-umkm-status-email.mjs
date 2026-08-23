/**
 * Keputusan status tenant UMKM harus selalu dikabarkan ke tenant-nya.
 *
 * Cek statis — bukan isi emailnya, melainkan kabelnya: modul email boleh saja
 * ada tapi tidak pernah dipanggil (persis bug yang ditambal skrip ini), jadi
 * yang dijaga adalah panggilan dari updateAdminUmkmStatus.
 *
 * Usage: node scripts/test-umkm-status-email.mjs
 */

import { readFileSync } from 'fs'
import assert from 'assert'

const emailModule = readFileSync('src/lib/email/umkm.ts', 'utf8')
const adminActions = readFileSync('src/app/admin/actions.ts', 'utf8')
const ghlWebhook = readFileSync('src/lib/ghl/webhook.ts', 'utf8')

// --- A: modul email menyediakan kedua keputusan ---
assert.ok(
  /export async function sendUmkmStatusEmail\(/.test(emailModule),
  'sendUmkmStatusEmail harus diekspor dari src/lib/email/umkm.ts',
)
assert.ok(emailModule.includes('renderUmkmApprovalEmail'), 'template approved hilang')
assert.ok(emailModule.includes('renderUmkmRejectionEmail'), 'template rejected hilang')
console.log('OK  A1  modul email UMKM punya template approved & rejected')

// Data dari pendaftar wajib lewat escapeHtml sebelum masuk HTML email.
const interpolations = emailModule.match(/\$\{(?!escapeHtml|callToAction|noteBlock|appUrl)[a-zA-Z]/g) || []
assert.strictEqual(
  interpolations.length,
  0,
  `ada nilai yang masuk HTML email tanpa escapeHtml: ${interpolations.join(', ')}`,
)
console.log('OK  A2  semua data pendaftar di-escape sebelum masuk HTML')

// --- B: admin benar-benar memanggilnya ---
assert.ok(
  adminActions.includes("import { sendUmkmStatusEmail } from '@/lib/email/umkm'"),
  'admin actions belum mengimpor sendUmkmStatusEmail',
)

const start = adminActions.indexOf('export async function updateAdminUmkmStatus(')
assert.ok(start > -1, 'updateAdminUmkmStatus tidak ditemukan — pola pencarian mungkin sudah usang')
const body = adminActions.slice(start, adminActions.indexOf('\nexport ', start + 1))

assert.ok(
  /await sendUmkmStatusEmail\(umkmId, status, statusNote\)/.test(body),
  'updateAdminUmkmStatus harus mengabari tenant setelah status diubah',
)
console.log('OK  B1  updateAdminUmkmStatus memanggil sendUmkmStatusEmail')

// --- C: kegagalan email tidak boleh membatalkan keputusan yang sudah tersimpan ---
const callIndex = body.indexOf('await sendUmkmStatusEmail(')
const tryIndex = body.lastIndexOf('try {', callIndex)
const catchIndex = body.indexOf('catch', callIndex)
assert.ok(tryIndex > -1 && catchIndex > -1, 'panggilan email harus dibungkus try/catch')
console.log('OK  C1  gagal kirim email tidak membatalkan approval')

// Status sudah tersimpan sebelum email dikirim, bukan sesudah.
assert.ok(
  body.indexOf('await updateUmkm(') < callIndex,
  'status harus tersimpan ke DB sebelum email dikirim',
)
console.log('OK  C2  status tersimpan lebih dulu, email menyusul')

// --- D: WhatsApp lewat GHL, khusus approved ---
assert.ok(
  /export async function sendUmkmApprovalWebhook\(/.test(ghlWebhook),
  'sendUmkmApprovalWebhook harus diekspor dari src/lib/ghl/webhook.ts',
)
assert.ok(
  /postWebhook\('registration', 'umkm',/.test(ghlWebhook),
  "webhook UMKM harus memakai slot pengaturan paket 'umkm'",
)
console.log('OK  D1  modul GHL punya webhook approval UMKM')

const webhookCall = body.indexOf('await sendUmkmApprovalWebhook(')
assert.ok(webhookCall > -1, 'updateAdminUmkmStatus harus mengirim webhook WA saat approve')

// Penolakan tidak boleh ikut terkirim ke GHL — hanya approved.
const guard = body.lastIndexOf("if (status === 'approved')", webhookCall)
assert.ok(guard > -1, "panggilan webhook harus dipagari if (status === 'approved')")
assert.ok(
  body.lastIndexOf('try {', webhookCall) > guard,
  'panggilan webhook harus di dalam try/catch setelah pagar approved',
)
console.log('OK  D2  webhook hanya jalan untuk approved, dibungkus try/catch')

// Email tetap jalan untuk kedua status — pagar approved tidak boleh menelannya.
assert.ok(callIndex < guard, 'email status harus dikirim sebelum (dan di luar) pagar approved')
console.log('OK  D3  email tetap terkirim untuk approved maupun rejected')

console.log('\nSemua cek notifikasi status tenant UMKM lolos.')
