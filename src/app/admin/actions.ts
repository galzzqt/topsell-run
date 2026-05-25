'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { clearAdminSession, createAdminSession, isAdminAuthenticated, verifyAdminPassword } from '@/lib/admin/auth'
import { readEditableEnvSnapshot, updateEditableEnvValues, writeAdminSettings } from '@/lib/admin/settings'
import { clearRateLimit, rateLimit } from '@/lib/security/rate-limit'
import { phoneToAuthEmail } from '@/lib/utils/phone-auth'
import { revalidatePath } from 'next/cache'
import type { AdminSettings } from '@/lib/admin/settings-schema'

function parseParticipantId(scanValue: string) {
  const value = scanValue.trim()
  const match = value.match(/TSR_PARTICIPANT:([0-9a-f-]{36})/i)
  if (match?.[1]) return match[1]
  if (/^[0-9a-f-]{36}$/i.test(value)) return value
  return null
}

export async function loginAdmin(password: string) {
  const limit = rateLimit('admin-login', 10, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  if (!verifyAdminPassword(password)) {
    return { error: 'Password admin tidak valid.' }
  }

  clearRateLimit('admin-login')
  await createAdminSession()
  revalidatePath('/admin')
  return { success: true }
}

export async function logoutAdmin() {
  await clearAdminSession()
  revalidatePath('/admin')
  return { success: true }
}

export async function markRacepackPickedUp(scanValue: string) {
  if (!(await isAdminAuthenticated())) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  const participantId = parseParticipantId(scanValue)
  if (!participantId) {
    return { error: 'QR tidak valid. Pastikan QR Race Pass peserta yang dipindai.' }
  }

  const supabase = createAdminClient()
  const { data: participant, error: findError } = await supabase
    .from('participants')
    .select('id, full_name, bib_name, email, phone, date_of_birth, gender, tshirt_size, blood_type, emergency_contact_name, emergency_contact_phone, participant_code, payment_status, checked_in, checked_in_at, community:communities(name, community_code)')
    .eq('id', participantId)
    .single()

  if (findError || !participant) {
    return { error: 'Peserta tidak ditemukan.' }
  }

  if (participant.payment_status !== 'paid') {
    return { error: 'Peserta belum lunas, racepack belum bisa diambil.' }
  }

  if (participant.checked_in) {
    return {
      error: 'Racepack peserta ini sudah pernah diambil. QR tidak bisa digunakan lagi.',
      alreadyPickedUp: true,
      participant,
    }
  }

  const pickedUpAt = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from('participants')
    .update({ checked_in: true, checked_in_at: pickedUpAt })
    .eq('id', participantId)
    .select('id, full_name, bib_name, email, phone, date_of_birth, gender, tshirt_size, blood_type, emergency_contact_name, emergency_contact_phone, participant_code, payment_status, checked_in, checked_in_at, community:communities(name, community_code)')
    .single()

  if (updateError || !updated) {
    return { error: updateError?.message || 'Gagal menyimpan status pengambilan racepack.' }
  }

  revalidatePath('/admin')
  return { success: true, participant: updated }
}

const phoneRegex = /^08[1-9][0-9]{8,11}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AdminParticipantUpdateValues = {
  full_name: string
  bib_name: string
  email: string
  phone: string
  date_of_birth: string
  gender: 'male' | 'female'
  tshirt_size: string
  blood_type: string
  medical_condition: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

export async function updateAdminParticipant(participantId: string, values: AdminParticipantUpdateValues) {
  if (!(await isAdminAuthenticated())) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.full_name.trim() || !values.bib_name.trim()) return { error: 'Nama peserta dan BIB wajib diisi.' }
  if (!emailRegex.test(values.email)) return { error: 'Email peserta tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP peserta tidak valid.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth)) return { error: 'Tanggal lahir peserta tidak valid.' }
  if (!values.emergency_contact_name.trim()) return { error: 'Nama kontak darurat wajib diisi.' }
  if (!phoneRegex.test(values.emergency_contact_phone)) return { error: 'Nomor kontak darurat tidak valid.' }
  if (!['male', 'female'].includes(values.gender)) return { error: 'Gender tidak valid.' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('participants')
    .update({
      full_name: values.full_name.trim(),
      bib_name: values.bib_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      date_of_birth: values.date_of_birth,
      gender: values.gender,
      tshirt_size: values.tshirt_size,
      blood_type: values.blood_type,
      medical_condition: values.medical_condition.trim() || null,
      emergency_contact_name: values.emergency_contact_name.trim(),
      emergency_contact_phone: values.emergency_contact_phone.trim(),
    })
    .eq('id', participantId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { success: true }
}

export type AdminCommunityUpdateValues = {
  id: string
  name: string
  leader_name: string
  email: string
  phone: string
  provinsi: string
  kota: string
  kecamatan: string
  password: string
}

export async function updateAdminCommunity(values: AdminCommunityUpdateValues) {
  if (!(await isAdminAuthenticated())) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.name.trim() || !values.leader_name.trim()) return { error: 'Nama komunitas dan ketua wajib diisi.' }
  if (!emailRegex.test(values.email)) return { error: 'Email komunitas tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP komunitas tidak valid.' }
  if (values.password && values.password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const supabase = createAdminClient()
  const { data: duplicate } = await supabase
    .from('communities')
    .select('id')
    .eq('phone', values.phone)
    .neq('id', values.id)
    .maybeSingle()

  if (duplicate) return { error: 'Nomor HP sudah digunakan komunitas lain.' }

  const { error } = await supabase
    .from('communities')
    .update({
      name: values.name.trim(),
      leader_name: values.leader_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      provinsi: values.provinsi.trim() || null,
      kota: values.kota.trim() || null,
      kecamatan: values.kecamatan.trim() || null,
    })
    .eq('id', values.id)

  if (error) return { error: error.message }

  const { error: authError } = await supabase.auth.admin.updateUserById(values.id, {
    email: phoneToAuthEmail(values.phone),
    ...(values.password ? { password: values.password } : {}),
    user_metadata: {
      name: values.name.trim(),
      leader_name: values.leader_name.trim(),
      phone: values.phone.trim(),
      contact_email: values.email.trim(),
      provinsi: values.provinsi.trim() || null,
      kota: values.kota.trim() || null,
      kecamatan: values.kecamatan.trim() || null,
    },
  })

  if (authError) return { error: authError.message }

  revalidatePath('/admin')
  return { success: true }
}

export async function saveRegistrationFormSettings(settings: AdminSettings) {
  if (!(await isAdminAuthenticated())) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  try {
    await writeAdminSettings(settings)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan pengaturan form.' }
  }

  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function saveEditableEnvValues(values: Record<string, string>) {
  if (!(await isAdminAuthenticated())) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  try {
    await updateEditableEnvValues(values)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi env.' }
  }

  revalidatePath('/admin')
  return {
    success: true,
    env: await readEditableEnvSnapshot(),
    message: 'Konfigurasi env tersimpan. Restart server diperlukan agar semua perubahan env aktif di proses Next.js.',
  }
}
