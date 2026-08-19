'use server'

import { clearUmkmSession, createUmkmSession, getUmkmSession } from '@/lib/auth/umkm'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createUmkm,
  deleteUmkm,
  findUmkmByPhone,
  findUmkmByEmail,
  findUmkmAuthById,
  findUmkmAuthByPhone,
  saveUmkmAuth,
  setUmkmVerificationToken,
  findUmkmByVerificationToken,
} from '@/lib/db'
import { findVoucherByCode, findBestAutoVoucher } from '@/lib/db'
import { registerUmkmSchema, loginSchema, type RegisterUmkmFormValues, type LoginFormValues } from '@/lib/validations/auth'
import { rateLimit, rateLimitByIp, clearRateLimit } from '@/lib/security/rate-limit'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'
import { isPackageOpen } from '@/lib/admin/settings'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { getWibNowString } from '@/lib/utils/format'

const UMKM_BASE_PRICE = 500000

export async function signUpUmkm(values: RegisterUmkmFormValues, voucherCode?: string | null) {
  const gate = await isPackageOpen('umkm')
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran Tenant UMKM saat ini sedang ditutup.' }
  }

  const limit = await rateLimitByIp('umkm-signup', 20, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  const validated = registerUmkmSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const existingByPhone = await findUmkmByPhone(values.phone)
  if (existingByPhone) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
  }

  const existingByEmail = await findUmkmByEmail(values.email)
  if (existingByEmail) {
    return { error: 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.' }
  }

  // Resolve voucher
  const now = getWibNowString()
  const cleanVoucherCode = typeof voucherCode === 'string' ? voucherCode.trim() : ''
  const isAuto = cleanVoucherCode.toUpperCase() === 'AUTO'
  const isNone = cleanVoucherCode.toUpperCase() === 'NONE'

  let voucherDiscount = 0
  let finalVoucherCode: string | null = null

  if (isNone) {
    voucherDiscount = 0
    finalVoucherCode = null
  } else if (isAuto || !cleanVoucherCode) {
    const autoVoucher = await findBestAutoVoucher('umkm', 'Tenant UMKM 500.000', now)
    if (autoVoucher) {
      finalVoucherCode = autoVoucher.code || autoVoucher.name || 'AUTO'
      if (autoVoucher.discountType === 'percent') {
        voucherDiscount = Math.round((UMKM_BASE_PRICE * autoVoucher.discountValue) / 100)
      } else {
        voucherDiscount = Math.min(autoVoucher.discountValue, UMKM_BASE_PRICE)
      }
    }
  } else {
    const voucher = await findVoucherByCode(cleanVoucherCode, 'umkm', 'Tenant UMKM 500.000', now)
    if (voucher) {
      finalVoucherCode = voucher.code
      if (voucher.discountType === 'percent') {
        voucherDiscount = Math.round((UMKM_BASE_PRICE * voucher.discountValue) / 100)
      } else {
        voucherDiscount = Math.min(voucher.discountValue, UMKM_BASE_PRICE)
      }
    } else {
      return { error: 'Kode voucher tidak valid atau sudah kadaluarsa.' }
    }
  }

  const finalAmount = Math.max(0, UMKM_BASE_PRICE - voucherDiscount)

  let umkm
  try {
    umkm = await createUmkm({
      name: values.name,
      pic_name: values.pic_name,
      email: values.email,
      phone: values.phone,
      business_field: values.business_field,
      description: values.description,
      social_media: values.social_media,
      photo_urls: values.photo_urls,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
      address: values.address,
      voucher_code: finalVoucherCode,
      voucher_discount: voucherDiscount,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil UMKM.' }
  }

  // Override payment_amount and payment_status after voucher
  try {
    const { updateUmkm, createUmkmPayment } = await import('@/lib/db')
    if (finalAmount === 0) {
      await updateUmkm(umkm.id, { payment_amount: 0, payment_status: 'paid' })
      await createUmkmPayment({
        umkm_id: umkm.id,
        amount: 0,
        payment_method: 'voucher_free',
        payment_reference: `FREE-${umkm.umkm_code}`,
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
    } else {
      await updateUmkm(umkm.id, { payment_amount: finalAmount })
    }
  } catch {
    // non-fatal
  }

  try {
    await saveUmkmAuth(umkm.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteUmkm(umkm.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun UMKM.' }
  }

  // Send verification email
  let emailSent = false
  try {
    const verificationToken = generateVerificationToken()
    const tokenExpiry = getVerificationTokenExpiry()
    await setUmkmVerificationToken(umkm.id, verificationToken, tokenExpiry)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=umkm`

    const emailResult = await sendVerificationEmail({
      email: values.email,
      name: values.pic_name || values.name,
      verificationUrl,
      packageType: 'umkm',
    })
    emailSent = emailResult.success
  } catch (emailError) {
    console.error('Failed to send UMKM verification email:', emailError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'umkm_signup',
      message: `Pendaftaran UMKM baru: ${values.name} (PIC: ${values.pic_name}, HP: ${values.phone}).`,
      data: {
        umkmId: umkm.id,
        name: values.name,
        pic_name: values.pic_name,
        phone: values.phone,
        voucherCode: finalVoucherCode,
        finalAmount,
      },
    })
  } catch (logError) {
    console.error('Failed to log UMKM signup:', logError)
  }

  return { success: true, phone: values.phone, emailSent }
}

export async function signInUmkm(values: LoginFormValues) {
  const limit = await rateLimitByIp('umkm-login', 20, 5 * 60 * 1000, values.phone)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Nomor HP/Email atau password tidak valid' }
  }

  const input = values.phone.trim()
  const isEmail = input.includes('@')

  let umkm = null
  let auth = null

  if (isEmail) {
    umkm = await findUmkmByEmail(input)
    if (umkm) auth = await findUmkmAuthById(umkm.id)
  } else {
    umkm = await findUmkmByPhone(input)
    if (umkm) auth = await findUmkmAuthByPhone(input)
  }

  if (!umkm || !auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP/Email atau password salah' }
  }

  if (!umkm.email_verified) {
    return {
      error: 'Email belum diverifikasi. Silakan cek email Anda untuk link aktivasi atau minta kirim ulang.',
      needsVerification: true,
      umkmId: umkm.id,
    }
  }

  clearRateLimit('umkm-login')
  await createUmkmSession({ id: umkm.id, phone: umkm.phone, name: umkm.name })

  return { success: true, user: { id: umkm.id, phone: umkm.phone, name: umkm.name } }
}

export async function signOutUmkm() {
  await clearUmkmSession()
  return { success: true }
}
