'use server'

import {
  clearCommunitySession,
  createCommunitySession,
} from '@/lib/auth/community'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createCommunity,
  deleteCommunity,
  findCommunityAuthByPhone,
  findCommunityByPhone,
  findCommunityByEmail,
  findCommunityAuthById,
  findAuthEmailOwner,
  insertParticipants,
  saveCommunityAuth,
  updateCommunity,
  findActiveCrossParticipant,
} from '@/lib/db'
import { registerSchema, loginSchema, RegisterFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { rateLimit, clearRateLimit } from '@/lib/security/rate-limit'

export async function signUpCommunity(values: RegisterFormValues) {
  const limit = rateLimit('community-signup', 5, 10 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  const validated = registerSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const existingCommunity = await findCommunityByPhone(values.phone)
  if (existingCommunity) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
  }

  const existingEmailOwner = await findAuthEmailOwner(values.email)
  if (existingEmailOwner) {
    return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan. Silakan login atau gunakan email lain.' }
  }

  // Check for duplicate participants based on email and phone
  // BUSINESS RULE: Only block if existing participant has active status (pending/paid)
  // Allow registration if existing participant has failed/expired status
  // CRITICAL FIX: Check ACROSS BOTH community and family participants
  for (const participant of values.participants) {
    const crossParticipant = await findActiveCrossParticipant(participant.email, participant.phone)
    if (crossParticipant && crossParticipant.participant) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} dan nomor HP ${participant.phone} sudah terdaftar aktif di sistem (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}). Peserta dengan status pembayaran pending/paid tidak dapat didaftarkan ulang.`
      }
    }
  }

  let community
  try {
    community = await createCommunity({
      name: values.name,
      leader_name: values.leader_name,
      email: values.email,
      phone: values.phone,
      category: values.category,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil komunitas.' }
  }

  try {
    await saveCommunityAuth(community.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteCommunity(community.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun komunitas.' }
  }

  try {
    await updateCommunity(community.id, { email: values.email, category: values.category })
  } catch (error) {
    await deleteCommunity(community.id)
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui profil komunitas.' }
  }

  try {
    await insertParticipants(
      values.participants.map((p) => ({
        community_id: community.id,
        registration_id: null,
        full_name: p.full_name,
        bib_name: p.bib_name,
        email: p.email,
        phone: p.phone,
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        tshirt_size: p.tshirt_size,
        blood_type: p.blood_type,
        medical_condition: p.medical_condition || null,
        emergency_contact_name: p.emergency_contact_name,
        emergency_contact_phone: p.emergency_contact_phone,
        provinsi: values.provinsi,
        kota: values.kota,
        kecamatan: values.kecamatan,
        participant_code: null,
        qr_code_data: null,
        payment_status: 'pending',
        checked_in: false,
        checked_in_at: null,
        racepack_email_sent_at: null,
        racepack_email_error: null,
        racepack_whatsapp_sent_at: null,
        racepack_whatsapp_error: null,
      }))
    )
  } catch (error) {
    await deleteCommunity(community.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data peserta.' }
  }

  try {
    await sendRegistrationConfirmationWebhook({
      phone: values.phone,
      communityName: values.name,
      leaderName: values.leader_name,
      participantCount: values.participants.length,
    })
  } catch (sendError) {
    console.error('Failed to send registration confirmation WhatsApp:', sendError)
  }

  await createCommunitySession({
    id: community.id,
    phone: community.phone,
    name: community.name,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'community_signup',
      message: `Pendaftaran komunitas baru: ${values.name} (Ketua: ${values.leader_name}, HP: ${values.phone}, Jumlah Peserta: ${values.participants.length}).`,
      data: {
        communityId: community.id,
        name: values.name,
        leaderName: values.leader_name,
        phone: values.phone,
        participantCount: values.participants.length,
      },
    })
  } catch (logError) {
    console.error('Failed to log community signup:', logError)
  }

  return { success: true, phone: values.phone }
}

export async function signInCommunity(values: LoginFormValues) {
  const limit = rateLimit('community-login', 10, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Nomor HP/Email atau password tidak valid'
    return { error: errorMsg }
  }

  const input = values.phone.trim()
  const isEmail = input.includes('@')

  let community = null
  let auth = null

  if (isEmail) {
    community = await findCommunityByEmail(input)
    if (community) {
      auth = await findCommunityAuthById(community.id)
    }
  } else {
    community = await findCommunityByPhone(input)
    if (community) {
      auth = await findCommunityAuthByPhone(input)
    }
  }

  if (!community || !auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP/Email atau password salah' }
  }

  clearRateLimit('community-login')
  await createCommunitySession({
    id: community.id,
    phone: community.phone,
    name: community.name,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'community_signin',
      message: `Komunitas login berhasil: ${community.name} (HP: ${community.phone}).`,
      data: {
        communityId: community.id,
        name: community.name,
        phone: community.phone,
      },
    })
  } catch (logError) {
    console.error('Failed to log community login:', logError)
  }

  return {
    success: true,
    user: {
      id: community.id,
      phone: community.phone,
      name: community.name,
    },
  }
}

export async function signOutCommunity() {
  await clearCommunitySession()
  return { success: true }
}
