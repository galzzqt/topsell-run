'use server'

import {
  findCommunityById,
  findCommunityByPhone,
  findCommunityByVerificationToken,
  findFamilyById,
  findFamilyByPhone,
  findFamilyByVerificationToken,
  setCommunityVerificationToken,
  setFamilyVerificationToken,
  verifyCommunityEmail,
  verifyFamilyEmail,
} from '@/lib/db'
import { createCommunitySession } from '@/lib/auth/community'
import { createFamilySession } from '@/lib/auth/family'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'
import { ingestAdminLog } from '@/lib/axiom/ingest'

function isResendLimited(sentAt: string | null) {
  if (!sentAt) return null

  const lastSent = new Date(sentAt)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)

  if (lastSent <= twoMinutesAgo) return null

  return Math.ceil((lastSent.getTime() - twoMinutesAgo.getTime()) / 1000)
}

export async function verifyEmailToken(token: string) {
  if (!token) {
    return { error: 'Token verifikasi tidak valid.' }
  }

  const family = await findFamilyByVerificationToken(token)
  if (family) {
    if (family.email_verified) {
      return { error: 'Email sudah diverifikasi sebelumnya. Silakan login.' }
    }

    if (family.verification_token_expires) {
      const expiresAt = new Date(family.verification_token_expires)
      if (expiresAt < new Date()) {
        return { error: 'Token verifikasi sudah kedaluwarsa. Silakan minta kirim ulang.' }
      }
    }

    await verifyFamilyEmail(family.id)
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
        message: `Email berhasil diverifikasi untuk Bro & Sist Package: ${family.name} (${family.email}).`,
        data: {
          familyId: family.id,
          name: family.name,
          email: family.email,
        },
      })
    } catch (logError) {
      console.error('Failed to log email verification:', logError)
    }

    return {
      success: true,
      accountName: family.name,
      redirectPath: '/dashboard',
      packageLabel: 'Bro & Sist Package',
    }
  }

  const community = await findCommunityByVerificationToken(token)
  if (!community) {
    return { error: 'Token verifikasi tidak ditemukan atau sudah digunakan.' }
  }

  if (community.email_verified) {
    return { error: 'Email sudah diverifikasi sebelumnya. Silakan login.' }
  }

  if (community.verification_token_expires) {
    const expiresAt = new Date(community.verification_token_expires)
    if (expiresAt < new Date()) {
      return { error: 'Token verifikasi sudah kedaluwarsa. Silakan minta kirim ulang.' }
    }
  }

  await verifyCommunityEmail(community.id)
  await createCommunitySession({
    id: community.id,
    phone: community.phone,
    name: community.name,
  })

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'community_email_verified',
      message: `Email berhasil diverifikasi untuk Community Package: ${community.name} (${community.email}).`,
      data: {
        communityId: community.id,
        name: community.name,
        email: community.email,
      },
    })
  } catch (logError) {
    console.error('Failed to log email verification:', logError)
  }

  return {
    success: true,
    accountName: community.name,
    redirectPath: '/community-dashboard',
    packageLabel: 'Community Package',
  }
}

export async function resendVerificationEmail(identifier: string) {
  let family = await findFamilyById(identifier)
  if (!family) {
    family = await findFamilyByPhone(identifier)
  }
  if (!family) {
    family = await findFamilyByVerificationToken(identifier)
  }

  if (family) {
    if (family.email_verified) {
      return { error: 'Email sudah diverifikasi. Silakan login.' }
    }

    if (!family.email) {
      return { error: 'Email tidak terdaftar untuk akun ini.' }
    }

    const waitSeconds = isResendLimited(family.verification_sent_at)
    if (waitSeconds) {
      return { error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kirim ulang.` }
    }

    const verificationToken = generateVerificationToken()
    const tokenExpiry = getVerificationTokenExpiry()
    await setFamilyVerificationToken(family.id, verificationToken, tokenExpiry)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`

    const result = await sendVerificationEmail({
      email: family.email,
      name: family.leader_name || family.name,
      verificationUrl,
      packageType: 'family',
    })

    if (!result.success) {
      return { error: result.error || 'Gagal mengirim email. Silakan coba lagi.' }
    }

    try {
      await ingestAdminLog({
        level: 'info',
        source: 'auth',
        event: 'family_verification_email_resent',
        message: `Email verifikasi dikirim ulang untuk Bro & Sist Package: ${family.name} (${family.email}).`,
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

  let community = await findCommunityById(identifier)
  if (!community) {
    community = await findCommunityByPhone(identifier)
  }
  if (!community) {
    community = await findCommunityByVerificationToken(identifier)
  }

  if (!community) {
    return { error: 'Akun tidak ditemukan.' }
  }

  if (community.email_verified) {
    return { error: 'Email sudah diverifikasi. Silakan login.' }
  }

  if (!community.email) {
    return { error: 'Email tidak terdaftar untuk akun ini.' }
  }

  const waitSeconds = isResendLimited(community.verification_sent_at)
  if (waitSeconds) {
    return { error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kirim ulang.` }
  }

  const verificationToken = generateVerificationToken()
  const tokenExpiry = getVerificationTokenExpiry()
  await setCommunityVerificationToken(community.id, verificationToken, tokenExpiry)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`

  const result = await sendVerificationEmail({
    email: community.email,
    name: community.leader_name || community.name,
    verificationUrl,
    packageType: 'community',
  })

  if (!result.success) {
    return { error: result.error || 'Gagal mengirim email. Silakan coba lagi.' }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'community_verification_email_resent',
      message: `Email verifikasi dikirim ulang untuk Community Package: ${community.name} (${community.email}).`,
      data: {
        communityId: community.id,
        name: community.name,
        email: community.email,
      },
    })
  } catch (logError) {
    console.error('Failed to log resend verification:', logError)
  }

  return { success: true }
}
