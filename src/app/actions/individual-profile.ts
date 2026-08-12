'use server'

import { clearIndividualSession, getIndividualSession } from '@/lib/auth/individual'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findAuthEmailOwner,
  findIndividualById,
  findIndividualByEmail,
  findIndividualByPhoneExcept,
  findIndividualParticipantsByIndividualId,
  setIndividualVerificationToken,
  updateIndividual,
  updateIndividualAuthPassword,
  updateIndividualAuthPhone,
  updateIndividualParticipantById,
} from '@/lib/db'
import { individualProfileSchema, IndividualProfileValues } from '@/lib/validations/individual'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'

function normalizeInputEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function updateIndividualProfile(values: IndividualProfileValues) {
  const validated = individualProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getIndividualSession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const currentIndividual = await findIndividualById(session.id)
  if (!currentIndividual) {
    return { error: 'Akun peserta individu tidak ditemukan.' }
  }

  const existingPhoneOwner = await findIndividualByPhoneExcept(values.phone, session.id)
  if (existingPhoneOwner) return { error: 'Nomor HP sudah digunakan peserta individu lain.' }

  const existingEmailOwner = await findAuthEmailOwner(values.email)
  if (existingEmailOwner) return { error: 'Email ini sudah terdaftar sebagai email login akun lain.' }

  const existingIndividualEmailOwner = await findIndividualByEmail(values.email)
  if (existingIndividualEmailOwner && existingIndividualEmailOwner.id !== session.id) {
    return { error: 'Email ini sudah terdaftar sebagai email login akun lain.' }
  }

  const currentEmail = currentIndividual.email ? normalizeInputEmail(currentIndividual.email) : null
  const nextEmail = normalizeInputEmail(values.email)
  const emailChanged = currentEmail !== nextEmail

  let verificationToken: string | null = null
  let tokenExpiry: Date | null = null

  if (emailChanged) {
    verificationToken = generateVerificationToken()
    tokenExpiry = getVerificationTokenExpiry()

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=individual`
    const emailResult = await sendVerificationEmail({
      email: values.email,
      name: values.full_name,
      verificationUrl,
      packageType: 'individual',
    })

    if (!emailResult.success) {
      return { error: emailResult.error || 'Gagal mengirim email aktivasi ke alamat baru.' }
    }
  }

  await updateIndividual(session.id, {
    name: values.full_name,
    leader_name: values.full_name,
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
    await setIndividualVerificationToken(session.id, verificationToken, tokenExpiry)
  }

  await updateIndividualAuthPhone(session.id, values.phone)

  if (values.password) {
    await updateIndividualAuthPassword(session.id, createPasswordRecord(values.password))
  }

  // Individu = 1 akun 1 peserta. Sinkronkan nama/email/HP ke record peserta
  // selama masih pending — setelah lunas, data BIB/QR dianggap final (dikelola admin).
  try {
    const participants = await findIndividualParticipantsByIndividualId(session.id)
    if (participants.length === 1 && participants[0].payment_status === 'pending') {
      await updateIndividualParticipantById(participants[0].id, {
        full_name: values.full_name,
        phone: values.phone,
        email: values.email,
      })
    }
  } catch (syncError) {
    console.error('Failed to sync individual participant profile:', syncError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'individual',
      event: emailChanged ? 'individual_profile_email_changed' : 'individual_profile_updated',
      message: emailChanged
        ? `Profil individu diperbarui dan email login diganti oleh pengguna: ${session.name} (Nama Baru: ${values.full_name}, HP Baru: ${values.phone}, Email Baru: ${values.email}). Aktivasi ulang diperlukan.`
        : `Profil individu diperbarui sendiri oleh pengguna: ${session.name} (Nama Baru: ${values.full_name}, HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: {
        individualId: session.id,
        name: values.full_name,
        phone: values.phone,
        email: values.email,
        emailChanged,
      }
    })
  } catch (logError) {
    console.error('Failed to log individual profile update:', logError)
  }

  revalidatePath('/individu-dashboard')

  if (emailChanged) {
    await clearIndividualSession()
    return {
      success: true,
      requiresVerification: true,
      redirectTo: '/login',
      message: 'Email berhasil diubah. Kami telah mengirim email aktivasi ke alamat baru. Silakan aktivasi ulang lalu login kembali.',
    }
  }

  return { success: true, message: 'Profil akun berhasil diperbarui.' }
}
