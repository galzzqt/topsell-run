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
  findAuthEmailOwner,
  insertFamilyParticipants,
  saveFamilyAuth,
  updateFamily,
  findActiveCrossFamilyParticipant,
  createFamilyRegistration,
  createFamilyPayment,
  linkFamilyParticipantsToRegistration,
  setFamilyVerificationToken,
} from '@/lib/db'
import { registerFamilySchema, loginSchema, RegisterFamilyFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendFamilyRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { TOPSELL_RUN_EVENT } from '@/lib/types'
import { generateRandomReference } from '@/lib/utils/format'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

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

  const existingEmailOwner = await findAuthEmailOwner(values.email)
  if (existingEmailOwner) {
    return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan. Silakan login atau gunakan email lain.' }
  }

  // Check for duplicate participants based on email and phone
  // BUSINESS RULE: Only block if existing participant has active status (pending/paid)
  // Allow registration if existing participant has failed/expired status
  // CRITICAL FIX: Check ACROSS BOTH community and family participants
  for (const participant of values.participants) {
    const crossParticipant = await findActiveCrossFamilyParticipant(participant.email, participant.phone)
    if (crossParticipant && crossParticipant.participant) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} dan nomor HP ${participant.phone} sudah terdaftar aktif di sistem (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}). Peserta dengan status pembayaran pending/paid tidak dapat didaftarkan ulang.`
      }
    }
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
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil Brother & Sister Package.' }
  }

  try {
    await saveFamilyAuth(family.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun Brother & Sister Package.' }
  }

  try {
    await updateFamily(family.id, { email: values.email, category: values.category })
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui profil Brother & Sister Package.' }
  }

  let participantIds: string[] = []
  try {
    const insertedParticipants = await insertFamilyParticipants(
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
    participantIds = insertedParticipants.map(p => p.id)
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data anggota.' }
  }

  // Auto-create registration and payment record with status "pending"
  const totalAmount = values.participants.length * TOPSELL_RUN_EVENT.price_per_participant
  const paymentRefRaw = generateRandomReference('FAM')
  const paymentRef = toXenditReference(paymentRefRaw)

  try {
    const registration = await createFamilyRegistration({
      family_id: family.id,
      total_participants: values.participants.length,
      total_amount: totalAmount,
      status: 'pending',
    })

    await linkFamilyParticipantsToRegistration(participantIds, registration.id)

    await createFamilyPayment({
      registration_id: registration.id,
      amount: totalAmount,
      payment_reference: paymentRef,
      status: 'pending',
    })
  } catch (error) {
    console.error('Failed to create auto-payment record:', error)
    // Don't fail the registration if payment creation fails
    // Admin can manually create payment later
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

  // Send email verification
  if (values.email) {
    try {
      const verificationToken = generateVerificationToken()
      const tokenExpiry = getVerificationTokenExpiry()
      
      await setFamilyVerificationToken(family.id, verificationToken, tokenExpiry)
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`
      
      await sendVerificationEmail({
        email: values.email,
        name: values.leader_name || values.name,
        verificationUrl,
      })
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError)
      // Don't fail registration if email sending fails
    }
  }

  // Don't create session yet - wait for email verification
  // await createFamilySession({
  //   id: family.id,
  //   phone: family.phone,
  //   name: family.name,
  // })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'family_signup',
      message: `Pendaftaran Brother & Sister Package baru: ${values.name} (Perwakilan: ${values.leader_name}, HP: ${values.phone}, Jumlah Anggota: ${values.participants.length}).`,
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

  // Check if email is verified
  if (!family.email_verified) {
    return { 
      error: 'Email belum diverifikasi. Silakan cek email Anda untuk link aktivasi atau minta kirim ulang.',
      needsVerification: true,
      familyId: family.id,
    }
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
      message: `Brother & Sister Package login berhasil: ${family.name} (HP: ${family.phone}).`,
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
