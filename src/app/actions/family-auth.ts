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
  findVoucherByCode,
  findBestAutoVoucher,
  incrementVoucherUsage,
} from '@/lib/db'
import { registerFamilySchema, registerSoloSchema, loginSchema, RegisterFamilyFormValues, RegisterSoloFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendFamilyRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { resolvePackagePrice, isPackageOpen, checkPackageQuota, resolvePeriodForCategory } from '@/lib/admin/settings'
import { generateRandomReference } from '@/lib/utils/format'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'
import { rateLimit, clearRateLimit } from '@/lib/security/rate-limit'

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

export async function signUpFamily(
  values: RegisterFamilyFormValues | RegisterSoloFormValues,
  registrationType: 'individual' | 'family' = 'family',
  voucherCode?: string,
) {
  const limit = rateLimit('family-signup', 5, 10 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  // Individu pakai schema solo (1 peserta, kategori 3K/6K); Bro & Sist minimal 3.
  const schema = registrationType === 'individual' ? registerSoloSchema : registerFamilySchema
  const validated = schema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const gate = await isPackageOpen(registrationType)
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran paket ini sedang ditutup.' }
  }

  const quota = await checkPackageQuota(registrationType, values.participants.length, values.category)
  if (!quota.ok) {
    return { error: quota.reason || 'Kuota peserta paket ini sudah penuh.' }
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

  const basePrice = await resolvePackagePrice('family', values.category)
  const totalAmount = values.participants.length * basePrice

  let voucherDiscount = 0
  let voucherId = null
  let finalVoucherCode = voucherCode || null

  const now = new Date().toISOString().slice(0, 16)
  if (finalVoucherCode) {
    const voucher = await findVoucherByCode(finalVoucherCode, 'family', values.category, now)
    if (voucher) {
      voucherId = voucher.id
      if (voucher.discountType === 'percent') {
        voucherDiscount = Math.round((totalAmount * voucher.discountValue) / 100)
      } else {
        voucherDiscount = Math.min(voucher.discountValue, totalAmount)
      }
    } else {
      return { error: 'Kode voucher tidak valid atau sudah kadaluarsa.' }
    }
  } else {
    // Try to auto-apply
    const autoVoucher = await findBestAutoVoucher('family', values.category, now)
    if (autoVoucher) {
      voucherId = autoVoucher.id
      finalVoucherCode = autoVoucher.code || 'AUTO'
      if (autoVoucher.discountType === 'percent') {
        voucherDiscount = Math.round((totalAmount * autoVoucher.discountValue) / 100)
      } else {
        voucherDiscount = Math.min(autoVoucher.discountValue, totalAmount)
      }
    }
  }

  const finalAmount = Math.max(0, totalAmount - voucherDiscount)

  let family
  try {
    family = await createFamily({
      name: values.name,
      leader_name: values.leader_name,
      email: values.email,
      phone: values.phone,
      category: values.category,
      registration_type: registrationType,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
      voucher_code: finalVoucherCode,
      voucher_discount: voucherDiscount,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil Bro & Sist Package.' }
  }

  try {
    await saveFamilyAuth(family.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun Bro & Sist Package.' }
  }

  try {
    await updateFamily(family.id, { email: values.email, category: values.category })
  } catch (error) {
    await deleteFamily(family.id)
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui profil Bro & Sist Package.' }
  }

  const period = await resolvePeriodForCategory(registrationType, values.category)

  let participantIds: string[] = []
  try {
    const insertedParticipants = await insertFamilyParticipants(
      values.participants.map((p) => ({
        family_id: family.id,
        registration_id: null,
        period_key: period?.key ?? null,
        full_name: p.full_name,
        bib_name: p.bib_name,
        ktp_number: p.ktp_number,
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

  const paymentRefRaw = generateRandomReference('FAM')
  const paymentRef = toXenditReference(paymentRefRaw)

  try {
    const registration = await createFamilyRegistration({
      family_id: family.id,
      total_participants: values.participants.length,
      total_amount: finalAmount,
      voucher_code: finalVoucherCode,
      voucher_discount: voucherDiscount,
      status: 'pending',
    })

    await linkFamilyParticipantsToRegistration(participantIds, registration.id)

    await createFamilyPayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })

    if (voucherId) {
      await incrementVoucherUsage(voucherId)
    }
  } catch (error) {
    console.error('Failed to create auto-payment record:', error)
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
      
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`
      
      await sendVerificationEmail({
        email: values.email,
        name: values.leader_name || values.name,
        verificationUrl,
        packageType: 'family',
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
      message: `Pendaftaran Bro & Sist Package baru: ${values.name} (Perwakilan: ${values.leader_name}, HP: ${values.phone}, Jumlah Anggota: ${values.participants.length}).`,
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
  const limit = rateLimit('family-login', 10, 5 * 60 * 1000)
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

  clearRateLimit('family-login')
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
      message: `Bro & Sist Package login berhasil: ${family.name} (HP: ${family.phone}).`,
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
