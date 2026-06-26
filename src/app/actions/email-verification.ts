'use server'

import {
  findFamilyByVerificationToken,
  verifyFamilyEmail,
  findFamilyById,
  setFamilyVerificationToken,
} from '@/lib/db'
import { createFamilySession } from '@/lib/auth/family'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'
import { ingestAdminLog } from '@/lib/axiom/ingest'

export async function verifyEmailToken(token: string) {
  if (!token) {
    return { error: 'Token verifikasi tidak valid.' }
  }

  const family = await findFamilyByVerificationToken(token)
  
  if (!family) {
    return { error: 'Token verifikasi tidak ditemukan atau sudah digunakan.' }
  }

  if (family.email_verified) {
    return { error: 'Email sudah diverifikasi sebelumnya. Silakan login.' }
  }

  // Check if token is expired
  if (family.verification_token_expires) {
    const expiresAt = new Date(family.verification_token_expires)
    if (expiresAt < new Date()) {
      return { error: 'Token verifikasi sudah kedaluwarsa. Silakan minta kirim ulang.' }
    }
  }

  // Verify the email
  await verifyFamilyEmail(family.id)

  // Create session automatically after verification
  await createFamilySession({
    id: family.id,
    phone: family.phone,
    name: family.name,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'family_email_verified',
      message: `Email berhasil diverifikasi untuk Brother & Sister Package: ${family.name} (${family.email}).`,
      data: {
        familyId: family.id,
        name: family.name,
        email: family.email,
      },
    })
  } catch (logError) {
    console.error('Failed to log email verification:', logError)
  }

  return { success: true, familyName: family.name }
}

export async function resendVerificationEmail(familyIdOrPhone: string) {
  // Try to find family by ID first, then by phone
  let family = await findFamilyById(familyIdOrPhone)
  
  if (!family) {
    // Try finding by phone
    const { findFamilyByPhone } = await import('@/lib/db')
    family = await findFamilyByPhone(familyIdOrPhone)
  }

  if (!family) {
    return { error: 'Akun tidak ditemukan.' }
  }

  if (family.email_verified) {
    return { error: 'Email sudah diverifikasi. Silakan login.' }
  }

  if (!family.email) {
    return { error: 'Email tidak terdaftar untuk akun ini.' }
  }

  // Check rate limit: max 1 email per 2 minutes
  if (family.verification_sent_at) {
    const lastSent = new Date(family.verification_sent_at)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    
    if (lastSent > twoMinutesAgo) {
      const waitSeconds = Math.ceil((lastSent.getTime() - twoMinutesAgo.getTime()) / 1000)
      return { error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kirim ulang.` }
    }
  }

  // Generate new token
  const verificationToken = generateVerificationToken()
  const tokenExpiry = getVerificationTokenExpiry()
  
  await setFamilyVerificationToken(family.id, verificationToken, tokenExpiry)
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`
  
  const result = await sendVerificationEmail({
    email: family.email,
    name: family.leader_name || family.name,
    verificationUrl,
  })

  if (!result.success) {
    return { error: result.error || 'Gagal mengirim email. Silakan coba lagi.' }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'family_verification_email_resent',
      message: `Email verifikasi dikirim ulang untuk Brother & Sister Package: ${family.name} (${family.email}).`,
      data: {
        familyId: family.id,
        name: family.name,
        email: family.email,
      },
    })
  } catch (logError) {
    console.error('Failed to log resend verification:', logError)
  }

  return { success: true }
}
