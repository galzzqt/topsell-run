import { phoneToWhatsAppId } from '@/lib/utils/phone-auth'

type WebhookKind = 'registration' | 'racepack'

function getWebhookConfig(kind: WebhookKind) {
  const prefix = kind === 'registration' ? 'GHL_REGISTRATION' : 'GHL_QR'
  return {
    url: process.env[`${prefix}_WEBHOOK_URL`] || '',
    token: process.env[`${prefix}_WEBHOOK_TOKEN`] || '',
  }
}

async function postWebhook(kind: WebhookKind, payload: Record<string, unknown>) {
  const config = getWebhookConfig(kind)
  if (!config.url) {
    console.warn(`${kind.toUpperCase()} GHL webhook URL is not configured.`)
    return { skipped: true }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`
  }

  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`GHL webhook failed: ${response.status} ${text.slice(0, 300)}`)
  }

  return { skipped: false }
}

export async function sendRegistrationConfirmationWebhook(payload: {
  phone: string
  communityName: string
  leaderName: string
  participantCount: number
}) {
  return postWebhook('registration', {
    event: 'registration_confirmation',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    community_name: payload.communityName,
    leader_name: payload.leaderName,
    participant_count: payload.participantCount,
    message: `Pendaftaran komunitas ${payload.communityName} untuk TOPSELL RUN 2026 sudah diterima dengan ${payload.participantCount} peserta. Silakan masuk ke dashboard dan lakukan pembayaran agar Race Pass dan QR racepack peserta aktif.`,
  })
}

export async function sendFamilyRegistrationConfirmationWebhook(payload: {
  phone: string
  familyName: string
  representativeName: string
  participantCount: number
}) {
  return postWebhook('registration', {
    event: 'registration_confirmation',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    community_name: payload.familyName,
    leader_name: payload.representativeName,
    participant_count: payload.participantCount,
    message: `Pendaftaran Bro & Sist Package ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima dengan ${payload.participantCount} anggota. Silakan masuk ke dashboard dan lakukan pembayaran agar Race Pass dan QR racepack aktif.`,
  })
}

export async function sendRacepackWebhook(payload: {
  phone: string
  email: string
  leaderName: string
  participantCount: number
  communityName: string
  communityCode: string
}) {
  return postWebhook('racepack', {
    event: 'payment_received_check_email',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    leader_name: payload.leaderName,
    participant_count: payload.participantCount,
    community_name: payload.communityName,
    community_code: payload.communityCode,
    message: `Pembayaran komunitas ${payload.communityName} untuk TOPSELL RUN 2026 sudah diterima. QR Code pengambilan racepack untuk ${payload.participantCount} peserta sudah dikirim ke email komunitas ${payload.email}. Setiap file QR dinamai sesuai nama peserta. Silakan cek inbox atau folder spam/promosi.`,
  })
}

export async function sendFamilyRacepackWebhook(payload: {
  phone: string
  email: string
  representativeName: string
  participantCount: number
  familyName: string
  familyCode: string
}) {
  return postWebhook('racepack', {
    event: 'payment_received_check_email',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    leader_name: payload.representativeName,
    participant_count: payload.participantCount,
    community_name: payload.familyName,
    community_code: payload.familyCode,
    message: `Pembayaran Bro & Sist Package ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. QR Code pengambilan racepack untuk ${payload.participantCount} anggota sudah dikirim ke email ${payload.email}. Setiap file QR dinamai sesuai nama peserta. Silakan cek inbox atau folder spam/promosi.`,
  })
}
