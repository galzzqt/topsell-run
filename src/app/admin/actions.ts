'use server'

import {
  findCommunityByPhoneExcept,
  findParticipantWithCommunityById,
  markParticipantCheckedIn,
  updateCommunity,
  updateCommunityAuthPassword,
  updateCommunityAuthPhone,
  updateParticipantById,
} from '@/lib/db'
import { clearAdminSession, createAdminSession, getAdminSession, isAdminAuthenticated } from '@/lib/admin/auth'
import { createPasswordRecord, getAdminPublicAccounts, readManagedAdminAccounts, resolveAdminLogin, writeManagedAdminAccounts } from '@/lib/admin/accounts'
import { createPasswordRecord as createCommunityPasswordRecord } from '@/lib/auth/password'
import { queryAdminLogs } from '@/lib/axiom/logs'
import { readEditableEnvSnapshot, updateEditableEnvValues, writeAdminSettings } from '@/lib/admin/settings'
import { clearRateLimit, rateLimit } from '@/lib/security/rate-limit'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { revalidatePath } from 'next/cache'
import type { AdminSettings } from '@/lib/admin/settings-schema'

function parseParticipantId(scanValue: string) {
  const value = scanValue.trim()
  const match = value.match(/TSR_PARTICIPANT:([0-9a-f-]{36})/i)
  if (match?.[1]) return match[1]
  if (/^[0-9a-f-]{36}$/i.test(value)) return value
  return null
}

