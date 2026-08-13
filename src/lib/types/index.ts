// ==========================================
// TOPSELL RUN 2026 — Type Definitions
// ==========================================

export interface Community {
  id: string
  name: string
  leader_name: string
  email: string | null
  phone: string
  category: string
  community_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  email_verified: boolean
  verification_token: string | null
  verification_token_expires: string | null
  verification_sent_at: string | null
  voucher_code?: string | null
  voucher_discount?: number
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  community_id: string
  registration_id: string | null
  // Relasi ke PackagePeriod.key milik paket ini (mis. 'periode-1'); null untuk data lama sebelum backfill.
  period_key: string | null
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL'
  blood_type: 'A' | 'B' | 'AB' | 'O' | null
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  participant_code: string | null // e.g. TSR-6K-10023 (assigned after payment)
  qr_code_data: string | null
  payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  checked_in: boolean
  checked_in_at: string | null
  racepack_email_sent_at: string | null
  racepack_email_error: string | null
  racepack_whatsapp_sent_at: string | null
  racepack_whatsapp_error: string | null
  created_at: string
  updated_at: string
}

// Location API Types
export interface Provinsi {
  id: string
  name: string
}

export interface Kota {
  id: string
  name: string
  province_id: string
}

export interface Kecamatan {
  id: string
  name: string
  city_id: string
}

export interface Registration {
  id: string
  community_id: string
  total_participants: number
  total_amount: number
  /** Kode voucher yang dipakai saat pendaftaran; null jika tidak ada. */
  voucher_code: string | null
  /** Potongan harga dalam Rp dari voucher; 0 jika tidak ada. */
  voucher_discount: number
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  registration_id: string
  amount: number
  payment_method: string | null
  payment_reference: string
  snap_token: string | null
  provider: string | null
  xendit_session_id: string | null
  checkout_url: string | null
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  // Relasi ke PackagePeriod.key milik paket ini; null untuk data lama sebelum backfill.
  period_key: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  totalParticipants: number
  paidParticipants: number
  pendingParticipants: number
  totalAmountPaid: number
  communityCode: string
}

// Event constants — hardcoded for TOPSELL RUN 2026
export const TOPSELL_RUN_EVENT = {
  name: 'TOPSELL RUN 2026',
  tagline: 'Run Together. Rise Together.',
  date: '2026-10-18',
  location: 'Sunrise Mall, Mojokerto',
  category: '6K',
  price_per_participant: 135000,
  max_per_community: 100,
  min_per_community: 1,
} as const

// Per-category price (IDR). Individu punya 2 kategori; Bro & Sist / Komunitas
// tetap flat 135.000 lewat kategori lamanya. Kategori tersimpan di record
// family/community, jadi harga selalu turunan dari kategori tersebut.
export const CATEGORY_PRICES: Record<string, number> = {
  '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000': 135000, // Bro & Sist & Komunitas
  '3K 99.000': 99000, // Individu
  '6K 149.000': 149000, // Individu
}

export function priceForCategory(category: string | null | undefined): number {
  return (category && CATEGORY_PRICES[category]) || TOPSELL_RUN_EVENT.price_per_participant
}

// Pilihan kategori untuk pendaftaran individu (value harus cocok dgn CATEGORY_PRICES)
export const INDIVIDUAL_CATEGORY_OPTIONS = [
  { value: '3K 99.000', label: '3K — Rp 99.000' },
  { value: '6K 149.000', label: '6K — Rp 149.000' },
] as const

export interface Family {
  id: string
  name: string
  leader_name: string
  email: string | null
  phone: string
  category: string
  // 'individual' = pendaftaran individu (1 peserta), 'family' = Bro & Sist (>=3).
  // Legacy records tanpa field ini dianggap 'family'.
  registration_type: 'individual' | 'family'
  family_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  email_verified: boolean
  verification_token: string | null
  verification_token_expires: string | null
  verification_sent_at: string | null
  voucher_code?: string | null
  voucher_discount?: number
  created_at: string
  updated_at: string
}

