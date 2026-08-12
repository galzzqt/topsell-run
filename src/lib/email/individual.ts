import nodemailer from 'nodemailer'
import {
  findIndividualParticipantsByRegistrationId,
  findIndividualPaymentById,
  findIndividualById,
  findPaidIndividualParticipantsForRacepackEmail,
  updateIndividualParticipantIds,
  findIndividualPaymentsByRegistrationIds,
} from '@/lib/db'
import { readAdminSettings } from '@/lib/admin/settings'
import { DEFAULT_EMAIL_TEMPLATE_SETTINGS, type EmailTemplateSettings } from '@/lib/admin/settings-schema'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { IndividualPayment } from '@/lib/types'

async function getEmailTemplateSettings(): Promise<EmailTemplateSettings> {
  try {
    const settings = await readAdminSettings()
    return settings.emailTemplates || DEFAULT_EMAIL_TEMPLATE_SETTINGS
  } catch {
    return DEFAULT_EMAIL_TEMPLATE_SETTINGS
  }
}

function applyEmailVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}

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
    auth: { user: config.user, pass: config.pass },
  })
}

function escapeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function formatPaymentMethod(method: string | null) {
  if (!method) return '-'
  const map: Record<string, string> = {
    xendit_demo: 'Demo Mode', BCA_VA: 'Virtual Account BCA', BNI_VA: 'Virtual Account BNI',
    BRI_VA: 'Virtual Account BRI', MANDIRI_VA: 'Virtual Account Mandiri', PERMATA_VA: 'Virtual Account Permata', QRIS: 'QRIS',
  }
  return map[method] || method
}

