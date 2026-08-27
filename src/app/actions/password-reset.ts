'use server'

import {
  findIndividualByEmailOrPhone,
  findFamilyByEmailOrPhone,
  findCommunityByEmailOrPhone,
  findInvitationByEmailOrPhone,
  findPacerByEmailOrPhone,
  findUmkmByEmailOrPhone,
  findIndividualById,
  findFamilyById,
  findCommunityById,
  findInvitationById,
  findPacerById,
  findUmkmById,
  findIndividualByResetPasswordToken,
  findFamilyByResetPasswordToken,
  findCommunityByResetPasswordToken,
  findInvitationByResetPasswordToken,
  findPacerByResetPasswordToken,
  findUmkmByResetPasswordToken,
  setIndividualResetPasswordToken,
  setFamilyResetPasswordToken,
  setCommunityResetPasswordToken,
  setInvitationResetPasswordToken,
  setPacerResetPasswordToken,
  setUmkmResetPasswordToken,
  clearIndividualResetPasswordToken,
  clearFamilyResetPasswordToken,
  clearCommunityResetPasswordToken,
  clearInvitationResetPasswordToken,
  clearPacerResetPasswordToken,
  clearUmkmResetPasswordToken,
  updateIndividualAuthPassword,
  updateFamilyAuthPassword,
  updateCommunityAuthPassword,
  updateInvitationAuthPassword,
  updatePacerAuthPassword,
  updateUmkmAuthPassword,
} from '@/lib/db'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  generateResetPasswordToken,
  getResetPasswordTokenExpiry,
  sendPasswordResetEmail,
} from '@/lib/email/password-reset'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { getAdminSession } from '@/lib/admin/auth'

type PackageType = 'community' | 'family' | 'individual' | 'invitation' | 'pacer' | 'umkm'

async function getBaseAppUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  }
  try {
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const host = headersList.get('x-forwarded-host') || headersList.get('host')
    const proto = headersList.get('x-forwarded-proto') || 'https'
    if (host) {
      return `${proto}://${host}`
    }
  } catch {
    // fallback
  }
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

function isResendLimited(sentAt: string | null | undefined) {
  if (!sentAt) return null
  const lastSent = new Date(sentAt)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
  if (lastSent <= twoMinutesAgo) return null
  return Math.ceil((lastSent.getTime() - twoMinutesAgo.getTime()) / 1000)
}

/**
 * Permintaan reset password oleh user mandiri melalui form /forgot-password
 */
