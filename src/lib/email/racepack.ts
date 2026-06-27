import nodemailer from 'nodemailer'
import {
  findPaidParticipantsForRacepackEmail,
  updateParticipantIds,
  findPaidFamilyParticipantsForRacepackEmail,
  updateFamilyParticipantIds,
  findPaymentsByRegistrationIds,
  findFamilyPaymentsByRegistrationIds,
} from '@/lib/db'
import { readAdminSettings } from '@/lib/admin/settings'
import { DEFAULT_EMAIL_TEMPLATE_SETTINGS, type EmailTemplateSettings } from '@/lib/admin/settings-schema'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Payment, FamilyPayment } from '@/lib/types'

type RacepackParticipant = {
  id: string
  full_name: string
  bib_name: string
  participant_code: string | null
  qr_code_data: string | null
  racepack_email_sent_at?: string | null
  community: {
    name: string
    leader_name?: string
    community_code: string
    email: string | null
  } | null
}

type RacepackFamilyParticipant = {
  id: string
  full_name: string
  bib_name: string
  participant_code: string | null
  qr_code_data: string | null
  racepack_email_sent_at?: string | null
  family: {
    name: string
    leader_name?: string
    family_code: string
    email: string | null
  } | null
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

function escapeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
    'QRIS': 'QRIS',
  }
  return map[method] || method
}

function renderReceiptSection(code: string, payment: Payment | FamilyPayment) {
  return `
    <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:20px;border:1px solid #e5e7eb">
      <h4 style="margin:0 0 10px;font-size:13px;font-weight:900;color:#374151;text-transform:uppercase;letter-spacing:0.5px">Detail Pembayaran</h4>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:12px">Kode</td>
          <td style="padding:5px 0;text-align:right;font-size:12px;font-weight:700;color:#ff6a00">${escapeHtml(code)}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:12px">No. Referensi</td>
          <td style="padding:5px 0;text-align:right;font-size:12px;font-weight:700">${escapeHtml(payment.payment_reference)}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:12px">Tanggal</td>
          <td style="padding:5px 0;text-align:right;font-size:12px;font-weight:700">${payment.paid_at ? escapeHtml(formatDate(payment.paid_at)) : '—'}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:12px">Metode</td>
          <td style="padding:5px 0;text-align:right;font-size:12px;font-weight:700">${escapeHtml(formatPaymentMethod(payment.payment_method))}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#6b7280;font-size:12px">Status</td>
          <td style="padding:5px 0;text-align:right;font-size:12px;font-weight:900;color:#22c55e">✓ LUNAS</td>
        </tr>
      </table>
    </div>
  `
}

function renderTotalSection(amount: number) {
  return `
    <div style="background:#fff7ed;padding:14px 16px;border-radius:8px;border-top:2px solid #ff6a00;margin:16px 0">
      <table style="width:100%">
        <tr>
          <td style="font-weight:900;color:#111827">Total Pembayaran</td>
          <td style="text-align:right;font-size:20px;font-weight:900;color:#ff6a00">${escapeHtml(formatCurrency(amount))}</td>
        </tr>
      </table>
    </div>
  `
}

