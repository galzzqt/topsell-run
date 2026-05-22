'use server'

import { createClient } from '@/lib/supabase/server'
import { communityProfileSchema, CommunityProfileValues } from '@/lib/validations/community'
import { revalidatePath } from 'next/cache'

export async function updateCommunityProfile(values: CommunityProfileValues) {
  const validated = communityProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const { error } = await supabase
    .from('communities')
    .update({
      name: values.name,
      leader_name: values.leader_name,
      phone: values.phone,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
