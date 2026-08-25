'use server'

import { clearInvitationSession, getInvitationSession } from '@/lib/auth/invitation'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findAuthEmailOwner,
  findInvitationById,
  findInvitationByEmail,
  findInvitationByPhoneExcept,
  findInvitationParticipantsByInvitationId,
  setInvitationVerificationToken,
  updateInvitation,
  updateInvitationAuthPassword,
  updateInvitationAuthPhone,
  updateInvitationParticipantById,
} from '@/lib/db'
import { invitationProfileSchema, InvitationProfileValues } from '@/lib/validations/invitation'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { generateVerificationToken, getVerificationTokenExpiry, sendVerificationEmail } from '@/lib/email/verification'

function normalizeInputEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function updateInvitationProfile(values: InvitationProfileValues) {
  const validated = invitationProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getInvitationSession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const currentInvitation = await findInvitationById(session.id)
  if (!currentInvitation) {
    return { error: 'Akun peserta invitation tidak ditemukan.' }
  }

  const existingPhoneOwner = await findInvitationByPhoneExcept(values.phone, session.id)
  if (existingPhoneOwner) return { error: 'Nomor HP sudah digunakan peserta invitation lain.' }

  const existingEmailOwner = await findAuthEmailOwner(values.email)
  if (existingEmailOwner) return { error: 'Email ini sudah terdaftar sebagai email login akun lain.' }

  const existingInvitationEmailOwner = await findInvitationByEmail(values.email)
  if (existingInvitationEmailOwner && existingInvitationEmailOwner.id !== session.id) {
    return { error: 'Email ini sudah terdaftar sebagai email login akun lain.' }
  }

  const currentEmail = currentInvitation.email ? normalizeInputEmail(currentInvitation.email) : null
  const nextEmail = normalizeInputEmail(values.email)
  const emailChanged = currentEmail !== nextEmail

  let verificationToken: string | null = null
  let tokenExpiry: Date | null = null

  if (emailChanged) {
    verificationToken = generateVerificationToken()
    tokenExpiry = getVerificationTokenExpiry()

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}&type=invitation`
    const emailResult = await sendVerificationEmail({
      email: values.email,
      name: values.full_name,
      verificationUrl,
      packageType: 'invitation',
    })

    if (!emailResult.success) {
      return { error: emailResult.error || 'Gagal mengirim email aktivasi ke alamat baru.' }
    }
  }

  await updateInvitation(session.id, {
    name: values.full_name,
    leader_name: values.full_name,
    phone: values.phone,
    email: values.email,
    community_name: values.community_name ? values.community_name.trim() : null,
    ...(emailChanged
      ? {
          email_verified: false,
          verification_token: null,
          verification_token_expires: null,
        }
      : {}),
  })

  if (emailChanged && verificationToken && tokenExpiry) {
    await setInvitationVerificationToken(session.id, verificationToken, tokenExpiry)
  }

  await updateInvitationAuthPhone(session.id, values.phone)

  if (values.password) {
    await updateInvitationAuthPassword(session.id, createPasswordRecord(values.password))
  }

  // Invitation = 1 akun 1 peserta. Sinkronkan nama/email/HP/instansi ke record peserta
  // selama masih pending — setelah lunas, data BIB/QR dianggap final (dikelola admin).
  try {
    const participants = await findInvitationParticipantsByInvitationId(session.id)
    if (participants.length === 1 && participants[0].payment_status === 'pending') {
      await updateInvitationParticipantById(participants[0].id, {
        full_name: values.full_name,
        phone: values.phone,
        email: values.email,
        community_name: values.community_name ? values.community_name.trim() : null,
      })
    }
  } catch (syncError) {
    console.error('Failed to sync invitation participant profile:', syncError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'invitation',
      event: emailChanged ? 'invitation_profile_email_changed' : 'invitation_profile_updated',
      message: emailChanged
        ? `Profil invitation diperbarui dan email login diganti oleh pengguna: ${session.name} (Nama Baru: ${values.full_name}, HP Baru: ${values.phone}, Email Baru: ${values.email}). Aktivasi ulang diperlukan.`
        : `Profil invitation diperbarui sendiri oleh pengguna: ${session.name} (Nama Baru: ${values.full_name}, HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: {
        invitationId: session.id,
        name: values.full_name,
        phone: values.phone,
        email: values.email,
        emailChanged,
      }
    })
  } catch (logError) {
    console.error('Failed to log invitation profile update:', logError)
  }

  revalidatePath('/invitation-dashboard')

  if (emailChanged) {
    await clearInvitationSession()
    return {
      success: true,
      requiresVerification: true,
      redirectTo: '/login',
      message: 'Email berhasil diubah. Kami telah mengirim email aktivasi ke alamat baru. Silakan aktivasi ulang lalu login kembali.',
    }
  }

  return { success: true, message: 'Profil akun berhasil diperbarui.' }
}
