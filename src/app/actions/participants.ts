'use server'

import { createClient } from '@/lib/supabase/server'
import { participantSchema, participantEditSchema, ParticipantFormValues } from '@/lib/validations/participant'
import { revalidatePath } from 'next/cache'

// Add a single participant under the logged-in community
export async function addParticipant(values: ParticipantFormValues) {
  const validated = participantSchema.safeParse(values)
  if (!validated.success) {
    const errorMsg = validated.error.issues[0]?.message || 'Data peserta tidak valid'
    return { error: errorMsg }
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const { data, error } = await supabase
    .from('participants')
    .insert({
      community_id: user.id,
      full_name: values.full_name,
      bib_name: values.bib_name,
      email: values.email,
      phone: values.phone,
      gender: values.gender,
      tshirt_size: values.tshirt_size,
      blood_type: values.blood_type,
      medical_condition: values.medical_condition || null,
      provinsi: values.provinsi || null,
      kota: values.kota || null,
      kecamatan: values.kecamatan || null,
      payment_status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true, participant: data }
}

// Add multiple participants in one batch (Excel import)
export async function addParticipantsBatch(rows: ParticipantFormValues[]) {
  if (!rows || rows.length === 0) {
    return { error: 'Tidak ada data peserta untuk diimpor.' }
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  // Validate all rows
  for (let i = 0; i < rows.length; i++) {
    const v = participantSchema.safeParse(rows[i])
    if (!v.success) {
      return { error: `Baris ${i + 1}: ${v.error.issues[0]?.message}` }
    }
  }

  const insertRows = rows.map((r) => ({
    community_id: user.id,
    full_name: r.full_name,
    bib_name: r.bib_name,
    email: r.email,
    phone: r.phone,
    gender: r.gender,
    tshirt_size: r.tshirt_size,
    blood_type: r.blood_type,
    medical_condition: r.medical_condition || null,
    provinsi: r.provinsi || null,
    kota: r.kota || null,
    kecamatan: r.kecamatan || null,
    payment_status: 'pending' as const,
  }))

  const { data, error } = await supabase
    .from('participants')
    .insert(insertRows)
    .select()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true, count: data.length }
}

// Update a single participant
export async function updateParticipant(participantId: string, values: ParticipantFormValues) {
  const validated = participantEditSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  // Verify participant is pending (cannot edit paid)
  const { data: existing } = await supabase
    .from('participants')
    .select('payment_status')
    .eq('id', participantId)
    .eq('community_id', user.id)
    .single()

  if (!existing) return { error: 'Peserta tidak ditemukan.' }
  if (existing.payment_status === 'paid') {
    return { error: 'Peserta yang sudah lunas tidak dapat diedit.' }
  }

  const { error } = await supabase
    .from('participants')
    .update({
      full_name: values.full_name,
      bib_name: values.bib_name,
      email: values.email,
      phone: values.phone,
      gender: values.gender,
      tshirt_size: values.tshirt_size,
      blood_type: values.blood_type,
      medical_condition: values.medical_condition || null,
    })
    .eq('id', participantId)
    .eq('community_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

// Delete a pending participant
export async function deleteParticipant(participantId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Sesi habis. Silakan login kembali.' }
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('payment_status')
    .eq('id', participantId)
    .eq('community_id', user.id)
    .single()

  if (!participant) return { error: 'Peserta tidak ditemukan.' }
  if (participant.payment_status === 'paid') {
    return { error: 'Peserta yang sudah lunas tidak dapat dihapus.' }
  }

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participantId)
    .eq('community_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}
