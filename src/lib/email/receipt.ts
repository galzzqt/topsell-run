import nodemailer from 'nodemailer'
import {
  findParticipantsByRegistrationId,
  findFamilyParticipantsByRegistrationId,
  findPaymentById,
  findFamilyPaymentById,
  findCommunityById,
  findFamilyById
} from '@/lib/db'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { TOPSELL_RUN_EVENT, Payment, FamilyPayment, Participant, FamilyParticipant } from '@/lib/types'

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
  const config = getSmtpConfig()
  return Boolean(config.host && config.port && config.user && config.pass && config.from)
}

function createTransporter() {
  const config = getSmtpConfig()
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
}

function formatPaymentMethod(method: string | null) {
  if (!method) return '-'
  const map: Record<string, string> = {
    'xendit_demo': 'Demo Mode',
    'BCA_VA': 'Virtual Account BCA',
    'BNI_VA': 'Virtual Account BNI',
    'BRI_VA': 'Virtual Account BRI',
    'MANDIRI_VA': 'Virtual Account Mandiri',
    'PERMATA_VA': 'Virtual Account Permata',
    'QRIS': 'QRIS'
  }
  return map[method] || method
}

function escapeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderReceiptEmail(
  name: string,
  code: string,
  payment: Payment | FamilyPayment,
  participants: (Participant | FamilyParticipant)[],
  type: 'community' | 'family'
) {
  const participantRows = participants.map((p, i) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280">${i + 1}</td>
      <td style="padding:6px 12px 6px 0">
        <strong>${escapeHtml(p.full_name)}</strong><br/>
        <span style="font-size:11px;color:#6b7280">${escapeHtml(p.participant_code || '—')}</span>
      </td>
      <td style="padding:6px 0;text-align:right">${escapeHtml(formatCurrency(TOPSELL_RUN_EVENT.price_per_participant))}</td>
    </tr>
  `).join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(90deg, #ff2a44, #ff6a00);padding:20px;text-align:center;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px">E-RECEIPT PEMBAYARAN</h2>
        <p style="margin:5px 0 0;color:#fff;opacity:80%;font-size:12px">TOPSELL RUN 2026</p>
      </div>
      
      <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p style="margin:0 0 20px">
          Halo <strong>${escapeHtml(name)}</strong>,<br/><br/>
          Terima kasih atas pembayaran Anda! Berikut adalah e-receipt resmi pembayaran untuk TOPSELL RUN 2026.
        </p>

        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">
                ${type === 'community' ? 'Kode Komunitas' : 'Kode Keluarga'}
              </td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700;color:#ff6a00">
                ${escapeHtml(code)}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">No. Referensi</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">
                ${escapeHtml(payment.payment_reference)}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">Tanggal</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">
                ${payment.paid_at ? escapeHtml(formatDate(payment.paid_at)) : '—'}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">Metode</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">
                ${escapeHtml(formatPaymentMethod(payment.payment_method))}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#6b7280;font-size:12px">Status</td>
              <td style="padding:6px 0;text-align:right;font-size:12px;font-weight:900;color:#22c55e;text-transform:uppercase">
                Lunas
              </td>
            </tr>
          </table>
        </div>

        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 10px;font-size:14px;font-weight:900">Detail Peserta</h4>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="border-bottom:2px solid #f3f4f6">
                <th style="padding:8px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">#</th>
                <th style="padding:8px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Nama Peserta</th>
                <th style="padding:8px 0;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase">Harga</th>
              </tr>
            </thead>
            <tbody>
              ${participantRows}
            </tbody>
          </table>
        </div>

        <div style="background:#fff7ed;padding:16px;border-radius:8px;border-top:2px solid #ff6a00">
          <table style="width:100%">
            <tr>
              <td style="font-weight:900">Total Pembayaran</td>
              <td style="text-align:right;font-size:20px;font-weight:900;color:#ff6a00">
                ${escapeHtml(formatCurrency(payment.amount))}
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:20px 0 0;color:#6b7280;font-size:12px">
          E-receipt ini adalah bukti pembayaran resmi. Simpan untuk referensi Anda.<br/>
          Kode QR untuk pengambilan racepack akan dikirimkan terpisah maksimal H-5 sebelum tanggal pengambilan racepack.<br/>
          Jika ada pertanyaan, silakan hubungi tim TOPSELL RUN 2026.
        </p>
      </div>
    </div>
  `
}

export async function sendCommunityReceiptEmail(registrationId: string) {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping receipt email.')
    return { skipped: true }
  }

  const participants = await findParticipantsByRegistrationId(registrationId)
  if (participants.length === 0) {
    return { error: 'No participants found for this registration' }
  }

  const payment = await findPaymentById(participants[0].registration_id!)
  if (!payment) {
    return { error: 'Payment not found' }
  }

  const community = await findCommunityById(participants[0].community_id)
  if (!community || !community.email) {
    return { error: 'Community or email not found' }
  }

  const transporter = createTransporter()

  try {
    await transporter.sendMail({
      from: getSmtpConfig().from,
      to: community.email,
      subject: `E-Receipt Pembayaran - TOPSELL RUN 2026 (${community.community_code})`,
      html: renderReceiptEmail(
        community.name,
        community.community_code,
        payment,
        participants,
        'community'
      )
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to send community receipt email:', error)
    return { error: error instanceof Error ? error.message : 'Gagal mengirim e-receipt' }
  }
}

export async function sendFamilyReceiptEmail(registrationId: string) {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping receipt email.')
    return { skipped: true }
  }

  const participants = await findFamilyParticipantsByRegistrationId(registrationId)
  if (participants.length === 0) {
    return { error: 'No family participants found for this registration' }
  }

  const payment = await findFamilyPaymentById(participants[0].registration_id!)
  if (!payment) {
    return { error: 'Payment not found' }
  }

  const family = await findFamilyById(participants[0].family_id)
  if (!family || !family.email) {
    return { error: 'Family or email not found' }
  }

  const transporter = createTransporter()

  try {
    await transporter.sendMail({
      from: getSmtpConfig().from,
      to: family.email,
      subject: `E-Receipt Pembayaran - TOPSELL RUN 2026 (${family.family_code})`,
      html: renderReceiptEmail(
        family.name,
        family.family_code,
        payment,
        participants,
        'family'
      )
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to send family receipt email:', error)
    return { error: error instanceof Error ? error.message : 'Gagal mengirim e-receipt' }
  }
}