export async function requestPasswordReset(identifier: string): Promise<{
  success?: boolean
  message?: string
  error?: string
}> {
  const trimmed = identifier.trim()
  if (!trimmed) {
    return { error: 'Silakan masukkan nomor WhatsApp atau email Anda.' }
  }

  // 1. Cari user di seluruh tipe paket
  let user: {
    id: string
    name: string
    email: string | null
    phone: string
    packageType: PackageType
    resetSentAt?: string | null
  } | null = null

  // Cek Individual
  const individual = await findIndividualByEmailOrPhone(trimmed)
  if (individual) {
    user = {
      id: individual.id,
      name: individual.name,
      email: individual.email,
      phone: individual.phone,
      packageType: 'individual',
      resetSentAt: individual.reset_password_sent_at,
    }
  }

  // Cek Family
  if (!user) {
    const family = await findFamilyByEmailOrPhone(trimmed)
    if (family) {
      user = {
        id: family.id,
        name: family.name,
        email: family.email,
        phone: family.phone,
        packageType: 'family',
        resetSentAt: family.reset_password_sent_at,
      }
    }
  }

  // Cek Community
  if (!user) {
    const community = await findCommunityByEmailOrPhone(trimmed)
    if (community) {
      user = {
        id: community.id,
        name: community.name,
        email: community.email,
        phone: community.phone,
        packageType: 'community',
        resetSentAt: community.reset_password_sent_at,
      }
    }
  }

  // Cek Invitation
  if (!user) {
    const invitation = await findInvitationByEmailOrPhone(trimmed)
    if (invitation) {
      user = {
        id: invitation.id,
        name: invitation.name,
        email: invitation.email,
        phone: invitation.phone,
        packageType: 'invitation',
        resetSentAt: invitation.reset_password_sent_at,
      }
    }
  }

  // Cek Pacer
  if (!user) {
    const pacer = await findPacerByEmailOrPhone(trimmed)
    if (pacer) {
      user = {
        id: pacer.id,
        name: pacer.name,
        email: pacer.email,
        phone: pacer.phone,
        packageType: 'pacer',
        resetSentAt: pacer.reset_password_sent_at,
      }
    }
  }

  // Cek UMKM
  if (!user) {
    const umkm = await findUmkmByEmailOrPhone(trimmed)
    if (umkm) {
      user = {
        id: umkm.id,
        name: umkm.pic_name || umkm.name,
        email: umkm.email,
        phone: umkm.phone,
        packageType: 'umkm',
        resetSentAt: umkm.reset_password_sent_at,
      }
    }
  }

  if (!user) {
    // Demi keamanan, tetap beri respon umum agar tidak dieksploitasi untuk cek nomor/email terdaftar
    return {
      success: true,
      message: 'Jika akun terdaftar, link reset password telah dikirim ke email Anda. Silakan cek kotak masuk (inbox) atau folder spam.',
    }
  }

  if (!user.email) {
    return {
      error: 'Akun Anda tidak memiliki email terdaftar. Silakan hubungi CS melalui WhatsApp untuk bantuan reset password.',
    }
  }

  // Cooldown check (2 menit)
  const waitSeconds = isResendLimited(user.resetSentAt)
  if (waitSeconds) {
    return {
      error: `Silakan tunggu ${waitSeconds} detik sebelum meminta link reset password baru.`,
    }
  }

  // Generate 32-byte token dengan masa berlaku 24 jam
  const token = generateResetPasswordToken()
  const expiresAt = getResetPasswordTokenExpiry()

  // Simpan token ke database
  switch (user.packageType) {
    case 'individual':
      await setIndividualResetPasswordToken(user.id, token, expiresAt)
      break
    case 'family':
      await setFamilyResetPasswordToken(user.id, token, expiresAt)
      break
    case 'community':
      await setCommunityResetPasswordToken(user.id, token, expiresAt)
      break
    case 'invitation':
      await setInvitationResetPasswordToken(user.id, token, expiresAt)
      break
    case 'pacer':
      await setPacerResetPasswordToken(user.id, token, expiresAt)
      break
    case 'umkm':
      await setUmkmResetPasswordToken(user.id, token, expiresAt)
      break
  }

  const appUrl = await getBaseAppUrl()
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  const emailResult = await sendPasswordResetEmail({
    email: user.email,
    name: user.name,
    resetUrl,
    packageType: user.packageType,
  })

  if (!emailResult.success) {
    return {
      error: emailResult.error || 'Gagal mengirim email reset password. Silakan coba lagi atau hubungi CS.',
    }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'password_reset_requested',
      message: `Link reset password diminta untuk ${user.packageType}: ${user.name} (${user.email}).`,
      data: { userId: user.id, packageType: user.packageType, email: user.email },
    })
  } catch (err) {
    console.error('Failed to log reset password request:', err)
  }

  return {
    success: true,
    message: `Link reset password berhasil dikirim ke email ${user.email}. Silakan cek inbox atau folder spam Anda.`,
  }
}

/**
 * Memverifikasi validitas token reset password saat membuka halaman /reset-password?token=...
 */
export async function verifyResetPasswordToken(token: string): Promise<{
  valid: boolean
  name?: string
  email?: string
  packageType?: PackageType
  loginUrl?: string
  error?: string
}> {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token reset password tidak valid atau tidak ditemukan.' }
  }

  // Cari token di setiap tabel
  let foundUser: {
    name: string
    email: string | null
    packageType: PackageType
    expiresAt: string | null | undefined
    loginUrl: string
  } | null = null

  const individual = await findIndividualByResetPasswordToken(token)
  if (individual) {
    foundUser = {
      name: individual.name,
      email: individual.email,
      packageType: 'individual',
      expiresAt: individual.reset_password_token_expires,
      loginUrl: '/login',
    }
  }

  if (!foundUser) {
    const family = await findFamilyByResetPasswordToken(token)
    if (family) {
      foundUser = {
        name: family.name,
        email: family.email,
        packageType: 'family',
        expiresAt: family.reset_password_token_expires,
        loginUrl: '/login',
      }
    }
  }

  if (!foundUser) {
    const community = await findCommunityByResetPasswordToken(token)
    if (community) {
      foundUser = {
        name: community.name,
        email: community.email,
        packageType: 'community',
        expiresAt: community.reset_password_token_expires,
        loginUrl: '/community-login',
      }
    }
  }

  if (!foundUser) {
    const invitation = await findInvitationByResetPasswordToken(token)
    if (invitation) {
      foundUser = {
        name: invitation.name,
        email: invitation.email,
        packageType: 'invitation',
        expiresAt: invitation.reset_password_token_expires,
        loginUrl: '/login',
      }
    }
  }

  if (!foundUser) {
    const pacer = await findPacerByResetPasswordToken(token)
    if (pacer) {
      foundUser = {
        name: pacer.name,
        email: pacer.email,
        packageType: 'pacer',
        expiresAt: pacer.reset_password_token_expires,
        loginUrl: '/login',
      }
    }
  }

  if (!foundUser) {
    const umkm = await findUmkmByResetPasswordToken(token)
    if (umkm) {
      foundUser = {
        name: umkm.pic_name || umkm.name,
        email: umkm.email,
        packageType: 'umkm',
        expiresAt: umkm.reset_password_token_expires,
        loginUrl: '/umkm-login',
      }
    }
  }

  if (!foundUser) {
    return {
      valid: false,
      error: 'Link reset password tidak valid atau sudah pernah digunakan sebelumnya.',
    }
  }

  if (foundUser.expiresAt) {
    const expires = new Date(foundUser.expiresAt)
    if (expires < new Date()) {
      return {
        valid: false,
        error: 'Link reset password sudah kedaluwarsa (berlaku 24 jam). Silakan minta link baru melalui menu Lupa Password.',
      }
    }
  }

  return {
    valid: true,
    name: foundUser.name,
    email: foundUser.email || undefined,
    packageType: foundUser.packageType,
    loginUrl: foundUser.loginUrl,
  }
}

