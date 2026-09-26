'use server'

import {
  createInvitation,
  deleteInvitation,
  findInvitationByPhone,
  findInvitationByEmail,
  insertInvitationParticipants,
  findActiveCrossInvitationParticipant,
  createInvitationRegistration,
  createInvitationPayment,
  linkInvitationParticipantsToRegistration,
  markInvitationPaymentPaid,
  verifyInvitationEmail,
  isDuplicateKeyError,
} from '@/lib/db'
import { after } from 'next/server'
import { buildInvitationSchema, hiddenInvitationFields, RegisterInvitationFormValues } from '@/lib/validations/auth'
import { sendInvitationRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { sendInvitationRegistrationEmail } from '@/lib/email/invitation'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { isPackageOpen, checkPackageQuota, resolvePeriodForCategory, readAdminSettings } from '@/lib/admin/settings'
import { rateLimitByIp } from '@/lib/security/rate-limit'

const ALREADY_REGISTERED = 'Email atau nomor WhatsApp ini sudah terdaftar di invitation. Hubungi admin jika ada kendala.'

// Invitation: tanpa akun/login, tanpa pembayaran. Data masuk admin + webhook GHL,
// konfirmasi "pendaftaran diterima" via email & WhatsApp. QR racepack dari EO.
export async function registerInvitation(values: RegisterInvitationFormValues) {
  // Longgar: peserta invitation (instansi/brand) sering daftar massal dari satu jaringan kantor (IP sama).
  const limit = await rateLimitByIp('invitation-signup', 60, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  const gate = await isPackageOpen('invitation')
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran invitation sedang ditutup.' }
  }

  // Validasi mengikuti pengaturan form admin. Field yang disembunyikan dikosongkan di sini
  // (jangan percaya nilai dari client); kategori tersembunyi/kosong → kategori pertama periode aktif.
  const formSettings = (await readAdminSettings()).registrationForm.invitation
  const input: Record<string, unknown> = { ...values }
  for (const key of hiddenInvitationFields(formSettings)) input[key] = ''
  if (formSettings.registrant.category?.visible === false || !input.category) {
    input.category = gate.period?.categories[0]?.value || ''
  }
  if (!input.category) return { error: 'Kategori wajib dipilih.' }

  const validated = buildInvitationSchema(formSettings).safeParse(input)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data registrasi tidak valid' }
  }
  const {
    category, provinsi: rawProvinsi, kota: rawKota, kecamatan: rawKecamatan,
    agreement_safety: _s, agreement_data: _d, agreement_refund: _r,
    ...rest
  } = validated.data
  void _s; void _d; void _r
  // Field kosong ('' dari form) disimpan sebagai null.
  const blank = <T,>(value: T | '' | undefined) => (value === '' || value === undefined ? null : value)
  const provinsi = blank(rawProvinsi)
  const kota = blank(rawKota)
  const kecamatan = blank(rawKecamatan)
  const participant = {
    ...rest,
    full_name: rest.full_name || '',
    bib_name: rest.bib_name || '',
    ktp_number: rest.ktp_number || '',
    date_of_birth: blank(rest.date_of_birth),
    gender: blank(rest.gender),
    tshirt_size: blank(rest.tshirt_size),
    blood_type: rest.blood_type === 'none' ? null : blank(rest.blood_type),
    medical_condition: blank(rest.medical_condition),
    emergency_contact_name: blank(rest.emergency_contact_name),
    emergency_contact_phone: blank(rest.emergency_contact_phone),
  }
  const sizes = participant.tshirt_size ? [participant.tshirt_size] : []

  const quota = await checkPackageQuota('invitation', 1, category, sizes)
  if (!quota.ok) {
    return { error: quota.reason || 'Kuota peserta invitation sudah penuh.' }
  }

  // Satu email / nomor WA hanya bisa daftar invitation sekali.
  if ((await findInvitationByPhone(participant.phone)) || (await findInvitationByEmail(participant.email))) {
    return { error: ALREADY_REGISTERED }
  }

  const crossParticipant = await findActiveCrossInvitationParticipant(participant.email, participant.phone)
  if (crossParticipant?.participant) {
    return {
      error: crossParticipant.type === 'invitation'
        ? ALREADY_REGISTERED
        : `Email atau nomor WhatsApp ini sudah terdaftar aktif di paket ${crossParticipant.type}. Hubungi admin jika ada kendala.`,
    }
  }

  const communityName = participant.community_name ? participant.community_name.trim() : null

  let invitation
  try {
    invitation = await createInvitation({
      // Invitation = 1 peserta, record dinamai sesuai peserta itu sendiri.
      name: participant.full_name,
      leader_name: participant.full_name,
      email: participant.email,
      phone: participant.phone,
      category,
      provinsi,
      kota,
      kecamatan,
      community_name: communityName,
      voucher_code: null,
      voucher_discount: 0,
    })
  } catch (error) {
    // Index unik phone/email: submit bersamaan dengan data sama lolos cek di atas, ditolak di sini.
    if (isDuplicateKeyError(error)) return { error: ALREADY_REGISTERED }
    return { error: 'Gagal menyimpan pendaftaran invitation. Silakan coba lagi.' }
  }

  // Tidak ada aktivasi email untuk invitation.
  await verifyInvitationEmail(invitation.id)

  const period = await resolvePeriodForCategory('invitation', category)

  let participantIds: string[] = []
  try {
    const inserted = await insertInvitationParticipants([{
      invitation_id: invitation.id,
      registration_id: null,
      period_key: period?.key ?? null,
      full_name: participant.full_name,
      bib_name: participant.bib_name,
      ktp_number: participant.ktp_number,
      email: participant.email,
      phone: participant.phone,
      date_of_birth: participant.date_of_birth,
      gender: participant.gender,
      tshirt_size: participant.tshirt_size,
      blood_type: participant.blood_type,
      medical_condition: participant.medical_condition,
      emergency_contact_name: participant.emergency_contact_name,
      emergency_contact_phone: participant.emergency_contact_phone,
      community_name: communityName,
      participant_type: participant.participant_type || null,
      provinsi,
      kota,
      kecamatan,
      participant_code: null,
      qr_code_data: null,
      payment_status: 'pending',
      checked_in: false,
      checked_in_at: null,
      racepack_email_sent_at: null,
      racepack_email_error: null,
      racepack_whatsapp_sent_at: null,
      racepack_whatsapp_error: null,
    }])
    participantIds = inserted.map((p) => p.id)
  } catch {
    await deleteInvitation(invitation.id)
    return { error: 'Gagal menyimpan data peserta. Silakan coba lagi.' }
  }

  // Cek ulang kuota setelah insert: dua pendaftar bersamaan bisa sama-sama lolos cek awal
  // untuk sisa kuota terakhir (mis. jersey 4XL tinggal 1). Yang kelebihan di-rollback.
  const recheck = await checkPackageQuota('invitation', 1, category, sizes, true)
  if (!recheck.ok) {
    await deleteInvitation(invitation.id)
    return { error: recheck.reason || 'Kuota peserta invitation sudah penuh.' }
  }

  // Record Rp0 langsung paid supaya peserta tampil aktif di admin (tidak ada pembayaran).
  // Racepack/QR TIDAK dikirim dari sistem — QR dari EO.
  try {
    const registration = await createInvitationRegistration({
      invitation_id: invitation.id,
      total_participants: 1,
      total_amount: 0,
      voucher_code: null,
      voucher_discount: 0,
      status: 'pending',
    })
    await linkInvitationParticipantsToRegistration(participantIds, registration.id)
    const payment = await createInvitationPayment({
      registration_id: registration.id,
      amount: 0,
      payment_reference: `FREE-INV-${invitation.invitation_code}`,
      status: 'pending',
      period_key: period?.key ?? null,
    })
    await markInvitationPaymentPaid(payment.id, {
      payment_method: 'invitation_free',
      paid_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to create invitation registration record:', error)
  }

  // Webhook (WA), email konfirmasi & log dijalankan SETELAH respons terkirim: SMTP/GHL yang
  // lambat tidak membuat pendaftar menunggu lama lalu submit ulang.
  const invitationCode = invitation.invitation_code
  const invitationId = invitation.id
  after(async () => {
    const results = await Promise.allSettled([
      // Webhook GHL (konfirmasi WhatsApp): semua isi form kecuali persetujuan S&K.
      sendInvitationRegistrationConfirmationWebhook({
        formFields: { category, provinsi, kota, kecamatan, ...participant },
        phone: participant.phone,
        participantName: participant.full_name,
        participantCount: 1,
        participantType: participant.participant_type || null,
        participantTypeName: communityName,
        email: participant.email,
        category,
        registrationCode: invitationCode,
        amount: 0,
      }),
      sendInvitationRegistrationEmail({
        email: participant.email,
        name: participant.full_name,
        code: invitationCode,
        category,
      }).then((result) => {
        if ('error' in result) throw new Error(result.error)
      }),
      ingestAdminLog({
        level: 'info',
        source: 'auth',
        event: 'invitation_signup',
        message: `Pendaftaran invitation baru: ${participant.full_name} (HP: ${participant.phone}, Kategori: ${category}).`,
        data: { invitationId, name: participant.full_name, phone: participant.phone },
      }),
    ])
    const labels = ['webhook', 'email', 'log']
    results.forEach((result, index) => {
      if (result.status === 'rejected') console.error(`Invitation ${labels[index]} failed for ${invitationCode}:`, result.reason)
    })
  })

  return { success: true }
}
