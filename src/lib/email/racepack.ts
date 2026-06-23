import nodemailer from 'nodemailer'
import {
  findPaidParticipantsForRacepackEmail,
  updateParticipantIds,
  findPaidFamilyParticipantsForRacepackEmail,
  updateFamilyParticipantIds,
} from '@/lib/db'
import { readAdminSettings } from '@/lib/admin/settings'
import { DEFAULT_EMAIL_TEMPLATE_SETTINGS, type EmailTemplateSettings } from '@/lib/admin/settings-schema'

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

function safeFilename(value: string | null | undefined) {
  return String(value || 'peserta')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'peserta'
}

function renderCommunityEmail(communityNameValue: string, leaderName: string, participants: RacepackParticipant[], template?: EmailTemplateSettings['community']) {
  const communityName = escapeHtml(communityNameValue || 'Komunitas TOPSELL RUN')
  const leader = escapeHtml(leaderName || communityNameValue || 'Komunitas')
  
  const variables = {
    communityName: communityName,
    leaderName: leader,
    participantCount: String(participants.length),
  }
  
  const greeting = template ? applyEmailVariables(template.greeting, variables) : `Halo <strong>${communityName}</strong>,`
  const bodyIntro = template ? applyEmailVariables(template.bodyIntro, variables) : 'Pembayaran komunitas untuk TOPSELL RUN 2026 sudah kami terima. Race Pass peserta sudah aktif.'
  const bodyOutro = template ? applyEmailVariables(template.bodyOutro, variables) : 'Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️'
  
  const rows = participants.map((participant, index) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280">${index + 1}</td>
      <td style="padding:6px 12px 6px 0"><strong>${escapeHtml(participant.full_name)}</strong></td>
      <td style="padding:6px 12px 6px 0">${escapeHtml(participant.bib_name)}</td>
      <td style="padding:6px 0"><strong>${escapeHtml(participant.participant_code || '-')}</strong></td>
    </tr>
  `).join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;color:#f97316">Pembayaran TOPSELL RUN 2026 Diterima</h2>
      <p>${greeting}</p>
      <p>${bodyIntro}</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <thead>
          <tr>
            <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280">#</th>
            <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280">Peserta</th>
            <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280">Nama BIB</th>
            <th style="padding:6px 0;text-align:left;color:#6b7280">Nomor BIB</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>${bodyOutro}</p>
      <p style="font-size:12px;color:#6b7280;margin-top:16px">Email ini dikirim otomatis oleh sistem TOPSELL RUN 2026.</p>
    </div>
  `
}

async function sendCommunityRacepackEmail(communityEmail: string, communityName: string, leaderName: string, participants: RacepackParticipant[]) {
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
    html: renderCommunityEmail(communityName, leaderName, participants, emailSettings.community),
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

  try {
    await sendCommunityRacepackEmail(
      communityEmail, 
      community?.name || 'Komunitas TOPSELL RUN', 
      community?.leader_name || community?.name || 'Ketua Komunitas',
      normalizedParticipants
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

function renderFamilyEmail(familyNameValue: string, leaderName: string, participants: RacepackFamilyParticipant[], template?: EmailTemplateSettings['family']) {
  const familyName = escapeHtml(familyNameValue || 'Brother & Sister TOPSELL RUN')
  const leader = escapeHtml(leaderName || familyNameValue || 'Keluarga')
  
  const variables = {
    familyName: familyName,
    leaderName: leader,
    participantCount: String(participants.length),
  }
  
  const greeting = template ? applyEmailVariables(template.greeting, variables) : `Halo <strong>${familyName}</strong>,`
  const bodyIntro = template ? applyEmailVariables(template.bodyIntro, variables) : 'Pembayaran Brother & Sister Package untuk TOPSELL RUN 2026 sudah kami terima. Race Pass peserta sudah aktif.'
  const bodyOutro = template ? applyEmailVariables(template.bodyOutro, variables) : 'Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️'
  
  const rows = participants.map((participant, index) => `
    <tr>
      <td style="padding:6px 12px 6px 0;color:#6b7280">${index + 1}</td>
      <td style="padding:6px 12px 6px 0"><strong>${escapeHtml(participant.full_name)}</strong></td>
      <td style="padding:6px 12px 6px 0">${escapeHtml(participant.bib_name)}</td>
      <td style="padding:6px 0"><strong>${escapeHtml(participant.participant_code || '-')}</strong></td>
    </tr>
  `).join('')

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;color:#f97316">Pembayaran TOPSELL RUN 2026 Diterima</h2>
      <p>${greeting}</p>
      <p>${bodyIntro}</p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <thead>
          <tr>
            <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280">#</th>
            <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280">Peserta</th>
            <th style="padding:6px 12px 6px 0;text-align:left;color:#6b7280">Nama BIB</th>
            <th style="padding:6px 0;text-align:left;color:#6b7280">Nomor BIB</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p>${bodyOutro}</p>
      <p style="font-size:12px;color:#6b7280;margin-top:16px">Email ini dikirim otomatis oleh sistem TOPSELL RUN 2026.</p>
    </div>
  `
}

async function sendFamilyRacepackEmail(familyEmail: string, familyName: string, leaderName: string, participants: RacepackFamilyParticipant[]) {
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
    html: renderFamilyEmail(familyName, leaderName, participants, emailSettings.family),
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

  try {
    await sendFamilyRacepackEmail(
      familyEmail, 
      family?.name || 'Brother & Sister TOPSELL RUN', 
      family?.leader_name || family?.name || 'Perwakilan',
      normalizedParticipants
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