/**
 * Menyelesaikan proses reset password (submit password baru)
 */
export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<{
  success?: boolean
  message?: string
  loginUrl?: string
  error?: string
}> {
  if (!token || !newPassword) {
    return { error: 'Data tidak lengkap.' }
  }

  if (newPassword.length < 6) {
    return { error: 'Password baru minimal 6 karakter.' }
  }

  // Cari user berdasarkan token
  let user: {
    id: string
    name: string
    email: string | null
    packageType: PackageType
    expiresAt: string | null | undefined
    loginUrl: string
  } | null = null

  const individual = await findIndividualByResetPasswordToken(token)
  if (individual) {
    user = {
      id: individual.id,
      name: individual.name,
      email: individual.email,
      packageType: 'individual',
      expiresAt: individual.reset_password_token_expires,
      loginUrl: '/login',
    }
  }

  if (!user) {
    const family = await findFamilyByResetPasswordToken(token)
    if (family) {
      user = {
        id: family.id,
        name: family.name,
        email: family.email,
        packageType: 'family',
        expiresAt: family.reset_password_token_expires,
        loginUrl: '/login',
      }
    }
  }

  if (!user) {
    const community = await findCommunityByResetPasswordToken(token)
    if (community) {
      user = {
        id: community.id,
        name: community.name,
        email: community.email,
        packageType: 'community',
        expiresAt: community.reset_password_token_expires,
        loginUrl: '/community-login',
      }
    }
  }

  if (!user) {
    const invitation = await findInvitationByResetPasswordToken(token)
    if (invitation) {
      user = {
        id: invitation.id,
        name: invitation.name,
        email: invitation.email,
        packageType: 'invitation',
        expiresAt: invitation.reset_password_token_expires,
        loginUrl: '/login',
      }
    }
  }

  if (!user) {
    const pacer = await findPacerByResetPasswordToken(token)
    if (pacer) {
      user = {
        id: pacer.id,
        name: pacer.name,
        email: pacer.email,
        packageType: 'pacer',
        expiresAt: pacer.reset_password_token_expires,
        loginUrl: '/login',
      }
    }
  }

  if (!user) {
    const umkm = await findUmkmByResetPasswordToken(token)
    if (umkm) {
      user = {
        id: umkm.id,
        name: umkm.pic_name || umkm.name,
        email: umkm.email,
        packageType: 'umkm',
        expiresAt: umkm.reset_password_token_expires,
        loginUrl: '/umkm-login',
      }
    }
  }

  if (!user) {
    return {
      error: 'Link reset password tidak valid atau sudah kedaluwarsa. Silakan ajukan reset password baru.',
    }
  }

  if (user.expiresAt) {
    const expires = new Date(user.expiresAt)
    if (expires < new Date()) {
      return {
        error: 'Link reset password sudah kedaluwarsa (berlaku 24 jam). Silakan ajukan reset password baru.',
      }
    }
  }

  // Hash password baru
  const passwordRecord = createPasswordRecord(newPassword)

  // Update password dan bersihkan token reset
  switch (user.packageType) {
    case 'individual':
      await updateIndividualAuthPassword(user.id, passwordRecord)
      await clearIndividualResetPasswordToken(user.id)
      break
    case 'family':
      await updateFamilyAuthPassword(user.id, passwordRecord)
      await clearFamilyResetPasswordToken(user.id)
      break
    case 'community':
      await updateCommunityAuthPassword(user.id, passwordRecord)
      await clearCommunityResetPasswordToken(user.id)
      break
    case 'invitation':
      await updateInvitationAuthPassword(user.id, passwordRecord)
      await clearInvitationResetPasswordToken(user.id)
      break
    case 'pacer':
      await updatePacerAuthPassword(user.id, passwordRecord)
      await clearPacerResetPasswordToken(user.id)
      break
    case 'umkm':
      await updateUmkmAuthPassword(user.id, passwordRecord)
      await clearUmkmResetPasswordToken(user.id)
      break
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'password_reset_completed',
      message: `Password berhasil diubah untuk ${user.packageType}: ${user.name} (${user.email || '-'}).`,
      data: { userId: user.id, packageType: user.packageType },
    })
  } catch (err) {
    console.error('Failed to log password reset completion:', err)
  }

  return {
    success: true,
    message: 'Password berhasil diatur ulang! Silakan masuk kembali dengan password baru Anda.',
    loginUrl: user.loginUrl,
  }
}

