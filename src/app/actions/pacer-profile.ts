'use server'

import { getPacerSession } from '@/lib/auth/pacer'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findPacerById,
  findPacerByEmail,
  findPacerByPhoneExcept,
  findPacerParticipantByPacerId,
  updatePacer,
  updatePacerAuthPassword,
  updatePacerAuthPhone,
  updatePacerParticipantById,
} from '@/lib/db'
import { pacerProfileSchema, PacerProfileValues } from '@/lib/validations/pacer'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'

export async function updatePacerProfile(values: PacerProfileValues) {
  const validated = pacerProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getPacerSession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const currentPacer = await findPacerById(session.id)
  if (!currentPacer) {
    return { error: 'Akun pacer tidak ditemukan.' }
  }

  const existingPhoneOwner = await findPacerByPhoneExcept(values.phone, session.id)
  if (existingPhoneOwner) return { error: 'Nomor HP sudah digunakan pacer lain.' }

  const existingEmailOwner = await findPacerByEmail(values.email)
  if (existingEmailOwner && existingEmailOwner.id !== session.id) {
    return { error: 'Email ini sudah terdaftar sebagai akun pacer lain.' }
  }

  await updatePacer(session.id, {
    name: values.full_name,
    phone: values.phone,
    email: values.email,
  })

  await updatePacerAuthPhone(session.id, values.phone)

  if (values.password) {
    await updatePacerAuthPassword(session.id, createPasswordRecord(values.password))
  }

  // Pacer = 1 akun 1 orang. Sinkronkan nama/email/HP ke record biodata.
  try {
    const participant = await findPacerParticipantByPacerId(session.id)
    if (participant) {
      await updatePacerParticipantById(participant.id, {
        full_name: values.full_name,
        phone: values.phone,
        email: values.email,
      })
    }
  } catch (syncError) {
    console.error('Failed to sync pacer participant profile:', syncError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'pacer',
      event: 'pacer_profile_updated',
      message: `Profil pacer diperbarui sendiri oleh pengguna: ${session.name} (Nama Baru: ${values.full_name}, HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: { pacerId: session.id, name: values.full_name, phone: values.phone, email: values.email },
    })
  } catch (logError) {
    console.error('Failed to log pacer profile update:', logError)
  }

  revalidatePath('/pacer-dashboard')

  return { success: true, message: 'Profil akun berhasil diperbarui.' }
}
