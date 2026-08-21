'use server'

import {
  findAuthEmailOwner,
  findCommunityByPhoneExcept,
  findParticipantWithCommunityById,
  markParticipantCheckedIn,
  updateCommunity,
  updateCommunityAuthPassword,
  updateCommunityAuthPhone,
  updateParticipantById,
  findParticipantById,
  // family database imports
  findFamilyParticipantWithFamilyById,
  findFamilyParticipantById,
  markFamilyParticipantCheckedIn,
  updateFamilyParticipantById,
  updateFamily,
  updateFamilyAuthPhone,
  updateFamilyAuthPassword,
  findFamilyByPhoneExcept,
  // individual database imports
  findIndividualParticipantWithIndividualById,
  findIndividualParticipantById,
  findIndividualParticipantsByIndividualId,
  markIndividualParticipantCheckedIn,
  updateIndividualParticipantById,
  updateIndividual,
  updateIndividualAuthPhone,
  updateIndividualAuthPassword,
  findIndividualByPhoneExcept,
  // pacer database imports
  findPacerParticipantById,
  updatePacerParticipantById,
  updatePacer,
  findPacerByPhoneExcept,
  findPacerById,
  findPacerParticipantByPacerId,
  // umkm database imports
  findUmkmById,
  updateUmkm,
} from '@/lib/db'
import { sendPacerRegistrationWebhook } from '@/lib/ghl/webhook'
import { clearAdminSession, createAdminSession, getAdminSession } from '@/lib/admin/auth'
import { createPasswordRecord, getAdminPublicAccounts, readManagedAdminAccounts, resolveAdminLogin, writeManagedAdminAccounts } from '@/lib/admin/accounts'
import { createPasswordRecord as createCommunityPasswordRecord } from '@/lib/auth/password'
import { queryAdminLogs } from '@/lib/axiom/logs'
import { readEditableEnvSnapshot, updateEditableEnvValues, writeAdminSettings } from '@/lib/admin/settings'
import { clearRateLimit, rateLimit, rateLimitByIp, getClientIp } from '@/lib/security/rate-limit'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { revalidatePath } from 'next/cache'
import type { AdminSettings } from '@/lib/admin/settings-schema'
import { sendPacerApprovalEmail } from '@/lib/email/pacer'

function parseParticipantId(scanValue: string) {
  const value = scanValue.trim()
  const match = value.match(/TSR_PARTICIPANT:([0-9a-f-]{36})/i)
  if (match?.[1]) return match[1]
  if (/^[0-9a-f-]{36}$/i.test(value)) return value
  return null
}