/**
 * Dipicu oleh Admin dari Admin Dashboard untuk mengirim / membuat link reset password
 */
export async function adminTriggerPasswordReset(
  packageType: PackageType | string,
  id: string
): Promise<{
  success?: boolean
  resetUrl?: string
  email?: string
  name?: string
  error?: string
}> {
  const admin = await getAdminSession()
  if (!admin) {
    return { error: 'Akses ditolak. Sesi admin tidak valid.' }
  }

  let user: {
    id: string
    name: string
    email: string | null
    packageType: PackageType
  } | null = null

  if (packageType === 'individual') {
    const doc = await findIndividualById(id)
    if (doc) user = { id: doc.id, name: doc.name, email: doc.email, packageType: 'individual' }
  } else if (packageType === 'family') {
    const doc = await findFamilyById(id)
    if (doc) user = { id: doc.id, name: doc.name, email: doc.email, packageType: 'family' }
  } else if (packageType === 'community') {
    const doc = await findCommunityById(id)
    if (doc) user = { id: doc.id, name: doc.name, email: doc.email, packageType: 'community' }
  } else if (packageType === 'invitation') {
    const doc = await findInvitationById(id)
    if (doc) user = { id: doc.id, name: doc.name, email: doc.email, packageType: 'invitation' }
  } else if (packageType === 'pacer') {
    const doc = await findPacerById(id)
    if (doc) user = { id: doc.id, name: doc.name, email: doc.email, packageType: 'pacer' }
  } else if (packageType === 'umkm') {
    const doc = await findUmkmById(id)
    if (doc) user = { id: doc.id, name: doc.pic_name || doc.name, email: doc.email, packageType: 'umkm' }
  }

  if (!user) {
    return { error: 'Data user tidak ditemukan.' }
  }

  const token = generateResetPasswordToken()
  const expiresAt = getResetPasswordTokenExpiry()

  switch (user.packageType) {
    case 'individual':
      await setIndividualResetPasswordToken(user.id, token, expiresAt)
      break
    case 'family':
      await setFamilyResetPasswordToken(user.id, token, expiresAt)
      break
    case 'community':
      await setCommunityResetPasswordToken(user.id, token, expiresAt)
      break
    case 'invitation':
      await setInvitationResetPasswordToken(user.id, token, expiresAt)
      break
    case 'pacer':
      await setPacerResetPasswordToken(user.id, token, expiresAt)
      break
    case 'umkm':
      await setUmkmResetPasswordToken(user.id, token, expiresAt)
      break
  }

  const appUrl = await getBaseAppUrl()
  const resetUrl = `${appUrl}/reset-password?token=${token}`

  if (user.email) {
    await sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
      packageType: user.packageType,
    })
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'admin',
      event: 'admin_password_reset_triggered',
      message: `Admin (${admin.username}) memicu link reset password untuk ${user.packageType}: ${user.name} (${user.email || '-'}).`,
      data: { adminId: admin.username, userId: user.id, packageType: user.packageType },
    })
  } catch (err) {
    console.error('Failed to log admin password reset trigger:', err)
  }

  return {
    success: true,
    resetUrl,
    email: user.email || undefined,
    name: user.name,
  }
}
