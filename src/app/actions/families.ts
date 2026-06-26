'use server'

import { getFamilySession } from '@/lib/auth/family'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findAuthEmailOwner,
  findFamilyByPhoneExcept,
  updateFamily,
  updateFamilyAuthPassword,
  updateFamilyAuthPhone,
} from '@/lib/db'
import { familyProfileSchema, FamilyProfileValues } from '@/lib/validations/family'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'

export async function updateFamilyProfile(values: FamilyProfileValues) {
  const validated = familyProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getFamilySession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const existing = await findFamilyByPhoneExcept(values.phone, session.id)
  if (existing) return { error: 'Nomor HP sudah digunakan grup Brother & Sister lain.' }

  const existingEmailOwner = await findAuthEmailOwner(values.email, { type: 'family', id: session.id })
  if (existingEmailOwner) return { error: 'Email ini sudah terdaftar sebagai email login/perwakilan akun lain.' }

  await updateFamily(session.id, {
    phone: values.phone,
    email: values.email,
  })

  await updateFamilyAuthPhone(session.id, values.phone)

  if (values.password) {
    await updateFamilyAuthPassword(session.id, createPasswordRecord(values.password))
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'family',
      event: 'family_profile_updated',
      message: `Profil Brother & Sister Package diperbarui sendiri oleh pengguna: ${session.name} (HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: {
        familyId: session.id,
        name: session.name,
        phone: values.phone,
        email: values.email,
      }
    })
  } catch (logError) {
    console.error('Failed to log family profile update:', logError)
  }

  revalidatePath('/dashboard')
  return { success: true }
}