export async function loginAdmin(username: string, password: string) {
  const limit = await rateLimitByIp('admin-login', 20, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const session = await resolveAdminLogin(username, password)
  if (!session) {
    return { error: 'Username atau password admin tidak valid.' }
  }

  const ip = await getClientIp()
  clearRateLimit(`admin-login:${ip}`)
  await createAdminSession(session)

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'admin_signin',
      message: `Admin login berhasil: ${session.name} (Username: ${session.username}, Role: ${session.role}).`,
      actor: session,
    })
  } catch (logError) {
    console.error('Failed to log admin login:', logError)
  }

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

  type ScannedParticipantType = {
    id: string
    full_name: string
    bib_name: string
    phone: string
    email: string
    payment_status: string
    checked_in: boolean
    checked_in_at: string | null
    participant_code: string | null
    community: { name: string; community_code: string } | null
  }

  let participant = (await findParticipantWithCommunityById(participantId)) as ScannedParticipantType | null
  let isFamily = false
  let isIndividual = false

  if (!participant) {
    const familyParticipant = await findFamilyParticipantWithFamilyById(participantId)
    if (familyParticipant) {
      isFamily = true
      participant = {
        ...familyParticipant,
        community: familyParticipant.family ? { name: familyParticipant.family.name, community_code: familyParticipant.family.family_code } : null
      } as unknown as ScannedParticipantType
    }
  }

  if (!participant) {
    const individualParticipant = await findIndividualParticipantWithIndividualById(participantId)
    if (individualParticipant) {
      isIndividual = true
      participant = {
        ...individualParticipant,
        community: individualParticipant.individual ? { name: individualParticipant.individual.name, community_code: individualParticipant.individual.individual_code } : null
      } as unknown as ScannedParticipantType
    }
  }

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

  const pickedUpAt = isIndividual
    ? await markIndividualParticipantCheckedIn(participantId)
    : isFamily
    ? await markFamilyParticipantCheckedIn(participantId)
    : await markParticipantCheckedIn(participantId)

  let updated = null
  if (isIndividual) {
    const individualParticipant = await findIndividualParticipantWithIndividualById(participantId)
    if (individualParticipant) {
      updated = {
        ...individualParticipant,
        community: individualParticipant.individual ? { name: individualParticipant.individual.name, community_code: individualParticipant.individual.individual_code } : null
      } as unknown as ScannedParticipantType
    }
  } else if (isFamily) {
    const familyParticipant = await findFamilyParticipantWithFamilyById(participantId)
    if (familyParticipant) {
      updated = {
        ...familyParticipant,
        community: familyParticipant.family ? { name: familyParticipant.family.name, community_code: familyParticipant.family.family_code } : null
      } as unknown as ScannedParticipantType
    }
  } else {
    updated = (await findParticipantWithCommunityById(participantId)) as ScannedParticipantType | null
  }

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
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string
  gender: 'male' | 'female'
  tshirt_size: string
  blood_type: string
  medical_condition: string
  emergency_contact_name: string
  emergency_contact_phone: string
  community_name?: string | null
}

export async function updateAdminParticipant(participantId: string, values: AdminParticipantUpdateValues) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.full_name.trim() || !values.bib_name.trim()) return { error: 'Nama peserta dan BIB wajib diisi.' }
  if (!/^\d{16}$/.test(values.ktp_number.trim())) return { error: 'Nomor KTP peserta harus 16 digit angka.' }
  if (!emailRegex.test(values.email)) return { error: 'Email peserta tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP peserta tidak valid.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth)) return { error: 'Tanggal lahir peserta tidak valid.' }
  if (!values.emergency_contact_name.trim()) return { error: 'Nama kontak darurat wajib diisi.' }
  if (!phoneRegex.test(values.emergency_contact_phone)) return { error: 'Nomor kontak darurat tidak valid.' }
  if (!['male', 'female'].includes(values.gender)) return { error: 'Gender tidak valid.' }

  const payload = {
    full_name: values.full_name.trim(),
    bib_name: values.bib_name.trim(),
    ktp_number: values.ktp_number.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    tshirt_size: values.tshirt_size as 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL',
    blood_type: values.blood_type as 'A' | 'B' | 'AB' | 'O',
    medical_condition: values.medical_condition.trim() || null,
    emergency_contact_name: values.emergency_contact_name.trim(),
    emergency_contact_phone: values.emergency_contact_phone.trim(),
    community_name: values.community_name ? values.community_name.trim() : null,
  }

  const existingCommunity = await findParticipantById(participantId)
  if (existingCommunity) {
    await updateParticipantById(participantId, payload)
  } else {
    const existingFamily = await findFamilyParticipantById(participantId)
    if (existingFamily) {
      await updateFamilyParticipantById(participantId, payload)
    } else {
      const existingIndividual = await findIndividualParticipantById(participantId)
      if (existingIndividual) {
        await updateIndividualParticipantById(participantId, payload)
      } else {
        return { error: 'Peserta tidak ditemukan.' }
      }
    }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_participant_updated',
      message: `Admin ${session.name} memperbarui data peserta: ${payload.full_name} (BIB: ${payload.bib_name}, HP: ${payload.phone}, Tipe: ${existingCommunity ? 'Komunitas' : 'Bro & Sist'}).`,
      actor: session,
      data: {
        participantId,
        full_name: payload.full_name,
        bib_name: payload.bib_name,
        email: payload.email,
        phone: payload.phone,
        isFamily: !existingCommunity,
      }
    })
  } catch (logError) {
    console.error('Failed to log admin participant update:', logError)
  }

  revalidatePath('/admin')
  return { success: true }
}

