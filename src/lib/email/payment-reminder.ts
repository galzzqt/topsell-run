import 'server-only'

import nodemailer from 'nodemailer'
import { getDb } from '@/lib/mongodb/client'
import { formatCurrency } from '@/lib/utils/format'

// Reminder pembayaran untuk pendaftaran yang statusnya masih 'pending'.
// Tahap 1: 1 jam setelah daftar. Tahap 2: 5 jam setelah reminder pertama (6 jam setelah daftar).
const STAGE_DELAY_HOURS = [1, 6] as const

type Pool = {
  payments: string
  registrations: string
  owners: string
  ownerIdField: string
  codeField: string
  dashboardPath: string
}

const POOLS: Pool[] = [
  { payments: 'payments', registrations: 'registrations', owners: 'communities', ownerIdField: 'community_id', codeField: 'community_code', dashboardPath: '/community-dashboard' },
  { payments: 'family_payments', registrations: 'family_registrations', owners: 'families', ownerIdField: 'family_id', codeField: 'family_code', dashboardPath: '/dashboard' },
  { payments: 'individual_payments', registrations: 'individual_registrations', owners: 'individuals', ownerIdField: 'individual_id', codeField: 'individual_code', dashboardPath: '/individu-dashboard' },
  { payments: 'invitation_payments', registrations: 'invitation_registrations', owners: 'invitations', ownerIdField: 'invitation_id', codeField: 'invitation_code', dashboardPath: '/invitation-dashboard' },
]

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: Number(process.env.SMTP_PORT || '465'),
    secure: (process.env.SMTP_SECURE || 'true') !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  }
}

function isEmailConfigured() {
  const c = getSmtpConfig()
  return Boolean(c.host && c.port && c.user && c.pass && c.from)
}

function createTransporter() {
  const c = getSmtpConfig()
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    requireTLS: !c.secure,
    auth: { user: c.user, pass: c.pass },
  })
}

function escapeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderReminderEmail(
  name: string,
  code: string,
  amount: number,
  reference: string,
  payUrl: string,
  stage: number
) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(90deg, #ff2a44, #ff6a00);padding:20px;text-align:center;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px">
          ${stage === 1 ? 'Menunggu Pembayaran' : 'Pengingat Terakhir'}
        </h2>
        <p style="margin:5px 0 0;color:#fff;opacity:80%;font-size:12px">TOPSELL RUN 2026</p>
      </div>

      <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px">
          Halo <strong>${escapeHtml(name)}</strong>,<br/><br/>
          Pendaftaran Anda untuk TOPSELL RUN 2026 sudah kami terima, namun pembayarannya
          <strong>belum kami terima</strong>. Mohon segera selesaikan pembayaran karena
          <strong>slot peserta terbatas</strong> dan baru terkunci setelah pembayaran lunas.
        </p>

        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">Kode Pendaftaran</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700;color:#ff6a00">${escapeHtml(code)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">No. Referensi</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">${escapeHtml(reference)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">Total Tagihan</td>
              <td style="padding:6px 0;text-align:right;font-size:16px;font-weight:900;color:#ff6a00">${escapeHtml(formatCurrency(amount))}</td>
            </tr>
          </table>
        </div>

        <p style="text-align:center;margin:0 0 20px">
          <a href="${escapeHtml(payUrl)}" style="display:inline-block;background:#ff6a00;color:#fff;text-decoration:none;font-weight:900;padding:12px 28px;border-radius:8px">
            BAYAR SEKARANG
          </a>
        </p>

        <p style="margin:0;color:#6b7280;font-size:12px">
          Abaikan email ini jika Anda sudah menyelesaikan pembayaran.<br/>
          Jika ada pertanyaan, silakan hubungi tim TOPSELL RUN 2026.
        </p>
      </div>
    </div>
  `
}

export type ReminderTarget = {
  pool: string
  stage: number
  code: string
  email: string
  subject: string
  amount: number
  reference: string
  html: string
}

export async function sendPendingPaymentReminders(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options
  const targets: ReminderTarget[] = []

  if (!dryRun && !isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping payment reminders.')
    return { skipped: true, sent: 0, failed: 0, targets }
  }

  const db = await getDb()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const transporter = dryRun ? null : createTransporter()
  let sent = 0
  let failed = 0

  for (const pool of POOLS) {
    for (const [index, hours] of STAGE_DELAY_HOURS.entries()) {
      const stage = index + 1
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

      // ponytail: batch 200 per pool per run, cukup untuk cron tiap 15 menit
      const payments = await db.collection(pool.payments)
        .find({
          status: 'pending',
          created_at: { $lte: cutoff },
          reminder_stage: stage === 1 ? { $exists: false } : stage - 1,
        })
        .limit(200)
        .toArray()

      for (const payment of payments) {
        const registration = await db.collection(pool.registrations).findOne({ id: payment.registration_id })
        // Hanya kirim jika pendaftaran juga masih pending (bukan paid/expired).
        if (!registration || registration.status !== 'pending') continue

        const owner = await db.collection(pool.owners).findOne({ id: registration[pool.ownerIdField] })
        if (!owner?.email) continue

        const subject = `${stage === 1 ? 'Segera Selesaikan Pembayaran' : 'Pengingat Terakhir - Pembayaran Belum Lunas'} - TOPSELL RUN 2026 (${owner[pool.codeField]})`
        const html = renderReminderEmail(
          String(owner.name || owner.leader_name || 'Peserta'),
          String(owner[pool.codeField] || '—'),
          Number(payment.amount || 0),
          String(payment.payment_reference || '—'),
          (payment.checkout_url as string) || `${appUrl}${pool.dashboardPath}`,
          stage
        )

        if (dryRun) {
          targets.push({
            pool: pool.payments,
            stage,
            code: String(owner[pool.codeField] || '—'),
            email: owner.email as string,
            subject,
            amount: Number(payment.amount || 0),
            reference: String(payment.payment_reference || '—'),
            html,
          })
          continue
        }

        try {
          await transporter!.sendMail({
            from: getSmtpConfig().from,
            to: owner.email as string,
            subject,
            html,
          })
          await db.collection(pool.payments).updateOne(
            { id: payment.id },
            { $set: { reminder_stage: stage, reminder_sent_at: new Date().toISOString() } }
          )
          sent++
        } catch (error) {
          failed++
          console.error(`Failed to send payment reminder (${pool.payments}, stage ${stage}):`, error)
        }
      }
    }
  }

  return { sent, failed, targets }
}
