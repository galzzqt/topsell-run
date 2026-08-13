'use server'

import { z } from 'zod'
import { getIndividualSession } from '@/lib/auth/individual'
import { getFamilySession } from '@/lib/auth/family'
import { getCommunitySession } from '@/lib/auth/community'
import {
  findIndividualById,
  findFamilyById,
  findCommunityById,
  findIndividualParticipantsByIndividualId,
  findFamilyParticipantsByFamilyId,
  findParticipantsByCommunityId,
  insertIndividualParticipants,
  insertFamilyParticipants,
  insertParticipants,
  createIndividualRegistration,
  createFamilyRegistration,
  createRegistration,
  createIndividualPayment as dbCreateIndividualPayment,
  createFamilyPayment as dbCreateFamilyPayment,
  createPayment as dbCreatePayment,
  linkIndividualParticipantsToRegistration,
  linkFamilyParticipantsToRegistration,
  linkParticipantsToRegistration,
  incrementVoucherUsage,
  findVoucherByCode,
  findBestAutoVoucher,
} from '@/lib/db'
import {
  checkPackageQuota,
  resolvePackagePrice,
  resolvePeriodForCategory,
} from '@/lib/admin/settings'
import { generateRandomReference, getWibNowString } from '@/lib/utils/format'

function toXenditReference(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64) || 'customer'
}

function calcDiscount(
  discountType: 'percent' | 'flat',
  discountValue: number,
  basePrice: number,
): number {
  if (discountType === 'percent') {
    return Math.round((basePrice * discountValue) / 100)
  }
  return Math.min(discountValue, basePrice)
}