export type AdminFamilyUpdateValues = {
  id: string
  name: string
  leader_name: string
  email: string
  phone: string
  community_name?: string | null
  provinsi: string
  kota: string
  kecamatan: string
  password: string
}

export async function updateAdminFamily(values: AdminFamilyUpdateValues) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.name.trim() || !values.leader_name.trim()) return { error: 'Nama grup dan penanggung jawab wajib diisi.' }
  if (!emailRegex.test(values.email)) return { error: 'Email perwakilan tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP perwakilan tidak valid.' }
  if (values.password && values.password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const duplicate = await findFamilyByPhoneExcept(values.phone, values.id)
  if (duplicate) return { error: 'Nomor HP sudah digunakan grup Bro & Sist lain.' }

  const duplicateEmail = await findAuthEmailOwner(values.email, { type: 'family', id: values.id })
  if (duplicateEmail) return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan akun lain.' }

  await updateFamily(values.id, {
    name: values.name.trim(),
    leader_name: values.leader_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    provinsi: values.provinsi.trim() || null,
    kota: values.kota.trim() || null,
    kecamatan: values.kecamatan.trim() || null,
  })

  await updateFamilyAuthPhone(values.id, values.phone)

  if (values.password) {
    await updateFamilyAuthPassword(values.id, createCommunityPasswordRecord(values.password))
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_family_updated',
      message: `Admin ${session.name} memperbarui data Bro & Sist Package: ${values.name} (Penanggung Jawab: ${values.leader_name}, HP: ${values.phone}).`,
      actor: session,
      data: {
        familyId: values.id,
        name: values.name,
        leaderName: values.leader_name,
        phone: values.phone,
        email: values.email,
      }
    })
  } catch (logError) {
    console.error('Failed to log admin family update:', logError)
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function updateAdminIndividual(values: AdminFamilyUpdateValues) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.name.trim() || !values.leader_name.trim()) return { error: 'Nama peserta wajib diisi.' }
  if (!emailRegex.test(values.email)) return { error: 'Email peserta tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP peserta tidak valid.' }
  if (values.password && values.password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const duplicate = await findIndividualByPhoneExcept(values.phone, values.id)
  if (duplicate) return { error: 'Nomor HP sudah digunakan peserta individu lain.' }

  await updateIndividual(values.id, {
    name: values.name.trim(),
    leader_name: values.leader_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    community_name: values.community_name ? values.community_name.trim() : null,
    provinsi: values.provinsi.trim() || null,
    kota: values.kota.trim() || null,
    kecamatan: values.kecamatan.trim() || null,
  })

  // Sinkronkan instansi ke peserta individu terkait
  try {
    const participants = await findIndividualParticipantsByIndividualId(values.id)
    for (const p of participants) {
      await updateIndividualParticipantById(p.id, {
        full_name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        community_name: values.community_name ? values.community_name.trim() : null,
      })
    }
  } catch (err) {
    console.error('Failed to sync participant community_name:', err)
  }

  await updateIndividualAuthPhone(values.id, values.phone)

  if (values.password) {
    await updateIndividualAuthPassword(values.id, createCommunityPasswordRecord(values.password))
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_individual_updated',
      message: `Admin ${session.name} memperbarui data peserta individu: ${values.name} (HP: ${values.phone}).`,
      actor: session,
      data: { individualId: values.id, name: values.name, phone: values.phone, email: values.email },
    })
  } catch (logError) {
    console.error('Failed to log admin individual update:', logError)
  }

  revalidatePath('/admin')
  return { success: true }
}

export type AdminCommunityUpdateValues = {
  id: string
  name: string
  leader_name: string
  email: string
  phone: string
  community_name?: string | null
  provinsi: string
  kota: string
  kecamatan: string
  password: string
}

