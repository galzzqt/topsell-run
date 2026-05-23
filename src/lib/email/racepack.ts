import nodemailer from 'nodemailer'
import QRCode from 'qrcode'
import { createAdminClient } from '@/lib/supabase/server'

type RacepackParticipant = {
  id: string
  full_name: string
  bib_name: string
  participant_code: string | null
  qr_code_data: string | null
  racepack_email_sent_at?: string | null
  community:
    | {
        name: string
        community_code: string
        email: string | null
      }
    | {
        name: string
        community_code: string
        email: string | null
      }[]
    | null
}

function getCommunity(participant: RacepackParticipant) {
  return Array.isArray(participant.community) ? participant.community[0] || null : participant.community
}

type NormalizedRacepackParticipant = Omit<RacepackParticipant, 'community'> & {
  community: {
    name: string
    community_code: string
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

function renderCommunityEmail(communityNameValue: string, participants: NormalizedRacepackParticipant[]) {
  const communityName = escapeHtml(communityNameValue || 'Komunitas TOPSELL RUN')
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
      <p>Halo <strong>${communityName}</strong>,</p>
      <p>Pembayaran komunitas untuk TOPSELL RUN 2026 sudah kami terima. Race Pass peserta sudah aktif.</p>
      <p>QR Code untuk pengambilan racepack terlampir di email ini. Setiap file QR dinamai sesuai nama peserta dan nomor BIB.</p>
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
      <p>Silakan distribusikan QR Code ke masing-masing peserta sesuai nama file.</p>
      <p style="font-size:12px;color:#6b7280">Email ini dikirim otomatis oleh sistem TOPSELL RUN 2026.</p>
    </div>
  `
}

async function sendCommunityRacepackEmail(communityEmail: string, communityName: string, participants: NormalizedRacepackParticipant[]) {
  const config = getSmtpConfig()
  const transporter = createTransporter()
  const attachments = await Promise.all(participants.map(async (participant) => {
    if (!participant.qr_code_data) {
      throw new Error(`QR peserta ${participant.full_name} belum tersedia.`)
    }

    const qrPng = await QRCode.toBuffer(participant.qr_code_data, {
      type: 'png',
      width: 360,
      margin: 2,
    })

    const code = safeFilename(participant.participant_code || participant.id)
    const name = safeFilename(participant.full_name)

    return {
      filename: `${name}-${code}.png`,
      content: qrPng,
      contentType: 'image/png',
    }
  }))

  await transporter.sendMail({
    from: config.from,
    to: communityEmail,
    subject: `Pembayaran Diterima - QR Racepack ${communityName}`,
    html: renderCommunityEmail(communityName, participants),
    attachments,
  })
}

export async function sendRacepackEmailsForRegistration(registrationId: string) {
  if (!isEmailConfigured()) {
    console.warn('SMTP is not configured. Skipping racepack emails.')
    return { skipped: true, sent: 0, failed: 0 }
  }

  const supabase = createAdminClient()
  const { data: participants, error } = await supabase
    .from('participants')
    .select('id, full_name, bib_name, participant_code, qr_code_data, racepack_email_sent_at, community:communities(name, community_code, email)')
    .eq('registration_id', registrationId)
    .eq('payment_status', 'paid')
    .is('racepack_email_sent_at', null)

  if (error) {
    console.error('Failed to load participants for racepack email:', error.message)
    return { skipped: false, sent: 0, failed: 0 }
  }

  const normalizedParticipants = ((participants || []) as RacepackParticipant[]).map((participantRow) => ({
    ...participantRow,
    community: getCommunity(participantRow),
  }))

  if (normalizedParticipants.length === 0) {
    return { skipped: false, sent: 0, failed: 0 }
  }

  const community = normalizedParticipants[0].community
  const communityEmail = community?.email
  const participantIds = normalizedParticipants.map((participant) => participant.id)

  if (!communityEmail) {
    const message = 'Email komunitas belum tersedia.'
    await supabase
      .from('participants')
      .update({ racepack_email_error: message })
      .in('id', participantIds)
    return { skipped: false, sent: 0, failed: normalizedParticipants.length }
  }

  try {
    await sendCommunityRacepackEmail(communityEmail, community?.name || 'Komunitas TOPSELL RUN', normalizedParticipants)
    await supabase
      .from('participants')
      .update({ racepack_email_sent_at: new Date().toISOString(), racepack_email_error: null })
      .in('id', participantIds)
    return { skipped: false, sent: normalizedParticipants.length, failed: 0 }
  } catch (sendError) {
    const message = sendError instanceof Error ? sendError.message : 'Gagal mengirim email ke komunitas'
    await supabase
      .from('participants')
      .update({ racepack_email_error: message })
      .in('id', participantIds)
    return { skipped: false, sent: 0, failed: normalizedParticipants.length }
  }
}