function renderIndividualEmail(
  name: string,
  code: string,
  payment: IndividualPayment,
  participant: { full_name: string; bib_name: string; participant_code: string | null },
  kind: 'receipt' | 'racepack',
  template?: EmailTemplateSettings['individual']
) {
  const title = kind === 'receipt' ? 'E-RECEIPT PEMBAYARAN' : 'PEMBAYARAN DITERIMA'
  const variables = { individualName: escapeHtml(name), individualCode: escapeHtml(code), participantCount: '1' }
  const greeting = kind === 'racepack' && template ? applyEmailVariables(template.greeting, variables) : `Halo <strong>${escapeHtml(name)}</strong>,`
  const intro = kind === 'receipt'
    ? 'Terima kasih atas pembayaran Anda! Berikut adalah e-receipt resmi pembayaran untuk TOPSELL RUN 2026.'
    : template
    ? applyEmailVariables(template.bodyIntro, variables)
    : 'Pembayaran individu untuk TOPSELL RUN 2026 sudah kami terima. Kode QR untuk pengambilan racepack akan dikirimkan maksimal H-5 sebelum tanggal pengambilan racepack.'
  const outro = kind === 'racepack' && template ? applyEmailVariables(template.bodyOutro, variables) : ''
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(90deg,#ff2a44,#ff6a00);padding:20px;text-align:center;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px">${title}</h2>
        <p style="margin:5px 0 0;color:#fff;opacity:.8;font-size:12px">TOPSELL RUN 2026</p>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p style="margin:0 0 20px">${greeting}<br/><br/>${intro}</p>
        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:20px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Kode Peserta</td><td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700;color:#ff6a00">${escapeHtml(code)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">No. Referensi</td><td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">${escapeHtml(payment.payment_reference)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Tanggal</td><td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">${payment.paid_at ? escapeHtml(formatDate(payment.paid_at)) : '—'}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Metode</td><td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">${escapeHtml(formatPaymentMethod(payment.payment_method))}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Nomor BIB</td><td style="padding:6px 0;text-align:right;font-size:12px;font-weight:700">${escapeHtml(participant.participant_code || '-')}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:12px">Status</td><td style="padding:6px 0;text-align:right;font-size:12px;font-weight:900;color:#22c55e">✓ LUNAS</td></tr>
          </table>
        </div>
        <div style="background:#fff7ed;padding:14px 16px;border-radius:8px;border-top:2px solid #ff6a00">
          <table style="width:100%"><tr><td style="font-weight:900">Total Pembayaran</td><td style="text-align:right;font-size:20px;font-weight:900;color:#ff6a00">${escapeHtml(formatCurrency(payment.amount))}</td></tr></table>
        </div>
        ${outro ? `<p style="margin:20px 0 0">${outro}</p>` : ''}
        <p style="margin:20px 0 0;color:#6b7280;font-size:12px">Email ini adalah bukti pembayaran resmi. Simpan sebagai referensi Anda.<br/>Email otomatis dari sistem TOPSELL RUN 2026.</p>
      </div>
    </div>
  `
}

export async function sendIndividualReceiptEmail(registrationId: string) {
  if (!isEmailConfigured()) return { skipped: true }

  const participants = await findIndividualParticipantsByRegistrationId(registrationId)
  if (participants.length === 0) return { error: 'No individual participants found for this registration' }

  const payment = await findIndividualPaymentById(participants[0].registration_id!)
  if (!payment) return { error: 'Payment not found' }

  const individual = await findIndividualById(participants[0].individual_id)
  if (!individual || !individual.email) return { error: 'Individual or email not found' }

  try {
    await createTransporter().sendMail({
      from: getSmtpConfig().from,
      to: individual.email,
      subject: `E-Receipt Pembayaran - TOPSELL RUN 2026 (${individual.individual_code})`,
      html: renderIndividualEmail(individual.name, individual.individual_code, payment, participants[0], 'receipt'),
    })
    return { success: true }
  } catch (error) {
    console.error('Failed to send individual receipt email:', error)
    return { error: error instanceof Error ? error.message : 'Gagal mengirim e-receipt' }
  }
}

export async function sendIndividualRacepackEmailsForRegistration(registrationId: string) {
  if (!isEmailConfigured()) return { skipped: true, sent: 0, failed: 0 }

  const participants = await findPaidIndividualParticipantsForRacepackEmail(registrationId)
  if (participants.length === 0) return { skipped: false, sent: 0, failed: 0 }

  const individual = participants[0].individual
  const email = individual?.email
  const participantIds = participants.map((p) => p.id)

  if (!email) {
    await updateIndividualParticipantIds(participantIds, { racepack_email_error: 'Email peserta belum tersedia.' })
    return { skipped: false, sent: 0, failed: participants.length }
  }

  let payment: IndividualPayment | null = null
  try {
    const payments = await findIndividualPaymentsByRegistrationIds([registrationId])
    payment = payments.find((p) => p.status === 'paid') || payments[0] || null
  } catch {
    // optional
  }
  if (!payment) {
    await updateIndividualParticipantIds(participantIds, { racepack_email_error: 'Data pembayaran belum tersedia.' })
    return { skipped: false, sent: 0, failed: participants.length }
  }

  const emailSettings = await getEmailTemplateSettings()
  const subject = applyEmailVariables(emailSettings.individual.subject, {
    individualName: individual?.name || 'Peserta',
    individualCode: individual?.individual_code || '-',
    participantCount: '1',
  })

  try {
    await createTransporter().sendMail({
      from: getSmtpConfig().from,
      to: email,
      subject,
      html: renderIndividualEmail(individual?.name || 'Peserta', individual?.individual_code || '-', payment, participants[0], 'racepack', emailSettings.individual),
    })
    await updateIndividualParticipantIds(participantIds, {
      racepack_email_sent_at: new Date().toISOString(),
      racepack_email_error: null,
    })
    return { skipped: false, sent: participants.length, failed: 0 }
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : 'Gagal mengirim email ke peserta'
    await updateIndividualParticipantIds(participantIds, { racepack_email_error: message })
    return { skipped: false, sent: 0, failed: participants.length }
  }
}
