import { phoneToWhatsAppId } from '@/lib/utils/phone-auth'
import { readAdminSettings } from '@/lib/admin/settings'
import { formatCurrency } from '@/lib/utils/format'
import { DEFAULT_WEBHOOK_SETTINGS, type PackageKey } from '@/lib/admin/settings-schema'

type WebhookKind = 'registration' | 'racepack' | 'status'

/** Webhook URL/token per paket dari pengaturan admin; fallback ke env var global (GHL_*) kalau belum diatur. */
async function getWebhookConfig(kind: WebhookKind, packageType: PackageKey) {
  const settingKind = kind === 'registration' ? 'registration' : kind === 'status' ? 'status' : 'payment'

  try {
    const settings = await readAdminSettings()
    const configured = settings.webhookSettings[packageType][settingKind]
    if (configured.url) return configured
  } catch {
    // Fall through to env fallback.
  }

  // Belum diisi admin → pakai default bawaan kode (mis. webhook pendaftaran Individu & Invitation).
  const fallback = DEFAULT_WEBHOOK_SETTINGS[packageType][settingKind]
  if (fallback.url) return fallback

  // Webhook status TIDAK boleh jatuh ke webhook pendaftaran/racepack: workflow di
  // sana punya pesan yang berbeda, dan pernah menyebabkan pacer yang di-approve
  // menerima pesan pendaftaran. Tanpa env khusus, biarkan kosong (skipped).
  const prefix = kind === 'status'
    ? (packageType === 'pacer' ? 'GHL_PACER_STATUS' : 'GHL_STATUS')
    : packageType === 'pacer'
    ? (kind === 'registration' ? 'GHL_PACER_REGISTRATION' : 'GHL_PACER_QR')
    : (kind === 'registration' ? 'GHL_REGISTRATION' : 'GHL_QR')
  return {
    url: process.env[`${prefix}_WEBHOOK_URL`] || '',
    token: process.env[`${prefix}_WEBHOOK_TOKEN`] || '',
  }
}

async function postWebhook(
  kind: WebhookKind,
  packageType: PackageKey,
  payload: Record<string, unknown>,
  /** Slot cadangan kalau slot utama belum diisi — dipakai untuk migrasi antar slot. */
  fallbackKind?: WebhookKind
) {
  let config = await getWebhookConfig(kind, packageType)
  if (!config.url && fallbackKind) {
    config = await getWebhookConfig(fallbackKind, packageType)
  }
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
  email?: string | null
  category?: string | null
  registrationCode?: string | null
  amount?: number | null
}) {
  return postWebhook('registration', 'individual', {
    event: 'registration_confirmation',
    package: 'individual',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    community_name: payload.familyName,
    leader_name: payload.representativeName,
    participant_name: payload.representativeName,
    participant_count: payload.participantCount,
    email: payload.email || '',
    category: payload.category || '',
    registration_code: payload.registrationCode || '',
    amount: payload.amount ?? null,
    message: `Pendaftaran individu ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. Silakan masuk ke dashboard dan lakukan pembayaran agar Race Pass dan QR racepack aktif.`,
  })
}

export async function sendInvitationRegistrationConfirmationWebhook(payload: {
  phone: string
  familyName: string
  representativeName: string
  participantCount: number
  email?: string | null
  category?: string | null
  registrationCode?: string | null
  amount?: number | null
}) {
  return postWebhook('registration', 'invitation', {
    event: 'registration_confirmation',
    package: 'invitation',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    community_name: payload.familyName,
    leader_name: payload.representativeName,
    participant_name: payload.representativeName,
    participant_count: payload.participantCount,
    email: payload.email || '',
    category: payload.category || '',
    registration_code: payload.registrationCode || '',
    amount: payload.amount ?? null,
    message: `Pendaftaran invitation ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. Silakan masuk ke dashboard dan lakukan pembayaran agar Race Pass dan QR racepack aktif.`,
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
    package: 'individual',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    leader_name: payload.representativeName,
    participant_name: payload.representativeName,
    participant_count: payload.participantCount,
    community_name: payload.familyName,
    community_code: payload.familyCode,
    registration_code: payload.familyCode,
    message: `Pembayaran individu ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. QR Code pengambilan racepack sudah dikirim ke email ${payload.email}. Silakan cek inbox atau folder spam/promosi.`,
  })
}

