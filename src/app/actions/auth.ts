'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { registerSchema, loginSchema, RegisterFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { phoneToAuthEmail } from '@/lib/utils/phone-auth'

function isAlreadyRegisteredAuthError(error: { message?: string; code?: string; status?: number } | null) {
  if (!error) return false
  const message = error.message?.toLowerCase() || ''
  return error.status === 422 && message.includes('already') && message.includes('registered')
}

async function findAuthUserByEmail(adminClient: ReturnType<typeof createAdminClient>, email: string) {
  const targetEmail = email.toLowerCase()
  const perPage = 1000

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) return { error }

    const user = data.users.find((item) => item.email?.toLowerCase() === targetEmail)
    if (user) return { user }
    if (data.users.length < perPage) return {}
  }

  return {}
}

async function createCommunityAuthUser(
  adminClient: ReturnType<typeof createAdminClient>,
  values: RegisterFormValues,
  authEmail: string
) {
  const createPayload = {
    email: authEmail,
    password: values.password,
    email_confirm: true,
    user_metadata: {
      name: values.name,
      leader_name: values.leader_name,
      phone: values.phone,
      contact_email: values.email,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
    },
  }

  const result = await adminClient.auth.admin.createUser(createPayload)
  if (!isAlreadyRegisteredAuthError(result.error)) return result

  const existingAuthUser = await findAuthUserByEmail(adminClient, authEmail)
  if (existingAuthUser.error) return result
  if (!existingAuthUser.user) return result

  const { data: existingCommunity, error: existingCommunityError } = await adminClient
    .from('communities')
    .select('id')
    .eq('id', existingAuthUser.user.id)
    .maybeSingle()

  if (existingCommunityError) return result
  if (existingCommunity) {
    return {
      data: { user: null },
      error: {
        message: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.',
      },
    }
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingAuthUser.user.id)
  if (deleteError) {
    return {
      data: { user: null },
      error: {
        message: 'Nomor WhatsApp ini pernah tersimpan di Auth, tetapi profil komunitasnya tidak ditemukan. Hapus user yatim tersebut dari Supabase Auth lalu coba daftar lagi.',
      },
    }
  }

  return adminClient.auth.admin.createUser(createPayload)
}

export async function signUpCommunity(values: RegisterFormValues) {
  const validated = registerSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data registrasi tidak valid'
    return { error: errorMsg }
  }

  const adminClient = createAdminClient()
  const authEmail = phoneToAuthEmail(values.phone)

  const existingCommunity = await adminClient
    .from('communities')
    .select('id')
    .eq('phone', values.phone)
    .maybeSingle()

  if (existingCommunity.data) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
  }

  const { data, error } = await createCommunityAuthUser(adminClient, values, authEmail)

  if (error) {
    return { error: isAlreadyRegisteredAuthError(error) ? 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' : error.message }
  }

  if (!data.user) {
    return { error: 'Gagal membuat user' }
  }

  const { data: community, error: communityEmailError } = await adminClient
    .from('communities')
    .update({ email: values.email })
    .eq('id', data.user.id)
    .select('id')
    .maybeSingle()

  if (communityEmailError) {
    await adminClient.auth.admin.deleteUser(data.user.id)
    return { error: `Gagal menyimpan email komunitas: ${communityEmailError.message}` }
  }

  if (!community) {
    await adminClient.auth.admin.deleteUser(data.user.id)
    return { error: 'Gagal membuat profil komunitas. Pastikan trigger on_auth_user_created sudah terpasang di Supabase.' }
  }

  const participantsData = values.participants.map((p) => ({
    community_id: data.user!.id,
    full_name: p.full_name,
    bib_name: p.bib_name,
    email: p.email,
    phone: p.phone,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
    tshirt_size: p.tshirt_size,
    blood_type: p.blood_type,
    medical_condition: p.medical_condition || null,
    emergency_contact_name: p.emergency_contact_name,
    emergency_contact_phone: p.emergency_contact_phone,
    provinsi: values.provinsi,
    kota: values.kota,
    kecamatan: values.kecamatan,
    payment_status: 'pending',
  }))

  const { error: insertError } = await adminClient
    .from('participants')
    .insert(participantsData)

  if (insertError) {
    await adminClient.auth.admin.deleteUser(data.user.id)
    return { error: `Gagal menyimpan data peserta: ${insertError.message}` }
  }

  try {
    await sendRegistrationConfirmationWebhook({
      phone: values.phone,
      communityName: values.name,
      leaderName: values.leader_name,
      participantCount: values.participants.length,
    })
  } catch (sendError) {
    console.error('Failed to send registration confirmation WhatsApp:', sendError)
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: values.password,
  })

  if (signInError) {
    return { error: 'Pendaftaran berhasil, tetapi gagal masuk otomatis. Silakan login dengan nomor HP dan password.' }
  }

  return { success: true, phone: values.phone }
}

export async function signInCommunity(values: LoginFormValues) {
  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: 'Nomor HP atau password tidak valid' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(values.phone),
    password: values.password,
  })

  if (error) {
    return { error: 'Nomor HP atau password salah' }
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
