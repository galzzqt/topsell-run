'use server'

import {
  clearFamilySession,
  createFamilySession,
} from '@/lib/auth/family'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createFamily,
  deleteFamily,
  findFamilyAuthByPhone,
  findFamilyByPhone,
  findFamilyByEmail,
  findFamilyAuthById,
  insertFamilyParticipants,
  saveFamilyAuth,
  updateFamily,
} from '@/lib/db'
import { registerFamilySchema, loginSchema, RegisterFamilyFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendFamilyRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'

export async function signUpFamily(values: RegisterFamilyFormValues) {
  const validated = registerFamilySchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const existingFamily = await findFamilyByPhone(values.phone)
  if (existingFamily) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
  }

  let family
  try {
    family = await createFamily({
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
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil keluarga.' }
  }

  try {
    await saveFamilyAuth(family.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun keluarga.' }
  }

  try {
    await updateFamily(family.id, { email: values.email, category: values.category })
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui profil keluarga.' }
  }

  try {
    await insertFamilyParticipants(
      values.participants.map((p) => ({
        family_id: family.id,
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
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data anggota keluarga.' }
  }

  try {
    await sendFamilyRegistrationConfirmationWebhook({
      phone: values.phone,
      familyName: values.name,
      representativeName: values.leader_name,
      participantCount: values.participants.length,
    })
  } catch (sendError) {
    console.error('Failed to send family registration confirmation WhatsApp:', sendError)
  }

  await createFamilySession({
    id: family.id,
    phone: family.phone,
    name: family.name,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'family_signup',
      message: `Pendaftaran keluarga baru: ${values.name} (Perwakilan: ${values.leader_name}, HP: ${values.phone}, Jumlah Anggota: ${values.participants.length}).`,
      data: {
        familyId: family.id,
        name: values.name,
        representativeName: values.leader_name,
        phone: values.phone,
        participantCount: values.participants.length,
      },
    })
  } catch (logError) {
    console.error('Failed to log family signup:', logError)
  }

  return { success: true, phone: values.phone }
}

export async function signInFamily(values: LoginFormValues) {
  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Nomor HP/Email atau password tidak valid'
    return { error: errorMsg }
  }

  const input = values.phone.trim()
  const isEmail = input.includes('@')

  let family = null
  let auth = null

  if (isEmail) {
    family = await findFamilyByEmail(input)
    if (family) {
      auth = await findFamilyAuthById(family.id)
    }
  } else {
    family = await findFamilyByPhone(input)
    if (family) {
      auth = await findFamilyAuthByPhone(input)
    }
  }

  if (!family || !auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP/Email atau password salah' }
  }

  await createFamilySession({
    id: family.id,
    phone: family.phone,
    name: family.name,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'family_signin',
      message: `Keluarga login berhasil: ${family.name} (HP: ${family.phone}).`,
      data: {
        familyId: family.id,
        name: family.name,
        phone: family.phone,
      },
    })
  } catch (logError) {
    console.error('Failed to log family login:', logError)
  }

  return {
    success: true,
    user: {
      id: family.id,
      phone: family.phone,
      name: family.name,
    },
  }
}

export async function signOutFamily() {
  await clearFamilySession()
  return { success: true }
}