export async function sendInvitationRacepackWebhook(payload: {
  phone: string
  email: string
  representativeName: string
  participantCount: number
  familyName: string
  familyCode: string
}) {
  return postWebhook('racepack', 'invitation', {
    event: 'payment_received_check_email',
    package: 'invitation',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    leader_name: payload.representativeName,
    participant_name: payload.representativeName,
    participant_count: payload.participantCount,
    community_name: payload.familyName,
    community_code: payload.familyCode,
    registration_code: payload.familyCode,
    message: `Pembayaran invitation ${payload.familyName} untuk TOPSELL RUN 2026 sudah diterima. QR Code pengambilan racepack sudah dikirim ke email ${payload.email}. Silakan cek inbox atau folder spam/promosi.`,
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

/**
 * Kabari pacer lewat WhatsApp bahwa pendaftarannya disetujui.
 *
 * Terpisah dari sendPacerRegistrationWebhook: keduanya dulu memakai URL yang
 * sama, sehingga pacer yang di-approve justru menerima pesan pendaftaran dari
 * workflow GHL yang memang dibangun untuk pendaftaran.
 *
 * Hanya untuk approved. Penolakan masih lewat jalur lama.
 */
export async function sendPacerApprovalWebhook(payload: {
  phone: string
  email: string
  fullName: string
  category: string
  pacerCode: string
}) {
  return postWebhook('status', 'pacer', {
    event: 'pacer_approved',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    full_name: payload.fullName,
    category: payload.category,
    pacer_code: payload.pacerCode,
    status: 'approved',
    message: `Selamat ${payload.fullName}! Anda resmi terpilih sebagai Pacer TOPSELL RUN 2026 untuk kategori ${payload.category}. Kode pacer Anda: ${payload.pacerCode}. Silakan masuk ke Dashboard Pacer untuk melengkapi profil dan mengunduh QR Pass Anda.`,
  })
}

/**
 * Kabari tenant UMKM lewat WhatsApp bahwa pendaftarannya disetujui.
 *
 * Hanya untuk status approved — penolakan cukup lewat email
 * (src/lib/email/umkm.ts), sesuai permintaan.
 *
 * URL diambil dari slot webhookSettings.umkm.status ("Webhook Status") sesuai
 * fungsinya. Selama slot itu masih kosong, nilainya jatuh ke slot registration
 * agar setelan lama tetap jalan — hapus fallback ini setelah URL dipindah.
 * ponytail: fallback slot lama, hapus setelah migrasi setelan UMKM selesai.
 */
export async function sendUmkmApprovalWebhook(payload: {
  phone: string
  email: string
  name: string
  picName: string
  umkmCode: string
  businessField: string
  /** Sisa tagihan; 0 untuk tenant gratis atau yang sudah lunas. */
  amountDue: number
}) {
  const paymentLine =
    payload.amountDue > 0
      ? `Silakan masuk ke dashboard tenant untuk menyelesaikan pembayaran sebesar ${formatCurrency(payload.amountDue)}. Slot tenant terkunci setelah pembayaran diterima.`
      : `Tidak ada biaya yang perlu dibayar dan slot tenant Anda sudah terkunci.`

  return postWebhook('status', 'umkm', {
    event: 'umkm_approved',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    name: payload.name,
    pic_name: payload.picName,
    umkm_code: payload.umkmCode,
    business_field: payload.businessField,
    status: 'approved',
    amount_due: payload.amountDue,
    message: `Selamat! Pendaftaran tenant UMKM ${payload.name} untuk TOPSELL RUN 2026 telah DISETUJUI. ${paymentLine}`,
  }, 'registration')
}

/**
 * Konfirmasi pembayaran tenant UMKM. Memakai kind 'racepack' sehingga URL-nya
 * diambil dari slot webhookSettings.umkm.payment di pengaturan admin.
 */
export async function sendUmkmPaymentConfirmationWebhook(payload: {
  phone: string
  email: string
  name: string
  picName: string
  umkmCode: string
  businessField: string
  amount: number
}) {
  return postWebhook('racepack', 'umkm', {
    event: 'umkm_payment_received',
    package: 'umkm',
    phone: payload.phone,
    whatsapp: phoneToWhatsAppId(payload.phone),
    email: payload.email,
    name: payload.name,
    pic_name: payload.picName,
    umkm_code: payload.umkmCode,
    registration_code: payload.umkmCode,
    business_field: payload.businessField,
    status: 'paid',
    amount: payload.amount,
    message: `Pembayaran tenant UMKM ${payload.name} untuk TOPSELL RUN 2026 sebesar ${formatCurrency(payload.amount)} sudah kami terima. Slot tenant Anda resmi terkunci.`,
  })
}
