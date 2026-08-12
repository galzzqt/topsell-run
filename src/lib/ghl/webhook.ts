import { phoneToWhatsAppId } from '@/lib/utils/phone-auth'
import { readAdminSettings } from '@/lib/admin/settings'
import type { PackageKey } from '@/lib/admin/settings-schema'

type WebhookKind = 'registration' | 'racepack'

/** Webhook URL/token per paket dari pengaturan admin; fallback ke env var global (GHL_*) kalau belum diatur. */
async function getWebhookConfig(kind: WebhookKind, packageType: PackageKey) {
  const settingKind = kind === 'registration' ? 'registration' : 'payment'

  try {
    const settings = await readAdminSettings()
    const configured = settings.webhookSettings[packageType][settingKind]
    if (configured.url) return configured
  } catch {
    // Fall through to env fallback.
  }

  const prefix = packageType === 'pacer'
    ? (kind === 'registration' ? 'GHL_PACER_REGISTRATION' : 'GHL_PACER_QR')
    : (kind === 'registration' ? 'GHL_REGISTRATION' : 'GHL_QR')
  return {
    url: process.env[`${prefix}_WEBHOOK_URL`] || '',
    token: process.env[`${prefix}_WEBHOOK_TOKEN`] || '',
  }
}

async function postWebhook(kind: WebhookKind, packageType: PackageKey, payload: Record<string, unknown>) {
  const config = await getWebhookConfig(kind, packageType)
  if (!config.url) {
    console.warn(`${kind.toUpperCase()} GHL webhook URL is not configured for package "${packageType}".`)
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
  return postWebhook('registration', 'community', {
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
  return postWebhook('registration', 'family', {
    event: 'registration_confirmation',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    community_name: payload.familyName,
    leader_name: payload.representativeName,
    participant_count: payload.participantCount,
    message: `Pendaftaran Bro & Sist Package ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima dengan ${payload.participantCount} anggota. Silakan masuk ke dashboard dan lakukan pembayaran agar Race Pass dan QR racepack aktif.`,
  })
}

export async function sendIndividualRegistrationConfirmationWebhook(payload: {
  phone: string
  familyName: string
  representativeName: string
  participantCount: number
}) {
  return postWebhook('registration', 'individual', {
    event: 'registration_confirmation',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    community_name: payload.familyName,
    leader_name: payload.representativeName,
    participant_count: payload.participantCount,
    message: `Pendaftaran individu ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. Silakan masuk ke dashboard dan lakukan pembayaran agar Race Pass dan QR racepack aktif.`,
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
  return postWebhook('racepack', 'community', {
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
  return postWebhook('racepack', 'family', {
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

export async function sendIndividualRacepackWebhook(payload: {
  phone: string
  email: string
  representativeName: string
  participantCount: number
  familyName: string
  familyCode: string
}) {
  return postWebhook('racepack', 'individual', {
    event: 'payment_received_check_email',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    leader_name: payload.representativeName,
    participant_count: payload.participantCount,
    community_name: payload.familyName,
    community_code: payload.familyCode,
    message: `Pembayaran individu ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. QR Code pengambilan racepack sudah dikirim ke email ${payload.email}. Silakan cek inbox atau folder spam/promosi.`,
  })
}

export async function sendPacerRegistrationWebhook(payload: {
  phone: string
  email: string
  fullName: string
  category: string
  pacerCode?: string
  status: string
  instagram?: string
  tiktok?: string
  stravaLink?: string
  stravaUsername?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountHolder?: string
  hasSmartwatch?: string
  age?: number
  provinsi?: string
  kota?: string
  kecamatan?: string
  mediaUrls?: string[]
  pbMediaUrls?: string[]
}) {
  return postWebhook('registration', 'pacer', {
    event: 'pacer_registration',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    full_name: payload.fullName,
    category: payload.category,
    pacer_code: payload.pacerCode || '',
    status: payload.status,
    instagram: payload.instagram || '',
    tiktok: payload.tiktok || '',
    strava_link: payload.stravaLink || '',
    strava_username: payload.stravaUsername || '',
    bank_name: payload.bankName || '',
    bank_account_number: payload.bankAccountNumber || '',
    bank_account_holder: payload.bankAccountHolder || '',
    has_smartwatch: payload.hasSmartwatch || '',
    age: payload.age || 0,
    provinsi: payload.provinsi || '',
    kota: payload.kota || '',
    kecamatan: payload.kecamatan || '',
    media_urls: payload.mediaUrls || [],
    media_urls_string: payload.mediaUrls ? payload.mediaUrls.join(', ') : '',
    pb_media_urls: payload.pbMediaUrls || [],
    pb_media_urls_string: payload.pbMediaUrls ? payload.pbMediaUrls.join(', ') : '',
    message: `Pendaftaran pacer ${payload.fullName} (Kategori: ${payload.category}) telah diterima dengan status ${payload.status.toUpperCase()}.`,
  })
}
