'use server'

import { getCommunitySession } from '@/lib/auth/community'
import { createPasswordRecord } from '@/lib/auth/password'
import {
  findCommunityByPhoneExcept,
  updateCommunity,
  updateCommunityAuthPassword,
  updateCommunityAuthPhone,
} from '@/lib/db'
import { communityProfileSchema, CommunityProfileValues } from '@/lib/validations/community'
import { revalidatePath } from 'next/cache'
import { ingestAdminLog } from '@/lib/axiom/ingest'

export async function updateCommunityProfile(values: CommunityProfileValues) {
  const validated = communityProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getCommunitySession()
  if (!session) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const existing = await findCommunityByPhoneExcept(values.phone, session.id)
  if (existing) return { error: 'Nomor HP sudah digunakan komunitas lain.' }

  await updateCommunity(session.id, {
    phone: values.phone,
    email: values.email,
  })

  await updateCommunityAuthPhone(session.id, values.phone)

  if (values.password) {
    await updateCommunityAuthPassword(session.id, createPasswordRecord(values.password))
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'community',
      event: 'community_profile_updated',
      message: `Profil komunitas diperbarui sendiri oleh pengguna: ${session.name} (HP Baru: ${values.phone}, Email Baru: ${values.email}).`,
      data: {
        communityId: session.id,
        name: session.name,
        phone: values.phone,
        email: values.email,
      }
    })
  } catch (logError) {
    console.error('Failed to log community profile update:', logError)
  }

  revalidatePath('/dashboard')
  return { success: true }
}
