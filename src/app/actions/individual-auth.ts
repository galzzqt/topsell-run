'use server'

import { clearIndividualSession, createIndividualSession } from '@/lib/auth/individual'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createIndividual,
  deleteIndividual,
  findIndividualByPhone,
  findIndividualByEmail,
  findIndividualAuthByPhone,
  findIndividualAuthById,
  findAuthEmailOwner,
  insertIndividualParticipants,
  saveIndividualAuth,
  updateIndividual,
  findActiveCrossIndividualParticipant,
  createIndividualRegistration,
  createIndividualPayment,
  linkIndividualParticipantsToRegistration,
  setIndividualVerificationToken,
  findVoucherByCode,
  findBestAutoVoucher,
  incrementVoucherUsage,
  markIndividualPaymentPaid,
} from '@/lib/db'
import { registerSoloSchema, loginSchema, RegisterSoloFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendIndividualRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { resolvePackagePrice, isPackageOpen, checkPackageQuota, resolvePeriodForCategory } from '@/lib/admin/settings'
import { generateRandomReference, getWibNowString } from '@/lib/utils/format'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'
import { rateLimit, rateLimitByIp, clearRateLimit } from '@/lib/security/rate-limit'

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

export async function signUpIndividual(values: RegisterSoloFormValues, voucherCode?: string) {
  const limit = await rateLimitByIp('individual-signup', 20, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  const validated = registerSoloSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data registrasi tidak valid' }
  }

  const gate = await isPackageOpen('individual')
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran individu sedang ditutup.' }
  }

  const quota = await checkPackageQuota('individual', values.participants.length, values.category)
  if (!quota.ok) {
    return { error: quota.reason || 'Kuota peserta individu sudah penuh.' }
  }

  const existingIndividual = await findIndividualByPhone(values.phone)
  if (existingIndividual) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
  }

  const existingEmailOwner = (await findAuthEmailOwner(values.email)) || (await findIndividualByEmail(values.email))
  if (existingEmailOwner) {
    return { error: 'Email ini sudah terdaftar sebagai email login. Silakan login atau gunakan email lain.' }
  }

  for (const participant of values.participants) {
    const crossParticipant = await findActiveCrossIndividualParticipant(participant.email, participant.phone)
    if (crossParticipant && crossParticipant.participant) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} dan nomor HP ${participant.phone} sudah terdaftar aktif di sistem (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}).`
      }
    }
  }

  const basePrice = await resolvePackagePrice('individual', values.category)
  const totalAmount = values.participants.length * basePrice

  let voucherDiscount = 0
  let voucherId = null
  let finalVoucherCode: string | null = null

  const now = getWibNowString()
  const cleanVoucherCode = typeof voucherCode === 'string' ? voucherCode.trim() : ''
  const isAuto = !cleanVoucherCode || cleanVoucherCode.toUpperCase() === 'AUTO'

  if (isAuto) {
    // Try to auto-apply
    const autoVoucher = await findBestAutoVoucher('individual', values.category, now)
    if (autoVoucher) {
      voucherId = autoVoucher.id
      finalVoucherCode = autoVoucher.code || 'AUTO'
      if (autoVoucher.discountType === 'percent') {
        voucherDiscount = Math.round((totalAmount * autoVoucher.discountValue) / 100)
      } else {
        voucherDiscount = Math.min(autoVoucher.discountValue, totalAmount)
      }
    }
  } else {
    // Manual voucher code entered
    const voucher = await findVoucherByCode(cleanVoucherCode, 'individual', values.category, now)
    if (voucher) {
      voucherId = voucher.id
      finalVoucherCode = voucher.code
      if (voucher.discountType === 'percent') {
        voucherDiscount = Math.round((totalAmount * voucher.discountValue) / 100)
      } else {
        voucherDiscount = Math.min(voucher.discountValue, totalAmount)
      }
    } else {
      return { error: 'Kode voucher tidak valid atau sudah kadaluarsa.' }
    }
  }

  const finalAmount = Math.max(0, totalAmount - voucherDiscount)

  let individual
  try {
    individual = await createIndividual({
      name: values.name,
      leader_name: values.leader_name,
      email: values.email,
      phone: values.phone,
      category: values.category,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
      voucher_code: finalVoucherCode,
      voucher_discount: voucherDiscount,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil peserta individu.' }
  }

  try {
    await saveIndividualAuth(individual.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteIndividual(individual.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun peserta.' }
  }

  try {
    await updateIndividual(individual.id, { email: values.email, category: values.category })
  } catch (error) {
    await deleteIndividual(individual.id)
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui profil peserta.' }
  }

  const period = await resolvePeriodForCategory('individual', values.category)

  let participantIds: string[] = []
  try {
    const inserted = await insertIndividualParticipants(
      values.participants.map((p) => ({
        individual_id: individual.id,
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
    participantIds = inserted.map((p) => p.id)
  } catch (error) {
    await deleteIndividual(individual.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data peserta.' }
  }

  const paymentRef = toXenditReference(generateRandomReference('IND'))

  try {
    const isFreeByVoucher = finalAmount === 0

    const registration = await createIndividualRegistration({
      individual_id: individual.id,
      total_participants: values.participants.length,
      total_amount: finalAmount,
      voucher_code: finalVoucherCode,
      voucher_discount: voucherDiscount,
      status: 'pending',
    })
    await linkIndividualParticipantsToRegistration(participantIds, registration.id)
    const payment = await createIndividualPayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: isFreeByVoucher ? `FREE-IND-${individual.individual_code}` : paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })

    // Jika gratis karena voucher: transisikan dari pending → paid sehingga
    // activatePaidIndividualParticipants dipanggil (generate kode & QR peserta).
    if (isFreeByVoucher) {
      await markIndividualPaymentPaid(payment.id, {
        payment_method: 'voucher_free',
        paid_at: new Date().toISOString(),
      })
    }

    if (voucherId) {
      await incrementVoucherUsage(voucherId)
    }
  } catch (error) {
    console.error('Failed to create individual auto-payment record:', error)
  }

  try {
    await sendIndividualRegistrationConfirmationWebhook({
      phone: values.phone,
      familyName: values.name,
      representativeName: values.leader_name,
      participantCount: values.participants.length,
    })
  } catch (sendError) {
    console.error('Failed to send individual registration confirmation WhatsApp:', sendError)
  }

  let emailSent = false
  if (values.email) {
    try {
      const verificationToken = generateVerificationToken()
      const tokenExpiry = getVerificationTokenExpiry()
      await setIndividualVerificationToken(individual.id, verificationToken, tokenExpiry)

      const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
      const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=individual`

      const emailResult = await sendVerificationEmail({
        email: values.email,
        name: values.leader_name || values.name,
        verificationUrl,
        packageType: 'individual',
      })
      emailSent = emailResult.success
      if (!emailResult.success) {
        console.error('Failed to send individual verification email:', emailResult.error)
      }
    } catch (emailError) {
      console.error('Failed to send individual verification email:', emailError)
    }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'individual_signup',
      message: `Pendaftaran individu baru: ${values.name} (HP: ${values.phone}, Kategori: ${values.category}).`,
      data: { individualId: individual.id, name: values.name, phone: values.phone },
    })
  } catch (logError) {
    console.error('Failed to log individual signup:', logError)
  }

  return { success: true, phone: values.phone, emailSent }
}

export async function signInIndividual(values: LoginFormValues) {
  const limit = await rateLimitByIp('individual-login', 20, 5 * 60 * 1000, values.phone)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Nomor HP/Email atau password tidak valid' }
  }

  const input = values.phone.trim()
  const isEmail = input.includes('@')

  let individual = null
  let auth = null

  if (isEmail) {
    individual = await findIndividualByEmail(input)
    if (individual) auth = await findIndividualAuthById(individual.id)
  } else {
    individual = await findIndividualByPhone(input)
    if (individual) auth = await findIndividualAuthByPhone(input)
  }

  if (!individual || !auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP/Email atau password salah' }
  }

  if (!individual.email_verified) {
    return {
      error: 'Email belum diverifikasi. Silakan cek email Anda untuk link aktivasi atau minta kirim ulang.',
      needsVerification: true,
      individualId: individual.id,
    }
  }

  clearRateLimit('individual-login')
  await createIndividualSession({ id: individual.id, phone: individual.phone, name: individual.name })

  return { success: true, user: { id: individual.id, phone: individual.phone, name: individual.name } }
}

export async function signOutIndividual() {
  await clearIndividualSession()
  return { success: true }
}
