'use server'

import { clearFamilySession, getFamilySession } from '@/lib/auth/family'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findAuthEmailOwner,
  findFamilyById,
  findFamilyByPhoneExcept,
  setFamilyVerificationToken,
  updateFamily,
  updateFamilyAuthPassword,
  updateFamilyAuthPhone,
} from '@/lib/db'
import { familyProfileSchema, FamilyProfileValues } from '@/lib/validations/family'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'

function normalizeInputEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function updateFamilyProfile(values: FamilyProfileValues) {
  const validated = familyProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getFamilySession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const currentFamily = await findFamilyById(session.id)
  if (!currentFamily) {
    return { error: 'Akun Bro & Sist Package tidak ditemukan.' }
  }

  const existing = await findFamilyByPhoneExcept(values.phone, session.id)
  if (existing) return { error: 'Nomor HP sudah digunakan grup Bro & Sist lain.' }

  const existingEmailOwner = await findAuthEmailOwner(values.email, { type: 'family', id: session.id })
  if (existingEmailOwner) return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan akun lain.' }

  const currentEmail = currentFamily.email ? normalizeInputEmail(currentFamily.email) : null
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
      name: currentFamily.leader_name || currentFamily.name,
      verificationUrl,
      packageType: 'family',
    })

    if (!emailResult.success) {
      return { error: emailResult.error || 'Gagal mengirim email aktivasi ke alamat baru.' }
    }
  }

  await updateFamily(session.id, {
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
    await setFamilyVerificationToken(session.id, verificationToken, tokenExpiry)
  }

  await updateFamilyAuthPhone(session.id, values.phone)

  if (values.password) {
    await updateFamilyAuthPassword(session.id, createPasswordRecord(values.password))
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'family',
      event: emailChanged ? 'family_profile_email_changed' : 'family_profile_updated',
      message: emailChanged
        ? `Profil Bro & Sist Package diperbarui dan email login diganti oleh pengguna: ${session.name} (HP Baru: ${values.phone}, Email Baru: ${values.email}). Aktivasi ulang diperlukan.`
        : `Profil Bro & Sist Package diperbarui sendiri oleh pengguna: ${session.name} (HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: {
        familyId: session.id,
        name: session.name,
        phone: values.phone,
        email: values.email,
        emailChanged,
      }
    })
  } catch (logError) {
    console.error('Failed to log family profile update:', logError)
  }

  revalidatePath('/dashboard')

  if (emailChanged) {
    await clearFamilySession()
    return {
      success: true,
      requiresVerification: true,
      redirectTo: '/login',
      message: 'Email perwakilan berhasil diubah. Kami telah mengirim email aktivasi ke alamat baru. Silakan aktivasi ulang lalu login kembali.',
    }
  }

  return { success: true, message: 'Profil akun berhasil diperbarui.' }
}
