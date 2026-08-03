'use server'

import { clearCommunitySession, getCommunitySession } from '@/lib/auth/community'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findAuthEmailOwner,
  findCommunityById,
  findCommunityByPhoneExcept,
  setCommunityVerificationToken,
  updateCommunity,
  updateCommunityAuthPassword,
  updateCommunityAuthPhone,
} from '@/lib/db'
import { communityProfileSchema, CommunityProfileValues } from '@/lib/validations/community'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'

function normalizeInputEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function updateCommunityProfile(values: CommunityProfileValues) {
  const validated = communityProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getCommunitySession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const currentCommunity = await findCommunityById(session.id)
  if (!currentCommunity) {
    return { error: 'Akun komunitas tidak ditemukan.' }
  }

  const existing = await findCommunityByPhoneExcept(values.phone, session.id)
  if (existing) return { error: 'Nomor HP sudah digunakan komunitas lain.' }

  const existingEmailOwner = await findAuthEmailOwner(values.email, { type: 'community', id: session.id })
  if (existingEmailOwner) return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan akun lain.' }

  const currentEmail = currentCommunity.email ? normalizeInputEmail(currentCommunity.email) : null
  const nextEmail = normalizeInputEmail(values.email)
  const emailChanged = currentEmail !== nextEmail

  let verificationToken: string | null = null
  let tokenExpiry: Date | null = null

  if (emailChanged) {
    verificationToken = generateVerificationToken()
    tokenExpiry = getVerificationTokenExpiry()

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`
    const emailResult = await sendVerificationEmail({
      email: values.email,
      name: currentCommunity.leader_name || currentCommunity.name,
      verificationUrl,
      packageType: 'community',
    })

    if (!emailResult.success) {
      return { error: emailResult.error || 'Gagal mengirim email aktivasi ke alamat baru.' }
    }
  }

  await updateCommunity(session.id, {
    phone: values.phone,
    email: values.email,
    ...(emailChanged
      ? {
          email_verified: false,
          verification_token: null,
          verification_token_expires: null,
        }
      : {}),
  })

  if (emailChanged && verificationToken && tokenExpiry) {
    await setCommunityVerificationToken(session.id, verificationToken, tokenExpiry)
  }

  await updateCommunityAuthPhone(session.id, values.phone)

  if (values.password) {
    await updateCommunityAuthPassword(session.id, createPasswordRecord(values.password))
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'community',
      event: emailChanged ? 'community_profile_email_changed' : 'community_profile_updated',
      message: emailChanged
        ? `Profil komunitas diperbarui dan email login diganti oleh pengguna: ${session.name} (HP Baru: ${values.phone}, Email Baru: ${values.email}). Aktivasi ulang diperlukan.`
        : `Profil komunitas diperbarui sendiri oleh pengguna: ${session.name} (HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: {
        communityId: session.id,
        name: session.name,
        phone: values.phone,
        email: values.email,
        emailChanged,
      }
    })
  } catch (logError) {
    console.error('Failed to log community profile update:', logError)
  }

  revalidatePath('/community-dashboard')

  if (emailChanged) {
    await clearCommunitySession()
    return {
      success: true,
      requiresVerification: true,
      redirectTo: '/community-login',
      message: 'Email perwakilan berhasil diubah. Kami telah mengirim email aktivasi ke alamat baru. Silakan aktivasi ulang lalu login kembali.',
    }
  }

  return { success: true, message: 'Profil akun berhasil diperbarui.' }
}