function renderCommunityEmail(
  communityNameValue: string,
  leaderName: string,
  participants: RacepackParticipant[],
  payment: Payment | null | undefined,
  template?: EmailTemplateSettings['community']
) {
  const communityName = escapeHtml(communityNameValue || 'Komunitas TOPSELL RUN')
  const leader = escapeHtml(leaderName || communityNameValue || 'Komunitas')

  const variables = {
    communityName: communityName,
    leaderName: leader,
    participantCount: String(participants.length),
  }

  const greeting = template ? applyEmailVariables(template.greeting, variables) : `Halo <strong>${communityName}</strong>,`
  const bodyIntro = template ? applyEmailVariables(template.bodyIntro, variables) : 'Pembayaran komunitas untuk TOPSELL RUN 2026 sudah kami terima. Kode QR untuk pengambilan racepack akan dikirimkan maksimal H-5 sebelum tanggal pengambilan racepack.'
  const bodyOutro = template ? applyEmailVariables(template.bodyOutro, variables) : 'Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️'

  const communityCode = participants[0]?.community?.community_code || '-'

  const rows = participants.map((participant, index) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280">${index + 1}</td>
      <td style="padding:6px 12px 6px 0"><strong>${escapeHtml(participant.full_name)}</strong></td>
      <td style="padding:6px 12px 6px 0">${escapeHtml(participant.bib_name)}</td>
      <td style="padding:6px 0"><strong>${escapeHtml(participant.participant_code || '-')}</strong></td>
    </tr>
  `).join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(90deg, #ff2a44, #ff6a00);padding:20px;text-align:center;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px">Pembayaran Diterima</h2>
        <p style="margin:5px 0 0;color:#fff;opacity:.8;font-size:12px">TOPSELL RUN 2026</p>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p style="margin:0 0 8px">${greeting}</p>
        <p style="margin:0 0 20px;color:#374151">${bodyIntro}</p>

        ${payment ? renderReceiptSection(communityCode, payment) : ''}

        <h4 style="margin:0 0 10px;font-size:14px;font-weight:900">Detail Peserta</h4>
        <table style="border-collapse:collapse;width:100%;margin-bottom:4px">
          <thead>
            <tr style="border-bottom:2px solid #f3f4f6">
              <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">#</th>
              <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Peserta</th>
              <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Nama BIB</th>
              <th style="padding:6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Nomor BIB</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${payment ? renderTotalSection(payment.amount) : ''}

        <p style="margin:20px 0 0">${bodyOutro}</p>
        <p style="font-size:12px;color:#6b7280;margin-top:16px">
          Email ini adalah bukti pembayaran resmi. Simpan sebagai referensi Anda.<br/>
          Email ini dikirim otomatis oleh sistem TOPSELL RUN 2026.
        </p>
      </div>
    </div>
  `
}

async function sendCommunityRacepackEmail(
  communityEmail: string,
  communityName: string,
  leaderName: string,
  participants: RacepackParticipant[],
  payment: Payment | null | undefined
) {
  const config = getSmtpConfig()
  const transporter = createTransporter()
  const emailSettings = await getEmailTemplateSettings()

  const variables = {
    communityName: escapeHtml(communityName),
    leaderName: escapeHtml(leaderName),
    participantCount: String(participants.length),
  }

  const subject = applyEmailVariables(emailSettings.community.subject, variables)

  await transporter.sendMail({
    from: config.from,
    to: communityEmail,
    subject,
    html: renderCommunityEmail(communityName, leaderName, participants, payment, emailSettings.community),
  })
}

export async function sendRacepackEmailsForRegistration(registrationId: string) {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping racepack emails.')
    return { skipped: true, sent: 0, failed: 0 }
  }

  const normalizedParticipants = await findPaidParticipantsForRacepackEmail(registrationId) as RacepackParticipant[]

  if (normalizedParticipants.length === 0) {
    return { skipped: false, sent: 0, failed: 0 }
  }

  const community = normalizedParticipants[0].community
  const communityEmail = community?.email
  const participantIds = normalizedParticipants.map((participant) => participant.id)

  if (!communityEmail) {
    const message = 'Email komunitas belum tersedia.'
    await updateParticipantIds(participantIds, { racepack_email_error: message })
    return { skipped: false, sent: 0, failed: normalizedParticipants.length }
  }

  // Fetch payment data for receipt section
  let payment: Payment | null = null
  try {
    const payments = await findPaymentsByRegistrationIds([registrationId])
    payment = payments.find(p => p.status === 'paid') || payments[0] || null
  } catch {
    // Payment data is optional — email still sent without it
  }

  try {
    await sendCommunityRacepackEmail(
      communityEmail,
      community?.name || 'Komunitas TOPSELL RUN',
      community?.leader_name || community?.name || 'Ketua Komunitas',
      normalizedParticipants,
      payment
    )
    await updateParticipantIds(participantIds, {
      racepack_email_sent_at: new Date().toISOString(),
      racepack_email_error: null,
    })
    return { skipped: false, sent: normalizedParticipants.length, failed: 0 }
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : 'Gagal mengirim email ke komunitas'
    await updateParticipantIds(participantIds, { racepack_email_error: message })
    return { skipped: false, sent: 0, failed: normalizedParticipants.length }
  }
}

