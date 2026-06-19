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
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  community_id: string
  registration_id: string | null
  full_name: string
  bib_name: string
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
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
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
  status: 'pending' | 'paid' | 'failed' | 'expired'
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
  status: 'pending' | 'paid' | 'failed' | 'expired'
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

export interface Family {
  id: string
  name: string
  leader_name: string
  email: string | null
  phone: string
  category: string
  family_code: string
  provinsi: string | null
  kota: string | null
  kecamatan: string | null
  created_at: string
  updated_at: string
}

export interface FamilyParticipant {
  id: string
  family_id: string
  registration_id: string | null
  full_name: string
  bib_name: string
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
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
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
  status: 'pending' | 'paid' | 'failed' | 'expired'
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
  status: 'pending' | 'paid' | 'failed' | 'expired'
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