export async function updateAdminCommunity(values: AdminCommunityUpdateValues) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.name.trim() || !values.leader_name.trim()) return { error: 'Nama komunitas dan ketua wajib diisi.' }
  if (!emailRegex.test(values.email)) return { error: 'Email komunitas tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP komunitas tidak valid.' }
  if (values.password && values.password.length < 6) return { error: 'Password minimal 6 karakter.' }

  const duplicate = await findCommunityByPhoneExcept(values.phone, values.id)
  if (duplicate) return { error: 'Nomor HP sudah digunakan komunitas lain.' }

  const duplicateEmail = await findAuthEmailOwner(values.email, { type: 'community', id: values.id })
  if (duplicateEmail) return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan akun lain.' }

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

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_community_updated',
      message: `Admin ${session.name} memperbarui data komunitas: ${values.name} (Ketua: ${values.leader_name}, HP: ${values.phone}).`,
      actor: session,
      data: {
        communityId: values.id,
        name: values.name,
        leaderName: values.leader_name,
        phone: values.phone,
        email: values.email,
      }
    })
  } catch (logError) {
    console.error('Failed to log admin community update:', logError)
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
  allowed_tabs?: string[]
}

type AdminAccountUpdateInput = {
  id: string
  name: string
  username: string
  password?: string
  is_active: boolean
  role: 'admin' | 'superadmin'
  allowed_tabs?: string[]
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
    allowed_tabs: Array.isArray(values.allowed_tabs) ? values.allowed_tabs : [],
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
  next.allowed_tabs = Array.isArray(values.allowed_tabs) ? values.allowed_tabs : []
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

export type UpdatePaymentStatusValues = {
  paymentId: string
  packageType: 'community' | 'family' | 'individual' | 'umkm'
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'testing'
  paymentMethod?: string
}

export async function updateAdminPaymentStatus(values: UpdatePaymentStatusValues) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  const { paymentId, packageType, status, paymentMethod } = values

  if (!['pending', 'paid', 'failed', 'expired', 'testing'].includes(status)) {
    return { error: 'Status pembayaran tidak valid.' }
  }

  try {
    // Dynamic imports to avoid circular dependencies
    const db = await import('@/lib/db')

    const findPaymentByPackage = {
      community: db.findPaymentById,
      family: db.findFamilyPaymentById,
      individual: db.findIndividualPaymentById,
      umkm: db.findUmkmPaymentById,
    }[packageType]
    const markPaid = {
      community: db.markPaymentPaid,
      family: db.markFamilyPaymentPaid,
      individual: db.markIndividualPaymentPaid,
      umkm: db.markUmkmPaymentPaid,
    }[packageType]
    const markFailed = {
      community: db.markPaymentFailed,
      family: db.markFamilyPaymentFailed,
      individual: db.markIndividualPaymentFailed,
      umkm: db.markUmkmPaymentFailed,
    }[packageType]
    const markExpired = {
      community: db.markPaymentExpired,
      family: db.markFamilyPaymentExpired,
      individual: db.markIndividualPaymentExpired,
      umkm: db.markUmkmPaymentExpired,
    }[packageType]
    const markTesting = {
      community: db.markPaymentTesting,
      family: db.markFamilyPaymentTesting,
      individual: db.markIndividualPaymentTesting,
      umkm: async (id: string) => { await db.updateUmkmPayment(id, { status: 'testing' as any }) },
    }[packageType]
    const updatePaymentPending = {
      community: db.updatePayment,
      family: db.updateFamilyPayment,
      individual: db.updateIndividualPayment,
      umkm: db.updateUmkmPayment,
    }[packageType]

    const payment = await findPaymentByPackage(paymentId)
    if (!payment) {
      return { error: 'Pembayaran tidak ditemukan.' }
    }

    const oldStatus = payment.status
    const packageName = packageType === 'community' ? 'komunitas' : packageType === 'individual' ? 'Individu' : packageType === 'umkm' ? 'Tenant UMKM' : 'Bro & Sist Package'
    const eventPrefix = packageType === 'community' ? 'admin_payment' : packageType === 'individual' ? 'admin_individual_payment' : packageType === 'umkm' ? 'admin_umkm_payment' : 'admin_family_payment'

    if (status === 'paid') {
      const updateValues = {
        payment_method: paymentMethod || payment.payment_method || 'manual_admin',
        paid_at: new Date().toISOString(),
      }
      await markPaid(paymentId, updateValues)

      if (oldStatus !== 'paid') {
        const racepackEmail = await import('@/lib/email/racepack')
        const receiptEmail = await import('@/lib/email/receipt')
        const racepackWa = await import('@/lib/whatsapp/racepack')
        const individualEmail = await import('@/lib/email/individual')
        const individualWa = await import('@/lib/whatsapp/individual')

        try {
          if (packageType === 'community' && 'registration_id' in payment) {
            await Promise.all([
              racepackEmail.sendRacepackEmailsForRegistration(payment.registration_id),
              racepackWa.sendRacepackWhatsappsForRegistration(payment.registration_id),
              receiptEmail.sendCommunityReceiptEmail(payment.registration_id),
            ])
          } else if (packageType === 'individual' && 'registration_id' in payment) {
            await Promise.all([
              individualEmail.sendIndividualRacepackEmailsForRegistration(payment.registration_id),
              individualEmail.sendIndividualReceiptEmail(payment.registration_id),
              individualWa.sendIndividualRacepackWhatsappsForRegistration(payment.registration_id),
            ])
          } else if (packageType === 'family' && 'registration_id' in payment) {
            await Promise.all([
              racepackEmail.sendFamilyRacepackEmailsForRegistration(payment.registration_id),
              racepackWa.sendFamilyRacepackWhatsappsForRegistration(payment.registration_id),
              receiptEmail.sendFamilyReceiptEmail(payment.registration_id),
            ])
          }
        } catch (notifError) {
          console.error('Failed to send notifications:', notifError)
        }
      }

      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: `${eventPrefix}_marked_paid`,
        message: `Admin ${session.name} mengubah status pembayaran ${packageName} menjadi PAID (Ref: ${payment.payment_reference}, Status lama: ${oldStatus}).`,
        actor: session,
        data: { paymentId, packageType, reference: payment.payment_reference, oldStatus, newStatus: 'paid', paymentMethod: paymentMethod || 'manual_admin' }
      })
    } else if (status === 'failed') {
      await markFailed(paymentId)
      await ingestAdminLog({
        level: 'warning',
        source: 'payment',
        event: `${eventPrefix}_marked_failed`,
        message: `Admin ${session.name} mengubah status pembayaran ${packageName} menjadi FAILED (Ref: ${payment.payment_reference}, Status lama: ${oldStatus}).`,
        actor: session,
        data: { paymentId, packageType, reference: payment.payment_reference, oldStatus, newStatus: 'failed' }
      })
    } else if (status === 'expired') {
      await markExpired(paymentId)
      await ingestAdminLog({
        level: 'warning',
        source: 'payment',
        event: `${eventPrefix}_marked_expired`,
        message: `Admin ${session.name} mengubah status pembayaran ${packageName} menjadi EXPIRED (Ref: ${payment.payment_reference}, Status lama: ${oldStatus}).`,
        actor: session,
        data: { paymentId, packageType, reference: payment.payment_reference, oldStatus, newStatus: 'expired' }
      })
    } else if (status === 'pending') {
      await updatePaymentPending(paymentId, { status: 'pending' })
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: `${eventPrefix}_marked_pending`,
        message: `Admin ${session.name} mengubah status pembayaran ${packageName} menjadi PENDING (Ref: ${payment.payment_reference}, Status lama: ${oldStatus}).`,
        actor: session,
        data: { paymentId, packageType, reference: payment.payment_reference, oldStatus, newStatus: 'pending' }
      })
    } else if (status === 'testing') {
      await markTesting(paymentId)
      await ingestAdminLog({
        level: 'info',
        source: 'payment',
        event: `${eventPrefix}_marked_testing`,
        message: `Admin ${session.name} mengubah status pembayaran ${packageName} menjadi TESTING (Ref: ${payment.payment_reference}, Status lama: ${oldStatus}).`,
        actor: session,
        data: { paymentId, packageType, reference: payment.payment_reference, oldStatus, newStatus: 'testing' }
      })
    }

    revalidatePath('/admin')
    return { success: true, message: `Status pembayaran berhasil diubah menjadi ${status.toUpperCase()}` }
  } catch (error) {
    console.error('Failed to update payment status:', error)
    await ingestAdminLog({
      level: 'error',
      source: 'payment',
      event: 'admin_payment_update_failed',
      message: `Admin ${session.name} gagal mengubah status pembayaran: ${error instanceof Error ? error.message : 'Unknown error'}.`,
      actor: session,
      data: { paymentId, packageType, status, error: error instanceof Error ? error.message : 'Unknown error' }
    })
    return { error: 'Gagal mengubah status pembayaran. Silakan coba lagi.' }
  }
}