export async function loginAdmin(username: string, password: string) {
  const limit = rateLimit('admin-login', 10, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const session = await resolveAdminLogin(username, password)
  if (!session) {
    return { error: 'Username atau password admin tidak valid.' }
  }

  clearRateLimit('admin-login')
  await createAdminSession(session)
  revalidatePath('/admin')
  return { success: true }
}

export async function logoutAdmin() {
  await clearAdminSession()
  revalidatePath('/admin')
  return { success: true }
}

export async function markRacepackPickedUp(scanValue: string) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  const participantId = parseParticipantId(scanValue)
  if (!participantId) {
    await ingestAdminLog({
      level: 'warning',
      source: 'admin',
      event: 'racepack_scan_invalid',
      message: 'Scan racepack ditolak: QR tidak valid.',
      actor: session,
      data: { scanValue: scanValue.trim().slice(0, 200) },
    })
    return { error: 'QR tidak valid. Pastikan QR Race Pass peserta yang dipindai.' }
  }

  const participant = await findParticipantWithCommunityById(participantId)

  if (!participant) {
    await ingestAdminLog({
      level: 'warning',
      source: 'admin',
      event: 'racepack_scan_not_found',
      message: 'Scan racepack ditolak: peserta tidak ditemukan.',
      actor: session,
      data: { participantId },
    })
    return { error: 'Peserta tidak ditemukan.' }
  }

  if (participant.payment_status !== 'paid') {
    await ingestAdminLog({
      level: 'warning',
      source: 'admin',
      event: 'racepack_scan_unpaid',
      message: 'Scan racepack ditolak: peserta belum lunas.',
      actor: session,
      data: { participantId: participant.id, payment_status: participant.payment_status, checked_in: participant.checked_in },
    })
    return { error: 'Peserta belum lunas, racepack belum bisa diambil.' }
  }

  if (participant.checked_in) {
    await ingestAdminLog({
      level: 'warning',
      source: 'admin',
      event: 'racepack_scan_already_picked_up',
      message: 'Scan racepack ditolak: racepack sudah pernah diambil.',
      actor: session,
      data: { participantId: participant.id, checked_in_at: participant.checked_in_at },
    })
    return {
      error: 'Racepack peserta ini sudah pernah diambil. QR tidak bisa digunakan lagi.',
      alreadyPickedUp: true,
      participant,
    }
  }

  const pickedUpAt = await markParticipantCheckedIn(participantId)
  const updated = await findParticipantWithCommunityById(participantId)

  if (!updated) {
    await ingestAdminLog({
      level: 'error',
      source: 'admin',
      event: 'racepack_pickup_failed',
      message: 'Gagal menyimpan status pengambilan racepack.',
      actor: session,
      data: { participantId, pickedUpAt },
    })
    return { error: 'Gagal menyimpan status pengambilan racepack.' }
  }

  await ingestAdminLog({
    level: 'info',
    source: 'admin',
    event: 'racepack_picked_up',
    message: `Racepack ditandai sudah diambil: ${updated.full_name} (${updated.participant_code || updated.bib_name}).`,
    actor: session,
    data: {
      participantId: updated.id,
      participant_code: updated.participant_code,
      bib_name: updated.bib_name,
      pickedUpAt,
      community: updated.community,
    },
  })

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

  await updateParticipantById(participantId, {
    full_name: values.full_name.trim(),
    bib_name: values.bib_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    tshirt_size: values.tshirt_size as 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL',
    blood_type: values.blood_type as 'A' | 'B' | 'AB' | 'O',
    medical_condition: values.medical_condition.trim() || null,
    emergency_contact_name: values.emergency_contact_name.trim(),
    emergency_contact_phone: values.emergency_contact_phone.trim(),
  })

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

  const duplicate = await findCommunityByPhoneExcept(values.phone, values.id)
  if (duplicate) return { error: 'Nomor HP sudah digunakan komunitas lain.' }

  await updateCommunity(values.id, {
    name: values.name.trim(),
    leader_name: values.leader_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    provinsi: values.provinsi.trim() || null,
    kota: values.kota.trim() || null,
    kecamatan: values.kecamatan.trim() || null,
  })

  await updateCommunityAuthPhone(values.id, values.phone)

  if (values.password) {
    await updateCommunityAuthPassword(values.id, createCommunityPasswordRecord(values.password))
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function saveRegistrationFormSettings(settings: AdminSettings) {
  const session = await getAdminSession()
  if (!session) return { error: 'Sesi admin habis. Silakan login ulang.' }
  if (session.role !== 'superadmin') return { error: 'Akses ditolak. Fitur ini hanya untuk superadmin.' }

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
  const session = await getAdminSession()
  if (!session) return { error: 'Sesi admin habis. Silakan login ulang.' }
  if (session.role !== 'superadmin') return { error: 'Akses ditolak. Fitur ini hanya untuk superadmin.' }

  try {
    const result = await updateEditableEnvValues(values)
    if (!result || result.updatedKeys.length === 0) {
      return {
        error: 'Tidak ada env yang tersimpan. Pastikan field diisi dan key yang diubah termasuk daftar env yang didukung.',
      }
    }
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

const usernameRegex = /^[a-z0-9._-]{4,30}$/

type AdminAccountInput = {
  name: string
  username: string
  password: string
  role: 'admin' | 'superadmin'
}

type AdminAccountUpdateInput = {
  id: string
  name: string
  username: string
  password?: string
  is_active: boolean
  role: 'admin' | 'superadmin'
}

async function requireSuperAdmin() {
  const session = await getAdminSession()
  if (!session) return { error: 'Sesi admin habis. Silakan login ulang.' } as const
  if (session.role !== 'superadmin') return { error: 'Akses ditolak. Fitur ini hanya untuk superadmin.' } as const
  return { session } as const
}

function validateAdminName(name: string) {
  return name.trim().length >= 3
}

function validateAdminUsername(username: string) {
  return usernameRegex.test(username.trim().toLowerCase())
}

function normalizeAdminUsername(username: string) {
  return username.trim().toLowerCase()
}

export async function createManagedAdmin(values: AdminAccountInput) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard

  if (!validateAdminName(values.name)) return { error: 'Nama admin minimal 3 karakter.' }
  if (!validateAdminUsername(values.username)) return { error: 'Username harus 4-30 karakter (huruf kecil, angka, titik, underscore, dash).' }
  if (values.password.length < 6) return { error: 'Password admin minimal 6 karakter.' }
  if (!['admin', 'superadmin'].includes(values.role)) return { error: 'Role admin tidak valid.' }

  const accounts = await readManagedAdminAccounts()
  const username = normalizeAdminUsername(values.username)
  if (accounts.some((account) => account.username === username)) {
    return { error: 'Username admin sudah digunakan.' }
  }

  const now = new Date().toISOString()
  const passwordRecord = createPasswordRecord(values.password)
  accounts.push({
    id: crypto.randomUUID(),
    username,
    name: values.name.trim(),
    role: values.role,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...passwordRecord,
  })

  await writeManagedAdminAccounts(accounts)
  revalidatePath('/admin')
  return { success: true, admins: await getAdminPublicAccounts() }
}

export async function updateManagedAdmin(values: AdminAccountUpdateInput) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard

  if (!values.id) return { error: 'ID admin tidak valid.' }
  if (!validateAdminName(values.name)) return { error: 'Nama admin minimal 3 karakter.' }
  if (!validateAdminUsername(values.username)) return { error: 'Username harus 4-30 karakter (huruf kecil, angka, titik, underscore, dash).' }
  if (values.password && values.password.length < 6) return { error: 'Password admin minimal 6 karakter.' }
  if (!['admin', 'superadmin'].includes(values.role)) return { error: 'Role admin tidak valid.' }

  const accounts = await readManagedAdminAccounts()
  const username = normalizeAdminUsername(values.username)
  const targetIndex = accounts.findIndex((account) => account.id === values.id)
  if (targetIndex < 0) return { error: 'Akun admin tidak ditemukan.' }
  if (accounts.some((account, index) => index !== targetIndex && account.username === username)) {
    return { error: 'Username admin sudah digunakan.' }
  }

  const next = { ...accounts[targetIndex] }
  next.name = values.name.trim()
  next.username = username
  next.is_active = values.is_active
  next.role = values.role
  next.updated_at = new Date().toISOString()
  if (values.password) {
    Object.assign(next, createPasswordRecord(values.password))
  }

  accounts[targetIndex] = next
  await writeManagedAdminAccounts(accounts)
  revalidatePath('/admin')
  return { success: true, admins: await getAdminPublicAccounts() }
}

export async function deleteManagedAdmin(adminId: string) {
  const guard = await requireSuperAdmin()
  if ('error' in guard) return guard
  if (!adminId) return { error: 'ID admin tidak valid.' }

  const accounts = await readManagedAdminAccounts()
  const filtered = accounts.filter((account) => account.id !== adminId)
  if (filtered.length === accounts.length) return { error: 'Akun admin tidak ditemukan.' }

  await writeManagedAdminAccounts(filtered)
  revalidatePath('/admin')
  return { success: true, admins: await getAdminPublicAccounts() }
}

export async function refreshAxiomLogs() {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.', logs: [] as Awaited<ReturnType<typeof queryAdminLogs>>['logs'] }
  }
  if (session.role !== 'superadmin') {
    return { error: 'Akses ditolak. Fitur ini hanya untuk superadmin.', logs: [] as Awaited<ReturnType<typeof queryAdminLogs>>['logs'] }
  }

  const result = await queryAdminLogs(100)
  return {
    error: result.error,
    logs: result.logs,
  }
}