const participantInputSchema = z.object({
  full_name: z.string().min(2, 'Nama lengkap minimal 2 karakter'),
  bib_name: z.string().min(2, 'Nama BIB minimal 2 karakter').max(20, 'Nama BIB maksimal 20 karakter'),
  ktp_number: z.string().regex(/^\d{16}$/, 'Nomor KTP harus 16 digit angka'),
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

// ── RE-REGISTER INDIVIDUAL ──
export async function reRegisterIndividualAction(input: {
  category: string
  participant: z.infer<typeof participantInputSchema>
  voucherCode?: string
}) {
  const session = await getIndividualSession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const individual = await findIndividualById(session.id)
  if (!individual) return { error: 'Data akun individu tidak ditemukan.' }

  const pVal = participantInputSchema.safeParse(input.participant)
  if (!pVal.success) {
    return { error: pVal.error.issues[0]?.message || 'Data peserta tidak valid.' }
  }

  const category = input.category.trim()
  if (!category) return { error: 'Pilih kategori terlebih dahulu.' }

  const quota = await checkPackageQuota('individual', 1, category)
  if (!quota.ok) return { error: quota.reason || 'Kuota peserta untuk kategori ini sudah penuh.' }

  const period = await resolvePeriodForCategory('individual', category)

  // Block re-registration if user ALREADY has a PAID participant for this period
  const existingParticipants = await findIndividualParticipantsByIndividualId(session.id)
  const hasPaidInPeriod = existingParticipants.some(
    (p) => p.payment_status === 'paid' && (!period?.key || p.period_key === period.key)
  )
  if (hasPaidInPeriod) {
    return {
      error: 'Anda sudah memiliki pendaftaran LUNAS untuk periode ini. Pendaftaran ulang hanya dapat dilakukan jika status sebelumnya kadaluarsa/gagal atau untuk periode baru.',
    }
  }

  const unitPrice = await resolvePackagePrice('individual', category)
  const basePrice = unitPrice
  const now = getWibNowString()

  // Voucher calculation
  let voucherDiscount = 0
  let voucherCodeUsed: string | null = null
  let voucherId: string | null = null

  if (input.voucherCode && input.voucherCode.trim()) {
    const code = input.voucherCode.trim().toUpperCase()
    const v = await findVoucherByCode(code, 'individual', category, now)
    if (!v) {
      return { error: 'Kode voucher tidak valid, sudah kadaluarsa, atau tidak berlaku untuk kategori ini.' }
    }
    voucherDiscount = calcDiscount(v.discountType, v.discountValue, basePrice)
    voucherCodeUsed = v.code
    voucherId = v.id
  } else {
    const autoV = await findBestAutoVoucher('individual', category, now)
    if (autoV) {
      voucherDiscount = calcDiscount(autoV.discountType, autoV.discountValue, basePrice)
      voucherCodeUsed = 'AUTO'
      voucherId = autoV.id
    }
  }

  const finalAmount = Math.max(0, basePrice - voucherDiscount)
  const pData = pVal.data

  let inserted
  try {
    inserted = await insertIndividualParticipants([
      {
        individual_id: session.id,
        registration_id: null,
        period_key: period?.key ?? null,
        full_name: pData.full_name,
        bib_name: pData.bib_name,
        ktp_number: pData.ktp_number,
        email: pData.email,
        phone: pData.phone,
        date_of_birth: pData.date_of_birth,
        gender: pData.gender,
        tshirt_size: pData.tshirt_size,
        blood_type: pData.blood_type,
        medical_condition: pData.medical_condition || null,
        emergency_contact_name: pData.emergency_contact_name,
        emergency_contact_phone: pData.emergency_contact_phone,
        provinsi: individual.provinsi || '-',
        kota: individual.kota || '-',
        kecamatan: individual.kecamatan || '-',
        participant_code: null,
        qr_code_data: null,
        payment_status: 'pending',
        checked_in: false,
        checked_in_at: null,
        racepack_email_sent_at: null,
        racepack_email_error: null,
        racepack_whatsapp_sent_at: null,
        racepack_whatsapp_error: null,
      },
    ])
  } catch (err) {
    return { error: 'Gagal menyimpan peserta: ' + (err instanceof Error ? err.message : 'Error') }
  }

  const participantIds = inserted.map((p) => p.id)
  const paymentRef = toXenditReference(generateRandomReference('IND'))

  let registration
  try {
    registration = await createIndividualRegistration({
      individual_id: session.id,
      total_participants: 1,
      total_amount: finalAmount,
      voucher_code: voucherCodeUsed,
      voucher_discount: voucherDiscount,
      status: 'pending',
    })
    await linkIndividualParticipantsToRegistration(participantIds, registration.id)
  } catch (err) {
    return { error: 'Gagal membuat registrasi: ' + (err instanceof Error ? err.message : 'Error') }
  }

  try {
    await dbCreateIndividualPayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })
    if (voucherId) await incrementVoucherUsage(voucherId)
  } catch (err) {
    return { error: 'Gagal membuat invoice: ' + (err instanceof Error ? err.message : 'Error') }
  }

  return { success: true, registrationId: registration.id }
}

