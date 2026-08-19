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
  findIndividualById,
  findIndividualByPhone,
  findIndividualByVerificationToken,
  setIndividualVerificationToken,
  verifyIndividualEmail,
  findPacerById,
  findPacerByPhone,
  findPacerByVerificationToken,
  setPacerVerificationToken,
  verifyPacerEmail,
  findUmkmById,
  findUmkmByPhone,
  findUmkmByVerificationToken,
  setUmkmVerificationToken,
  verifyUmkmEmail,
} from '@/lib/db'
import { createCommunitySession } from '@/lib/auth/community'
import { createFamilySession } from '@/lib/auth/family'
import { createIndividualSession } from '@/lib/auth/individual'
import { createPacerSession } from '@/lib/auth/pacer'
import { createUmkmSession } from '@/lib/auth/umkm'
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

  // Check UMKM first
  const umkm = await findUmkmByVerificationToken(token)
  if (umkm) {
    if (umkm.email_verified) {
      return { error: 'Email sudah diverifikasi sebelumnya. Silakan login.' }
    }
    if (umkm.verification_token_expires) {
      const expiresAt = new Date(umkm.verification_token_expires)
      if (expiresAt < new Date()) {
        return { error: 'Token verifikasi sudah kedaluwarsa. Silakan minta kirim ulang.' }
      }
    }

    await verifyUmkmEmail(umkm.id)
    await createUmkmSession({ id: umkm.id, phone: umkm.phone, name: umkm.name })

    try {
      await ingestAdminLog({
        level: 'info',
        source: 'auth',
        event: 'umkm_email_verified',
        message: `Email berhasil diverifikasi untuk UMKM: ${umkm.name} (${umkm.email}).`,
        data: { umkmId: umkm.id, name: umkm.name, email: umkm.email },
      })
    } catch (logError) {
      console.error('Failed to log UMKM email verification:', logError)
    }

    return {
      success: true,
      accountName: umkm.name,
      redirectPath: '/umkm-dashboard',
      packageLabel: 'Pendaftaran UMKM',
    }
  }

  const individual = await findIndividualByVerificationToken(token)
  if (individual) {
    if (individual.email_verified) {
      return { error: 'Email sudah diverifikasi sebelumnya. Silakan login.' }
    }
    if (individual.verification_token_expires) {
      const expiresAt = new Date(individual.verification_token_expires)
      if (expiresAt < new Date()) {
        return { error: 'Token verifikasi sudah kedaluwarsa. Silakan minta kirim ulang.' }
      }
    }

    await verifyIndividualEmail(individual.id)
    await createIndividualSession({ id: individual.id, phone: individual.phone, name: individual.name })

    try {
      await ingestAdminLog({
        level: 'info',
        source: 'auth',
        event: 'individual_email_verified',
        message: `Email berhasil diverifikasi untuk peserta individu: ${individual.name} (${individual.email}).`,
        data: { individualId: individual.id, name: individual.name, email: individual.email },
      })
    } catch (logError) {
      console.error('Failed to log email verification:', logError)
    }

    return {
      success: true,
      accountName: individual.name,
      redirectPath: '/individu-dashboard',
      packageLabel: 'Pendaftaran Individu',
    }
  }

  const pacer = await findPacerByVerificationToken(token)
  if (pacer) {
    if (pacer.email_verified) {
      return { error: 'Email sudah diverifikasi sebelumnya. Silakan login.' }
    }
    if (pacer.verification_token_expires) {
      const expiresAt = new Date(pacer.verification_token_expires)
      if (expiresAt < new Date()) {
        return { error: 'Token verifikasi sudah kedaluwarsa. Silakan minta kirim ulang.' }
      }
    }

    await verifyPacerEmail(pacer.id)
    await createPacerSession({ id: pacer.id, phone: pacer.phone, name: pacer.name })

    try {
      await ingestAdminLog({
        level: 'info',
        source: 'auth',
        event: 'pacer_email_verified',
        message: `Email berhasil diverifikasi untuk pacer: ${pacer.name} (${pacer.email}).`,
        data: { pacerId: pacer.id, name: pacer.name, email: pacer.email },
      })
    } catch (logError) {
      console.error('Failed to log email verification:', logError)
    }

    return {
      success: true,
      accountName: pacer.name,
      redirectPath: '/pacer-dashboard',
      packageLabel: 'Pendaftaran Pacer',
    }
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
  // Check UMKM first
  let umkmRecord = await findUmkmById(identifier)
  if (!umkmRecord) umkmRecord = await findUmkmByPhone(identifier)
  if (!umkmRecord) umkmRecord = await findUmkmByVerificationToken(identifier)

  if (umkmRecord) {
    if (umkmRecord.email_verified) return { error: 'Email sudah diverifikasi. Silakan login.' }

    const waitSeconds = isResendLimited(umkmRecord.verification_sent_at)
    if (waitSeconds) return { error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kirim ulang.` }

    const verificationToken = generateVerificationToken()
    const tokenExpiry = getVerificationTokenExpiry()
    await setUmkmVerificationToken(umkmRecord.id, verificationToken, tokenExpiry)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=umkm`

    const result = await sendVerificationEmail({
      email: umkmRecord.email,
      name: umkmRecord.pic_name || umkmRecord.name,
      verificationUrl,
      packageType: 'umkm',
    })

    if (!result.success) return { error: result.error || 'Gagal mengirim email. Silakan coba lagi.' }
    return { success: true }
  }

  let pacer = await findPacerById(identifier)
  if (!pacer) pacer = await findPacerByPhone(identifier)
  if (!pacer) pacer = await findPacerByVerificationToken(identifier)

  if (pacer) {
    if (pacer.email_verified) return { error: 'Email sudah diverifikasi. Silakan login.' }

    const waitSeconds = isResendLimited(pacer.verification_sent_at)
    if (waitSeconds) return { error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kirim ulang.` }

    const verificationToken = generateVerificationToken()
    const tokenExpiry = getVerificationTokenExpiry()
    await setPacerVerificationToken(pacer.id, verificationToken, tokenExpiry)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=pacer`

    const result = await sendVerificationEmail({
      email: pacer.email,
      name: pacer.name,
      verificationUrl,
      packageType: 'pacer',
    })

    if (!result.success) return { error: result.error || 'Gagal mengirim email. Silakan coba lagi.' }
    return { success: true }
  }

  let individual = await findIndividualById(identifier)
  if (!individual) individual = await findIndividualByPhone(identifier)
  if (!individual) individual = await findIndividualByVerificationToken(identifier)

  if (individual) {
    if (individual.email_verified) return { error: 'Email sudah diverifikasi. Silakan login.' }
    if (!individual.email) return { error: 'Email tidak terdaftar untuk akun ini.' }

    const waitSeconds = isResendLimited(individual.verification_sent_at)
    if (waitSeconds) return { error: `Silakan tunggu ${waitSeconds} detik sebelum meminta kirim ulang.` }

    const verificationToken = generateVerificationToken()
    const tokenExpiry = getVerificationTokenExpiry()
    await setIndividualVerificationToken(individual.id, verificationToken, tokenExpiry)

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=individual`

    const result = await sendVerificationEmail({
      email: individual.email,
      name: individual.leader_name || individual.name,
      verificationUrl,
      packageType: 'individual',
    })

    if (!result.success) return { error: result.error || 'Gagal mengirim email. Silakan coba lagi.' }
    return { success: true }
  }

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
