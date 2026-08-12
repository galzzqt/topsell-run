'use server'

import { clearPacerSession, createPacerSession } from '@/lib/auth/pacer'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createPacer,
  deletePacer,
  findPacerByPhone,
  findPacerByEmail,
  findPacerAuthByPhone,
  findPacerAuthById,
  savePacerAuth,
  createPacerParticipant,
  findActiveCrossIndividualParticipant,
  setPacerVerificationToken,
} from '@/lib/db'
import { registerPacerSchema, loginSchema, RegisterPacerFormValues, LoginFormValues } from '@/lib/validations/auth'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { isPackageOpen, checkPackageQuota, resolvePeriodForCategory } from '@/lib/admin/settings'
import { rateLimit, clearRateLimit } from '@/lib/security/rate-limit'
import { sendPacerRegistrationWebhook } from '@/lib/ghl/webhook'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'

export async function signUpPacer(values: RegisterPacerFormValues) {
  const limit = rateLimit('pacer-signup', 5, 10 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  const validated = registerPacerSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data registrasi tidak valid' }
  }

  const gate = await isPackageOpen('pacer')
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran pacer sedang ditutup.' }
  }

  const quota = await checkPackageQuota('pacer', 1, values.category)
  if (!quota.ok) {
    return { error: quota.reason || 'Kuota pacer sudah penuh.' }
  }

  const existingByPhone = await findPacerByPhone(values.phone)
  if (existingByPhone) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar sebagai pacer. Silakan login.' }
  }

  const existingByEmail = await findPacerByEmail(values.email)
  if (existingByEmail) {
    return { error: 'Email ini sudah terdaftar sebagai pacer. Silakan login atau gunakan email lain.' }
  }

  // Email/HP tidak boleh sama dengan peserta aktif (pending/paid) di paket lain
  // (Community/Bro & Sist/Individu) — pacer harus pakai identitas yang belum terpakai.
  const crossParticipant = await findActiveCrossIndividualParticipant(values.email, values.phone)
  if (crossParticipant && crossParticipant.participant) {
    return {
      error: `Email atau nomor HP ini sudah terdaftar aktif di paket lain (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}). Gunakan email/HP lain untuk daftar sebagai pacer.`,
    }
  }

  let pacer
  try {
    pacer = await createPacer({
      name: values.full_name,
      email: values.email,
      phone: values.phone,
      category: values.category,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil pacer.' }
  }

  try {
    await savePacerAuth(pacer.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deletePacer(pacer.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun pacer.' }
  }

  const period = await resolvePeriodForCategory('pacer', values.category)

  try {
    await createPacerParticipant({
      pacer_id: pacer.id,
      period_key: period?.key ?? null,
      full_name: values.full_name,
      bib_name: values.bib_name,
      ktp_number: values.ktp_number,
      email: values.email,
      phone: values.phone,
      date_of_birth: values.date_of_birth,
      gender: values.gender,
      tshirt_size: values.tshirt_size,
      blood_type: values.blood_type,
      medical_condition: values.medical_condition || null,
      emergency_contact_name: values.emergency_contact_name,
      emergency_contact_phone: values.emergency_contact_phone,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
      age: values.age,
      sosmed_instagram: values.sosmed_instagram || null,
      sosmed_tiktok: values.sosmed_tiktok || null,
      strava_link: values.strava_link || null,
      strava_username: values.strava_username || null,
      bank_name: values.bank_name,
      bank_account_number: values.bank_account_number,
      bank_account_holder: values.bank_account_holder,
      has_smartwatch: values.has_smartwatch,
      media_urls: values.media_urls,
      pb_media_urls: values.pb_media_urls,
    })
  } catch (error) {
    await deletePacer(pacer.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data pacer.' }
  }

  try {
    await sendPacerRegistrationWebhook({
      phone: values.phone,
      email: values.email,
      fullName: values.full_name,
      category: values.category,
      pacerCode: pacer.pacer_code,
      status: pacer.status, // 'pending'
      instagram: values.sosmed_instagram,
      tiktok: values.sosmed_tiktok,
      stravaLink: values.strava_link,
      stravaUsername: values.strava_username,
      bankName: values.bank_name,
      bankAccountNumber: values.bank_account_number,
      bankAccountHolder: values.bank_account_holder,
      hasSmartwatch: values.has_smartwatch,
      age: values.age,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
      mediaUrls: values.media_urls,
      pbMediaUrls: values.pb_media_urls,
    })
  } catch (sendError) {
    console.error('Failed to send pacer registration webhook to GHL:', sendError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'pacer_signup',
      message: `Pendaftaran pacer baru: ${values.full_name} (HP: ${values.phone}, Kategori: ${values.category}).`,
      data: { pacerId: pacer.id, name: values.full_name, phone: values.phone },
    })
  } catch (logError) {
    console.error('Failed to log pacer signup:', logError)
  }

  let emailSent = false
  try {
    const verificationToken = generateVerificationToken()
    const tokenExpiry = getVerificationTokenExpiry()
    await setPacerVerificationToken(pacer.id, verificationToken, tokenExpiry)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=pacer`

    const emailResult = await sendVerificationEmail({
      email: values.email,
      name: values.full_name,
      verificationUrl,
      packageType: 'pacer',
    })
    emailSent = emailResult.success
    if (!emailResult.success) {
      console.error('Failed to send pacer verification email:', emailResult.error)
    }
  } catch (emailError) {
    console.error('Failed to send pacer verification email:', emailError)
  }

  return { success: true, phone: values.phone, emailSent }
}

export async function signInPacer(values: LoginFormValues) {
  const limit = rateLimit('pacer-login', 10, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Nomor HP/Email atau password tidak valid' }
  }

  const input = values.phone.trim()
  const isEmail = input.includes('@')

  let pacer = null
  let auth = null

  if (isEmail) {
    pacer = await findPacerByEmail(input)
    if (pacer) auth = await findPacerAuthById(pacer.id)
  } else {
    pacer = await findPacerByPhone(input)
    if (pacer) auth = await findPacerAuthByPhone(input)
  }

  if (!pacer || !auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP/Email atau password salah' }
  }

  if (!pacer.email_verified) {
    return {
      error: 'Email belum diverifikasi. Silakan cek email Anda untuk link aktivasi atau minta kirim ulang.',
      needsVerification: true,
      pacerId: pacer.id,
    }
  }

  clearRateLimit('pacer-login')
  await createPacerSession({ id: pacer.id, phone: pacer.phone, name: pacer.name })

  return { success: true, user: { id: pacer.id, phone: pacer.phone, name: pacer.name } }
}

export async function signOutPacer() {
  await clearPacerSession()
  return { success: true }
}