export async function updateAdminPacerStatus(pacerId: string, status: 'approved' | 'rejected', note?: string) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!['approved', 'rejected'].includes(status)) {
    return { error: 'Status tidak valid.' }
  }

  await updatePacer(pacerId, {
    status,
    status_note: note?.trim() || null,
    reviewed_at: new Date().toISOString(),
  })

  try {
    const pacer = await findPacerById(pacerId)
    if (pacer) {
      const participant = await findPacerParticipantByPacerId(pacerId)
      await sendPacerRegistrationWebhook({
        phone: pacer.phone,
        email: pacer.email,
        fullName: pacer.name,
        category: pacer.category,
        pacerCode: pacer.pacer_code,
        status: status,
        instagram: participant?.sosmed_instagram || undefined,
        tiktok: participant?.sosmed_tiktok || undefined,
        stravaLink: participant?.strava_link || undefined,
        stravaUsername: participant?.strava_username || undefined,
        bankName: participant?.bank_name || undefined,
        bankAccountNumber: participant?.bank_account_number || undefined,
        bankAccountHolder: participant?.bank_account_holder || undefined,
        hasSmartwatch: participant?.has_smartwatch || undefined,
        age: participant?.age || undefined,
        provinsi: pacer.provinsi || undefined,
        kota: pacer.kota || undefined,
        kecamatan: pacer.kecamatan || undefined,
        mediaUrls: participant?.media_urls,
        pbMediaUrls: participant?.pb_media_urls,
      })
    }
  } catch (webhookError) {
    console.error('Failed to send pacer status update webhook to GHL:', webhookError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_pacer_status_updated',
      message: `Admin ${session.name} mengubah status pacer menjadi ${status.toUpperCase()} (ID: ${pacerId}).`,
      actor: session,
      data: { pacerId, status, note: note?.trim() || null },
    })
  } catch (logError) {
    console.error('Failed to log admin pacer status update:', logError)
  }

  // Kirim email notifikasi ke pacer jika status disetujui (approved)
  if (status === 'approved') {
    try {
      const emailResult = await sendPacerApprovalEmail(pacerId)
      if (!emailResult.success) {
        console.warn('Pacer approval email not sent:', emailResult.error)
      }
    } catch (emailError) {
      console.error('Failed to send pacer approval email:', emailError)
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export type AdminPacerParticipantUpdateValues = AdminParticipantUpdateValues & {
  age: number
  sosmed_instagram: string
  sosmed_tiktok: string
  strava_link: string
  strava_username: string
  bank_name: string
  bank_account_number: string
  bank_account_holder: string
  has_smartwatch: 'yes' | 'no'
}

export async function updateAdminPacerParticipant(participantId: string, values: AdminPacerParticipantUpdateValues) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  if (!values.full_name.trim() || !values.bib_name.trim()) return { error: 'Nama peserta dan BIB wajib diisi.' }
  if (!/^\d{16}$/.test(values.ktp_number.trim())) return { error: 'Nomor KTP peserta harus 16 digit angka.' }
  if (!emailRegex.test(values.email)) return { error: 'Email peserta tidak valid.' }
  if (!phoneRegex.test(values.phone)) return { error: 'Nomor HP peserta tidak valid.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth)) return { error: 'Tanggal lahir peserta tidak valid.' }
  if (!values.emergency_contact_name.trim()) return { error: 'Nama kontak darurat wajib diisi.' }
  if (!phoneRegex.test(values.emergency_contact_phone)) return { error: 'Nomor kontak darurat tidak valid.' }
  if (!['male', 'female'].includes(values.gender)) return { error: 'Gender tidak valid.' }
  if (!Number.isFinite(values.age) || values.age < 10 || values.age > 100) return { error: 'Usia tidak valid.' }
  if (!values.bank_name.trim() || !values.bank_account_number.trim() || !values.bank_account_holder.trim()) {
    return { error: 'Data rekening wajib diisi.' }
  }
  if (!['yes', 'no'].includes(values.has_smartwatch)) return { error: 'Data smartwatch tidak valid.' }

  const existing = await findPacerParticipantById(participantId)
  if (!existing) return { error: 'Peserta pacer tidak ditemukan.' }

  const duplicate = await findPacerByPhoneExcept(values.phone, existing.pacer_id)
  if (duplicate) return { error: 'Nomor HP sudah digunakan pacer lain.' }

  await updatePacerParticipantById(participantId, {
    full_name: values.full_name.trim(),
    bib_name: values.bib_name.trim(),
    ktp_number: values.ktp_number.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    date_of_birth: values.date_of_birth,
    gender: values.gender,
    tshirt_size: values.tshirt_size as 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL' | '4XL' | '5XL',
    blood_type: values.blood_type as 'A' | 'B' | 'AB' | 'O',
    medical_condition: values.medical_condition.trim() || null,
    emergency_contact_name: values.emergency_contact_name.trim(),
    emergency_contact_phone: values.emergency_contact_phone.trim(),
    age: values.age,
    sosmed_instagram: values.sosmed_instagram.trim() || null,
    sosmed_tiktok: values.sosmed_tiktok.trim() || null,
    strava_link: values.strava_link.trim() || null,
    strava_username: values.strava_username.trim() || null,
    bank_name: values.bank_name.trim(),
    bank_account_number: values.bank_account_number.trim(),
    bank_account_holder: values.bank_account_holder.trim(),
    has_smartwatch: values.has_smartwatch,
  })

  await updatePacer(existing.pacer_id, {
    name: values.full_name.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_pacer_participant_updated',
      message: `Admin ${session.name} memperbarui data pacer: ${values.full_name} (BIB: ${values.bib_name}, HP: ${values.phone}).`,
      actor: session,
      data: { participantId, full_name: values.full_name, bib_name: values.bib_name, phone: values.phone },
    })
  } catch (logError) {
    console.error('Failed to log admin pacer participant update:', logError)
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function updateAdminUmkmStatus(
  umkmId: string,
  status: 'approved' | 'rejected',
  statusNote?: string
) {
  const session = await getAdminSession()
  if (!session) {
    return { error: 'Sesi admin habis. Silakan login ulang.' }
  }

  const umkm = await findUmkmById(umkmId)
  if (!umkm) {
    return { error: 'Data UMKM tidak ditemukan.' }
  }

  const now = new Date().toISOString()
  await updateUmkm(umkmId, {
    status,
    status_note: statusNote || null,
    reviewed_at: now,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: `admin_umkm_${status}`,
      message: `Admin ${session.name} ${status === 'approved' ? 'menyetujui' : 'menolak'} pendaftaran UMKM: ${umkm.name} (${umkm.phone}).`,
      actor: session,
      data: { umkmId, name: umkm.name, phone: umkm.phone, status, statusNote },
    })
  } catch (logError) {
    console.error('Failed to log admin UMKM status update:', logError)
  }

  revalidatePath('/admin')
  return { success: true }
}