// ── RE-REGISTER FAMILY (BRO & SIST) ──
export async function reRegisterFamilyAction(input: {
  category: string
  participants: Array<z.infer<typeof participantInputSchema>>
  voucherCode?: string
}) {
  const session = await getFamilySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const family = await findFamilyById(session.id)
  if (!family) return { error: 'Data akun keluarga tidak ditemukan.' }

  if (!input.participants || input.participants.length < 3) {
    return { error: 'Minimal 3 peserta untuk paket Bro & Sist.' }
  }

  for (const p of input.participants) {
    const val = participantInputSchema.safeParse(p)
    if (!val.success) {
      return { error: `Peserta ${p.full_name}: ${val.error.issues[0]?.message}` }
    }
  }

  const category = input.category.trim()
  if (!category) return { error: 'Pilih kategori terlebih dahulu.' }

  const quota = await checkPackageQuota('family', input.participants.length, category)
  if (!quota.ok) return { error: quota.reason || 'Kuota peserta sudah penuh.' }

  const period = await resolvePeriodForCategory('family', category)

  // Block re-registration if family ALREADY has a PAID participant for this period
  const existingParticipants = await findFamilyParticipantsByFamilyId(session.id)
  const hasPaidInPeriod = existingParticipants.some(
    (p) => p.payment_status === 'paid' && (!period?.key || p.period_key === period.key)
  )
  if (hasPaidInPeriod) {
    return {
      error: 'Akun Anda sudah memiliki pendaftaran LUNAS untuk periode ini. Pendaftaran ulang hanya dapat dilakukan jika status sebelumnya kadaluarsa/gagal atau untuk periode baru.',
    }
  }

  const unitPrice = await resolvePackagePrice('family', category)
  const basePrice = input.participants.length * unitPrice
  const now = getWibNowString()

  let voucherDiscount = 0
  let voucherCodeUsed: string | null = null
  let voucherId: string | null = null

  if (input.voucherCode && input.voucherCode.trim()) {
    const code = input.voucherCode.trim().toUpperCase()
    const v = await findVoucherByCode(code, 'family', category, now)
    if (!v) {
      return { error: 'Kode voucher tidak valid atau tidak berlaku.' }
    }
    voucherDiscount = calcDiscount(v.discountType, v.discountValue, basePrice)
    voucherCodeUsed = v.code
    voucherId = v.id
  } else {
    const autoV = await findBestAutoVoucher('family', category, now)
    if (autoV) {
      voucherDiscount = calcDiscount(autoV.discountType, autoV.discountValue, basePrice)
      voucherCodeUsed = 'AUTO'
      voucherId = autoV.id
    }
  }

  const finalAmount = Math.max(0, basePrice - voucherDiscount)

  let inserted
  try {
    inserted = await insertFamilyParticipants(
      input.participants.map((pData) => ({
        family_id: session.id,
        registration_id: null,
        period_key: period?.key ?? null,
        full_name: pData.full_name,
        bib_name: pData.bib_name,
        ktp_number: pData.ktp_number,
        email: pData.email,
        phone: pData.phone,
        date_of_birth: pData.date_of_birth,
        gender: pData.gender,
        tshirt_size: pData.tshirt_size,
        blood_type: pData.blood_type,
        medical_condition: pData.medical_condition || null,
        emergency_contact_name: pData.emergency_contact_name,
        emergency_contact_phone: pData.emergency_contact_phone,
        provinsi: family.provinsi || '-',
        kota: family.kota || '-',
        kecamatan: family.kecamatan || '-',
        participant_code: null,
        qr_code_data: null,
        payment_status: 'pending',
        checked_in: false,
        checked_in_at: null,
        racepack_email_sent_at: null,
        racepack_email_error: null,
        racepack_whatsapp_sent_at: null,
        racepack_whatsapp_error: null,
      })),
    )
  } catch (err) {
    return { error: 'Gagal menyimpan peserta: ' + (err instanceof Error ? err.message : 'Error') }
  }

  const participantIds = inserted.map((p) => p.id)
  const paymentRef = toXenditReference(generateRandomReference('FAM'))

  let registration
  try {
    registration = await createFamilyRegistration({
      family_id: session.id,
      total_participants: input.participants.length,
      total_amount: finalAmount,
      voucher_code: voucherCodeUsed,
      voucher_discount: voucherDiscount,
      status: 'pending',
    })
    await linkFamilyParticipantsToRegistration(participantIds, registration.id)
  } catch (err) {
    return { error: 'Gagal membuat registrasi: ' + (err instanceof Error ? err.message : 'Error') }
  }

  try {
    await dbCreateFamilyPayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })
    if (voucherId) await incrementVoucherUsage(voucherId)
  } catch (err) {
    return { error: 'Gagal membuat invoice: ' + (err instanceof Error ? err.message : 'Error') }
  }

  return { success: true, registrationId: registration.id }
}

