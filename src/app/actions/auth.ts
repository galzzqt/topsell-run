'use server'

import {
  clearCommunitySession,
  createCommunitySession,
  getCommunitySession,
} from '@/lib/auth/community'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createCommunity,
  deleteCommunity,
  deleteCommunityAuth,
  findCommunityAuthByPhone,
  findCommunityByPhone,
  insertParticipants,
  saveCommunityAuth,
  updateCommunity,
} from '@/lib/db'
import { registerSchema, loginSchema, RegisterFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'

export async function signUpCommunity(values: RegisterFormValues) {
  const validated = registerSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const existingCommunity = await findCommunityByPhone(values.phone)
  if (existingCommunity) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
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

  return { success: true, phone: values.phone }
}

export async function signInCommunity(values: LoginFormValues) {
  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: 'Nomor HP atau password tidak valid' }
  }

  const auth = await findCommunityAuthByPhone(values.phone)
  if (!auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP atau password salah' }
  }

  const community = await findCommunityByPhone(values.phone)
  if (!community) {
    return { error: 'Profil komunitas tidak ditemukan.' }
  }

  await createCommunitySession({
    id: community.id,
    phone: community.phone,
    name: community.name,
  })

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
