'use server'

import { z } from 'zod'
import { getFamilySession } from '@/lib/auth/family'
import { getCommunitySession } from '@/lib/auth/community'
import { 
  insertFamilyParticipants, 
  insertParticipants, 
  findDuplicateParticipants,
  findDuplicateFamilyParticipants,
  findActiveParticipants,
  findActiveFamilyParticipants,
  findActiveCrossParticipant,
  findActiveCrossFamilyParticipant,
  findParticipantsByCommunityId,
  findFamilyParticipantsByFamilyId,
} from '@/lib/db'
import { ingestAdminLog } from '@/lib/axiom/ingest'

const participantInput = z.object({
  full_name: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  bib_name: z.string().min(2, 'Nama BIB minimal 2 karakter').max(20, 'Nama BIB maksimal 20 karakter'),
  email: z.string().email('Email tidak valid'),
  phone: z.string().min(9, 'Nomor HP tidak valid'),
  date_of_birth: z.string().min(1, 'Tanggal lahir wajib diisi'),
  gender: z.enum(['male', 'female']),
  tshirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  blood_type: z.enum(['A', 'B', 'AB', 'O']),
  medical_condition: z.string().optional(),
  emergency_contact_name: z.string().min(2, 'Nama kontak darurat wajib diisi'),
  emergency_contact_phone: z.string().min(9, 'Nomor kontak darurat tidak valid'),
})

const addParticipantsSchema = z.object({
  participants: z.array(participantInput).min(1, 'Minimal 1 peserta'),
})
.refine((data) => {
  // Check for duplicate participants within the same submission (same email OR same phone)
  const emailPhonePairs = new Set<string>()
  for (const participant of data.participants) {
    const pair = `${participant.email.toLowerCase()}|${participant.phone}`
    if (emailPhonePairs.has(pair)) {
      return false
    }
    emailPhonePairs.add(pair)
  }
  return true
}, {
  message: 'Ada peserta dengan email atau nomor HP yang sama dalam form. Setiap peserta harus memiliki email dan nomor HP yang unik.',
  path: ['participants'],
})

export type AddParticipantsValues = z.infer<typeof addParticipantsSchema>

/**
 * Add new participants to a logged-in family account.
 */
export async function addFamilyParticipantsAction(values: AddParticipantsValues) {
  const validated = addParticipantsSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getFamilySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  // BUSINESS LOGIC: Check for ACTIVE participants only (pending/paid status)
  // Allow duplicates if existing participant has failed/expired payment status
  // CRITICAL FIX: Check ACROSS BOTH community and family participants
  for (const participant of validated.data.participants) {
    const crossParticipant = await findActiveCrossFamilyParticipant(participant.email, participant.phone)
    if (crossParticipant && crossParticipant.participant) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} dan nomor HP ${participant.phone} sudah terdaftar aktif di sistem (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}). Peserta dengan status pembayaran pending/paid tidak dapat didaftarkan ulang.`
      }
    }
  }

  // Check for duplicates within existing family participants (same family)
  const existingParticipants = await findFamilyParticipantsByFamilyId(session.id)
  for (const participant of validated.data.participants) {
    // Only check against active participants in same family
    const existingDuplicate = existingParticipants.find(existing => 
      (existing.email.toLowerCase() === participant.email.toLowerCase() || 
       existing.phone === participant.phone) &&
      (existing.payment_status === 'pending' || existing.payment_status === 'paid')
    )
    if (existingDuplicate) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} atau nomor HP ${participant.phone} sudah ada aktif di grup Anda (status: ${existingDuplicate.payment_status}). Silakan gunakan email atau nomor HP yang berbeda.`
      }
    }
  }

  try {
    await insertFamilyParticipants(
      validated.data.participants.map((p) => ({
        family_id: session.id,
        registration_id: null,
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
        provinsi: null,
        kota: null,
        kecamatan: null,
        participant_code: null,
        qr_code_data: null,
        payment_status: 'pending',
        checked_in: false,
        checked_in_at: null,
        racepack_email_sent_at: null,
        racepack_email_error: null,
        racepack_whatsapp_sent_at: null,
        racepack_whatsapp_error: null,
      }))
    )
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data anggota.' }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'family',
      event: 'family_participants_added',
      message: `${validated.data.participants.length} anggota baru ditambahkan ke Brother & Sister Package: ${session.name}.`,
      data: { familyId: session.id, name: session.name, count: validated.data.participants.length },
    })
  } catch {
    // Non-critical
  }

  return { success: true, count: validated.data.participants.length }
}

/**
 * Add new participants to a logged-in community account.
 */
export async function addCommunityParticipantsAction(values: AddParticipantsValues) {
  const validated = addParticipantsSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data tidak valid' }
  }

  const session = await getCommunitySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  // BUSINESS LOGIC: Check for ACTIVE participants only (pending/paid status)
  // Allow duplicates if existing participant has failed/expired payment status
  // CRITICAL FIX: Check ACROSS BOTH community and family participants
  for (const participant of validated.data.participants) {
    const crossParticipant = await findActiveCrossParticipant(participant.email, participant.phone)
    if (crossParticipant && crossParticipant.participant) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} dan nomor HP ${participant.phone} sudah terdaftar aktif di sistem (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}). Peserta dengan status pembayaran pending/paid tidak dapat didaftarkan ulang.`
      }
    }
  }

  // Check for duplicates within existing community participants (same community)
  const existingParticipants = await findParticipantsByCommunityId(session.id)
  for (const participant of validated.data.participants) {
    // Only check against active participants in same community
    const existingDuplicate = existingParticipants.find(existing => 
      (existing.email.toLowerCase() === participant.email.toLowerCase() || 
       existing.phone === participant.phone) &&
      (existing.payment_status === 'pending' || existing.payment_status === 'paid')
    )
    if (existingDuplicate) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} atau nomor HP ${participant.phone} sudah ada aktif di komunitas Anda (status: ${existingDuplicate.payment_status}). Silakan gunakan email atau nomor HP yang berbeda.`
      }
    }
  }

  try {
    await insertParticipants(
      validated.data.participants.map((p) => ({
        community_id: session.id,
        registration_id: null,
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
        provinsi: null,
        kota: null,
        kecamatan: null,
        participant_code: null,
        qr_code_data: null,
        payment_status: 'pending',
        checked_in: false,
        checked_in_at: null,
        racepack_email_sent_at: null,
        racepack_email_error: null,
        racepack_whatsapp_sent_at: null,
        racepack_whatsapp_error: null,
      }))
    )
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data peserta.' }
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'community',
      event: 'community_participants_added',
      message: `${validated.data.participants.length} peserta baru ditambahkan ke komunitas: ${session.name}.`,
      data: { communityId: session.id, name: session.name, count: validated.data.participants.length },
    })
  } catch {
    // Non-critical
  }

  return { success: true, count: validated.data.participants.length }
}
