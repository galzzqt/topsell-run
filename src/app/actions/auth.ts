'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { registerSchema, loginSchema, RegisterFormValues, LoginFormValues } from '@/lib/validations/auth'

export async function signUpCommunity(values: RegisterFormValues) {
  const validated = registerSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const supabase = await createClient()

  // Sign up in Supabase Auth
  // We pass metadata that our PostgreSQL trigger 'on_auth_user_created' will read
  const { data, error } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      data: {
        name: values.name,
        leader_name: values.leader_name,
        phone: values.phone,
        provinsi: values.provinsi,
        kota: values.kota,
        kecamatan: values.kecamatan,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.user) {
    return { error: 'Gagal membuat user' }
  }

  // Insert initial participants using admin client to bypass initial RLS (since user may not be signed in yet/email confirmation pending)
  const adminClient = createAdminClient()
  const participantsData = values.participants.map((p) => ({
    community_id: data.user!.id,
    full_name: p.full_name,
    bib_name: p.bib_name,
    email: p.email,
    phone: p.phone,
    gender: p.gender,
    tshirt_size: p.tshirt_size,
    blood_type: p.blood_type,
    medical_condition: p.medical_condition || null,
    payment_status: 'pending',
  }))

  const { error: insertError } = await adminClient
    .from('participants')
    .insert(participantsData)

  if (insertError) {
    // Rollback auth user creation if participants fail to insert
    await adminClient.auth.admin.deleteUser(data.user.id)
    return { error: `Gagal menyimpan data peserta: ${insertError.message}` }
  }

  // Automatically sign in the user to establish the cookies/session
  await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  })

  return { success: true, user: data.user }
}

export async function signInCommunity(values: LoginFormValues) {
  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: 'Email atau password tidak valid' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  })

  if (error) {
    return { error: 'Email atau password salah' }
  }

  return { success: true, user: data.user }
}

export async function signOutCommunity() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