// ── RE-REGISTER COMMUNITY ──
export async function reRegisterCommunityAction(input: {
  category: string
  participants: Array<z.infer<typeof participantInputSchema>>
  voucherCode?: string
}) {
  const session = await getCommunitySession()
  if (!session) return { error: 'Sesi habis. Silakan login kembali.' }

  const community = await findCommunityById(session.id)
  if (!community) return { error: 'Data akun komunitas tidak ditemukan.' }

  if (!input.participants || input.participants.length < 3) {
    return { error: 'Minimal 3 peserta untuk paket Komunitas.' }
  }

  for (const p of input.participants) {
    const val = participantInputSchema.safeParse(p)
    if (!val.success) {
      return { error: `Peserta ${p.full_name}: ${val.error.issues[0]?.message}` }
    }
  }

  const category = input.category.trim()
  if (!category) return { error: 'Pilih kategori terlebih dahulu.' }

  const quota = await checkPackageQuota('community', input.participants.length, category)
  if (!quota.ok) return { error: quota.reason || 'Kuota peserta sudah penuh.' }

  const period = await resolvePeriodForCategory('community', category)

  // Block re-registration if community ALREADY has a PAID participant for this period
  const existingParticipants = await findParticipantsByCommunityId(session.id)
  const hasPaidInPeriod = existingParticipants.some(
    (p) => p.payment_status === 'paid' && (!period?.key || p.period_key === period.key)
  )
  if (hasPaidInPeriod) {
    return {
      error: 'Komunitas Anda sudah memiliki pendaftaran LUNAS untuk periode ini. Pendaftaran ulang hanya dapat dilakukan jika status sebelumnya kadaluarsa/gagal atau untuk periode baru.',
    }
  }

  const unitPrice = await resolvePackagePrice('community', category)
  const basePrice = input.participants.length * unitPrice
  const now = getWibNowString()

  let voucherDiscount = 0
  let voucherCodeUsed: string | null = null
  let voucherId: string | null = null

  if (input.voucherCode && input.voucherCode.trim()) {
    const code = input.voucherCode.trim().toUpperCase()
    const v = await findVoucherByCode(code, 'community', category, now)
    if (!v) {
      return { error: 'Kode voucher tidak valid atau tidak berlaku.' }
    }
    voucherDiscount = calcDiscount(v.discountType, v.discountValue, basePrice)
    voucherCodeUsed = v.code
    voucherId = v.id
  } else {
    const autoV = await findBestAutoVoucher('community', category, now)
    if (autoV) {
      voucherDiscount = calcDiscount(autoV.discountType, autoV.discountValue, basePrice)
      voucherCodeUsed = 'AUTO'
      voucherId = autoV.id
    }
  }

  const finalAmount = Math.max(0, basePrice - voucherDiscount)

  let inserted
  try {
    inserted = await insertParticipants(
      input.participants.map((pData) => ({
        community_id: session.id,
        registration_id: null,
        period_key: period?.key ?? null,
        full_name: pData.full_name,
        bib_name: pData.bib_name,
        ktp_number: pData.ktp_number,
        email: pData.email,
        phone: pData.phone,
        date_of_birth: pData.date_of_birth,
        gender: pData.gender,
        tshirt_size: pData.tshirt_size,
        blood_type: pData.blood_type,
        medical_condition: pData.medical_condition || null,
        emergency_contact_name: pData.emergency_contact_name,
        emergency_contact_phone: pData.emergency_contact_phone,
        provinsi: community.provinsi || '-',
        kota: community.kota || '-',
        kecamatan: community.kecamatan || '-',
        participant_code: null,
        qr_code_data: null,
        payment_status: 'pending',
        checked_in: false,
        checked_in_at: null,
        racepack_email_sent_at: null,
        racepack_email_error: null,
        racepack_whatsapp_sent_at: null,
        racepack_whatsapp_error: null,
      })),
    )
  } catch (err) {
    return { error: 'Gagal menyimpan peserta: ' + (err instanceof Error ? err.message : 'Error') }
  }

  const participantIds = inserted.map((p) => p.id)
  const paymentRef = toXenditReference(generateRandomReference('COM'))

  let registration
  try {
    registration = await createRegistration({
      community_id: session.id,
      total_participants: input.participants.length,
      total_amount: finalAmount,
      voucher_code: voucherCodeUsed,
      voucher_discount: voucherDiscount,
      status: 'pending',
    })
    await linkParticipantsToRegistration(participantIds, registration.id)
  } catch (err) {
    return { error: 'Gagal membuat registrasi: ' + (err instanceof Error ? err.message : 'Error') }
  }

  try {
    await dbCreatePayment({
      registration_id: registration.id,
      amount: finalAmount,
      payment_reference: paymentRef,
      status: 'pending',
      period_key: period?.key ?? null,
    })
    if (voucherId) await incrementVoucherUsage(voucherId)
  } catch (err) {
    return { error: 'Gagal membuat invoice: ' + (err instanceof Error ? err.message : 'Error') }
  }

  return { success: true, registrationId: registration.id }
}