function renderFamilyEmail(
  familyNameValue: string,
  leaderName: string,
  participants: RacepackFamilyParticipant[],
  payment: FamilyPayment | null | undefined,
  template?: EmailTemplateSettings['family']
) {
  const familyName = escapeHtml(familyNameValue || 'Brother & Sister TOPSELL RUN')
  const leader = escapeHtml(leaderName || familyNameValue || 'Keluarga')

  const variables = {
    familyName: familyName,
    leaderName: leader,
    participantCount: String(participants.length),
  }

  const greeting = template ? applyEmailVariables(template.greeting, variables) : `Halo <strong>${familyName}</strong>,`
  const bodyIntro = template ? applyEmailVariables(template.bodyIntro, variables) : 'Pembayaran Brother & Sister Package untuk TOPSELL RUN 2026 sudah kami terima. Kode QR untuk pengambilan racepack akan dikirimkan maksimal H-5 sebelum tanggal pengambilan racepack.'
  const bodyOutro = template ? applyEmailVariables(template.bodyOutro, variables) : 'Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️'

  const familyCode = participants[0]?.family?.family_code || '-'

  const rows = participants.map((participant, index) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280">${index + 1}</td>
      <td style="padding:6px 12px 6px 0"><strong>${escapeHtml(participant.full_name)}</strong></td>
      <td style="padding:6px 12px 6px 0">${escapeHtml(participant.bib_name)}</td>
      <td style="padding:6px 0"><strong>${escapeHtml(participant.participant_code || '-')}</strong></td>
    </tr>
  `).join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(90deg, #ff2a44, #ff6a00);padding:20px;text-align:center;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:2px">Pembayaran Diterima</h2>
        <p style="margin:5px 0 0;color:#fff;opacity:.8;font-size:12px">TOPSELL RUN 2026</p>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
        <p style="margin:0 0 8px">${greeting}</p>
        <p style="margin:0 0 20px;color:#374151">${bodyIntro}</p>

        ${payment ? renderReceiptSection(familyCode, payment) : ''}

        <h4 style="margin:0 0 10px;font-size:14px;font-weight:900">Detail Peserta</h4>
        <table style="border-collapse:collapse;width:100%;margin-bottom:4px">
          <thead>
            <tr style="border-bottom:2px solid #f3f4f6">
              <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">#</th>
              <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Peserta</th>
              <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Nama BIB</th>
              <th style="padding:6px 0;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase">Nomor BIB</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${payment ? renderTotalSection(payment.amount) : ''}

        <p style="margin:20px 0 0">${bodyOutro}</p>
        <p style="font-size:12px;color:#6b7280;margin-top:16px">
          Email ini adalah bukti pembayaran resmi. Simpan sebagai referensi Anda.<br/>
          Email ini dikirim otomatis oleh sistem TOPSELL RUN 2026.
        </p>
      </div>
    </div>
  `
}

async function sendFamilyRacepackEmail(
  familyEmail: string,
  familyName: string,
  leaderName: string,
  participants: RacepackFamilyParticipant[],
  payment: FamilyPayment | null | undefined
) {
  const config = getSmtpConfig()
  const transporter = createTransporter()
  const emailSettings = await getEmailTemplateSettings()

  const variables = {
    familyName: escapeHtml(familyName),
    leaderName: escapeHtml(leaderName),
    participantCount: String(participants.length),
  }

  const subject = applyEmailVariables(emailSettings.family.subject, variables)

  await transporter.sendMail({
    from: config.from,
    to: familyEmail,
    subject,
    html: renderFamilyEmail(familyName, leaderName, participants, payment, emailSettings.family),
  })
}

export async function sendFamilyRacepackEmailsForRegistration(registrationId: string) {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping racepack emails.')
    return { skipped: true, sent: 0, failed: 0 }
  }

  const normalizedParticipants = await findPaidFamilyParticipantsForRacepackEmail(registrationId) as RacepackFamilyParticipant[]

  if (normalizedParticipants.length === 0) {
    return { skipped: false, sent: 0, failed: 0 }
  }

  const family = normalizedParticipants[0].family
  const familyEmail = family?.email
  const participantIds = normalizedParticipants.map((participant) => participant.id)

  if (!familyEmail) {
    const message = 'Email perwakilan belum tersedia.'
    await updateFamilyParticipantIds(participantIds, { racepack_email_error: message })
    return { skipped: false, sent: 0, failed: normalizedParticipants.length }
  }

  // Fetch payment data for receipt section
  let payment: FamilyPayment | null = null
  try {
    const payments = await findFamilyPaymentsByRegistrationIds([registrationId])
    payment = payments.find(p => p.status === 'paid') || payments[0] || null
  } catch {
    // Payment data is optional — email still sent without it
  }

  try {
    await sendFamilyRacepackEmail(
      familyEmail,
      family?.name || 'Brother & Sister TOPSELL RUN',
      family?.leader_name || family?.name || 'Perwakilan',
      normalizedParticipants,
      payment
    )
    await updateFamilyParticipantIds(participantIds, {
      racepack_email_sent_at: new Date().toISOString(),
      racepack_email_error: null,
    })
    return { skipped: false, sent: normalizedParticipants.length, failed: 0 }
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : 'Gagal mengirim email ke perwakilan'
    await updateFamilyParticipantIds(participantIds, { racepack_email_error: message })
    return { skipped: false, sent: 0, failed: normalizedParticipants.length }
  }
}