export interface FamilyParticipant {
  id: string
  family_id: string
  registration_id: string | null
  period_key: string | null
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL'
  blood_type: 'A' | 'B' | 'AB' | 'O' | null
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  participant_code: string | null
  qr_code_data: string | null
  payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  checked_in: boolean
  checked_in_at: string | null
  racepack_email_sent_at: string | null
  racepack_email_error: string | null
  racepack_whatsapp_sent_at: string | null
  racepack_whatsapp_error: string | null
  created_at: string
  updated_at: string
}

export interface FamilyRegistration {
  id: string
  family_id: string
  total_participants: number
  total_amount: number
  /** Kode voucher yang dipakai saat pendaftaran; null jika tidak ada. */
  voucher_code: string | null
  /** Potongan harga dalam Rp dari voucher; 0 jika tidak ada. */
  voucher_discount: number
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  created_at: string
  updated_at: string
}

export interface FamilyPayment {
  id: string
  registration_id: string
  amount: number
  payment_method: string | null
  payment_reference: string
  snap_token: string | null
  provider: string | null
  xendit_session_id: string | null
  checkout_url: string | null
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  period_key: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface FamilyDashboardStats {
  totalParticipants: number
  paidParticipants: number
  pendingParticipants: number
  totalAmountPaid: number
  familyCode: string
}

// ==========================================
// INDIVIDU — koleksi terpisah dari family/community
// (struktur sama, tapi owner-id = individual_id, kode = individual_code)
// ==========================================

export interface Individual {
  id: string
  name: string
  leader_name: string
  email: string | null
  phone: string
  category: string
  individual_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  email_verified: boolean
  verification_token: string | null
  verification_token_expires: string | null
  verification_sent_at: string | null
  voucher_code?: string | null
  voucher_discount?: number
  created_at: string
  updated_at: string
}

export interface IndividualParticipant {
  id: string
  individual_id: string
  registration_id: string | null
  period_key: string | null
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL'
  blood_type: 'A' | 'B' | 'AB' | 'O' | null
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  participant_code: string | null
  qr_code_data: string | null
  payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  checked_in: boolean
  checked_in_at: string | null
  racepack_email_sent_at: string | null
  racepack_email_error: string | null
  racepack_whatsapp_sent_at: string | null
  racepack_whatsapp_error: string | null
  created_at: string
  updated_at: string
}

export interface IndividualRegistration {
  id: string
  individual_id: string
  total_participants: number
  total_amount: number
  /** Kode voucher yang dipakai saat pendaftaran; null jika tidak ada. */
  voucher_code: string | null
  /** Potongan harga dalam Rp dari voucher; 0 jika tidak ada. */
  voucher_discount: number
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  created_at: string
  updated_at: string
}

export interface IndividualPayment {
  id: string
  registration_id: string
  amount: number
  payment_method: string | null
  payment_reference: string
  snap_token: string | null
  provider: string | null
  xendit_session_id: string | null
  checkout_url: string | null
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  period_key: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface IndividualDashboardStats {
  totalParticipants: number
  paidParticipants: number
  pendingParticipants: number
  totalAmountPaid: number
  individualCode: string
}

// ==========================================
// PACER — pendaftaran tanpa pembayaran, seleksi via status approval admin
// (koleksi terpisah: pacer_registrations, pacer_participants, pacer_auth)
// ==========================================

export interface PacerRegistration {
  id: string
  name: string
  email: string
  phone: string
  category: string
  pacer_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  status: 'pending' | 'approved' | 'rejected'
  status_note: string | null
  reviewed_at: string | null
  email_verified: boolean
  verification_token: string | null
  verification_token_expires: string | null
  verification_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface PacerParticipant {
  id: string
  pacer_id: string
  period_key: string | null
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string | null
  gender: 'male' | 'female'
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL'
  blood_type: 'A' | 'B' | 'AB' | 'O' | null
  medical_condition: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  age: number | null
  sosmed_instagram: string | null
  sosmed_tiktok: string | null
  strava_link: string | null
  strava_username: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_account_holder: string | null
  has_smartwatch: 'yes' | 'no'
  media_urls: string[]
  pb_media_urls: string[]
  created_at: string
  updated_at: string
}
