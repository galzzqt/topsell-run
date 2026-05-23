'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { communityProfileSchema, CommunityProfileValues } from '@/lib/validations/community'
import { phoneToAuthEmail } from '@/lib/utils/phone-auth'
import { revalidatePath } from 'next/cache'

export async function updateCommunityProfile(values: CommunityProfileValues) {
  const validated = communityProfileSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const { data: existing, error: existingError } = await admin
    .from('communities')
    .select('id')
    .eq('phone', values.phone)
    .neq('id', user.id)
    .maybeSingle()

  if (existingError) return { error: existingError.message }
  if (existing) return { error: 'Nomor HP sudah digunakan komunitas lain.' }

  const { error } = await supabase
    .from('communities')
    .update({
      phone: values.phone,
      email: values.email,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(user.id, {
    email: phoneToAuthEmail(values.phone),
    ...(values.password ? { password: values.password } : {}),
    user_metadata: {
      ...user.user_metadata,
      phone: values.phone,
      contact_email: values.email,
    },
  })

  if (authUpdateError) return { error: authUpdateError.message }

  revalidatePath('/dashboard')
  return { success: true }
}
