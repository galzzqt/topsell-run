'use server'

import { clearInvitationSession, createInvitationSession } from '@/lib/auth/invitation'
import { createPasswordRecord, verifyPassword } from '@/lib/auth/password'
import {
  createInvitation,
  deleteInvitation,
  findInvitationByPhone,
  findInvitationByEmail,
  findInvitationAuthByPhone,
  findInvitationAuthById,
  findAuthEmailOwner,
  insertInvitationParticipants,
  saveInvitationAuth,
  updateInvitation,
  findActiveCrossInvitationParticipant,
  createInvitationRegistration,
  createInvitationPayment,
  linkInvitationParticipantsToRegistration,
  markInvitationPaymentPaid,
  verifyInvitationEmail,
} from '@/lib/db'
import { registerSoloSchema, loginSchema, RegisterSoloFormValues, LoginFormValues } from '@/lib/validations/auth'
import { sendInvitationRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { isPackageOpen, checkPackageQuota, resolvePeriodForCategory } from '@/lib/admin/settings'
import { rateLimitByIp, clearRateLimit } from '@/lib/security/rate-limit'

export async function signUpInvitation(values: RegisterSoloFormValues) {
  const limit = await rateLimitByIp('invitation-signup', 20, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  const validated = registerSoloSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data registrasi tidak valid' }
  }

  const gate = await isPackageOpen('invitation')
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran invitation sedang ditutup.' }
  }

  const quota = await checkPackageQuota('invitation', values.participants.length, values.category, values.participants.map((p) => p.tshirt_size))
  if (!quota.ok) {
    return { error: quota.reason || 'Kuota peserta invitation sudah penuh.' }
  }

  const existingInvitation = await findInvitationByPhone(values.phone)
  if (existingInvitation) {
    return { error: 'Nomor WhatsApp ini sudah terdaftar. Silakan login.' }
  }

  const existingEmailOwner = (await findAuthEmailOwner(values.email)) || (await findInvitationByEmail(values.email))
  if (existingEmailOwner) {
    return { error: 'Email ini sudah terdaftar sebagai email login. Silakan login atau gunakan email lain.' }
  }

  for (const participant of values.participants) {
    const crossParticipant = await findActiveCrossInvitationParticipant(participant.email, participant.phone)
    if (crossParticipant && crossParticipant.participant) {
      return {
        error: `Peserta "${participant.full_name}" dengan email ${participant.email} dan nomor HP ${participant.phone} sudah terdaftar aktif di sistem (${crossParticipant.type} - status: ${crossParticipant.participant.payment_status}).`
      }
    }
  }

  let invitation
  try {
    invitation = await createInvitation({
      name: values.name,
      leader_name: values.leader_name,
      email: values.email,
      phone: values.phone,
      category: values.category,
      provinsi: values.provinsi,
      kota: values.kota,
      kecamatan: values.kecamatan,
      community_name: values.participants[0]?.community_name ? values.participants[0].community_name.trim() : null,
      voucher_code: null,
      voucher_discount: 0,
    })
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Gagal membuat profil peserta invitation.' }
  }

  // Invitation tanpa aktivasi email — akun langsung aktif.
  await verifyInvitationEmail(invitation.id)

  try {
    await saveInvitationAuth(invitation.id, values.phone, createPasswordRecord(values.password))
  } catch (error) {
    await deleteInvitation(invitation.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan akun peserta.' }
  }

  try {
    await updateInvitation(invitation.id, { email: values.email, category: values.category })
  } catch (error) {
    await deleteInvitation(invitation.id)
    return { error: error instanceof Error ? error.message : 'Gagal memperbarui profil peserta.' }
  }

  const period = await resolvePeriodForCategory('invitation', values.category)

  let participantIds: string[] = []
  try {
    const inserted = await insertInvitationParticipants(
      values.participants.map((p) => ({
        invitation_id: invitation.id,
        registration_id: null,
        period_key: period?.key ?? null,
        full_name: p.full_name,
        bib_name: p.bib_name,
        ktp_number: p.ktp_number,
        email: p.email,
        phone: p.phone,
        date_of_birth: p.date_of_birth,
        gender: p.gender,
        tshirt_size: p.tshirt_size,
        blood_type: p.blood_type,
        medical_condition: p.medical_condition || null,
        emergency_contact_name: p.emergency_contact_name,
        emergency_contact_phone: p.emergency_contact_phone,
        community_name: p.community_name ? p.community_name.trim() : null,
        participant_type: p.participant_type || null,
        provinsi: values.provinsi,
        kota: values.kota,
        kecamatan: values.kecamatan,
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
    participantIds = inserted.map((p) => p.id)
  } catch (error) {
    await deleteInvitation(invitation.id)
    return { error: error instanceof Error ? error.message : 'Gagal menyimpan data peserta.' }
  }

  // Invitation tidak berbayar: buat record Rp0 lalu langsung paid supaya
  // activatePaidInvitationParticipants generate kode & QR peserta.
  try {
    const registration = await createInvitationRegistration({
      invitation_id: invitation.id,
      total_participants: values.participants.length,
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

    // Racepack email + WhatsApp tetap dikirim (tanpa receipt — tidak ada pembayaran).
    try {
      const [{ sendInvitationRacepackEmailsForRegistration }, { sendInvitationRacepackWhatsappsForRegistration }] = await Promise.all([
        import('@/lib/email/invitation'),
        import('@/lib/whatsapp/invitation'),
      ])
      await Promise.all([
        sendInvitationRacepackEmailsForRegistration(registration.id),
        sendInvitationRacepackWhatsappsForRegistration(registration.id),
      ])
    } catch (notifyError) {
      console.error('Failed to send invitation racepack:', notifyError)
    }
  } catch (error) {
    console.error('Failed to create invitation registration record:', error)
  }

  // Semua isi form dikirim ke GHL kecuali password. `name`/`leader_name` dibuang:
  // invitation cuma 1 peserta, keduanya duplikat dari full_name.
  const { password: _pw, confirmPassword: _cpw, name: _name, leader_name: _leader, participants: _participants, ...groupFields } = values
  void _pw; void _cpw; void _name; void _leader; void _participants
  const formFields = { ...groupFields, ...values.participants[0] }

  try {
    await sendInvitationRegistrationConfirmationWebhook({
      formFields,
      phone: values.phone,
      participantName: values.participants[0]?.full_name || values.name,
      participantCount: values.participants.length,
      participantType: values.participants[0]?.participant_type || null,
      participantTypeName: values.participants[0]?.community_name || null,
      email: values.email,
      category: values.category,
      registrationCode: invitation.invitation_code,
      amount: 0,
    })
  } catch (sendError) {
    console.error('Failed to send invitation registration confirmation WhatsApp:', sendError)
  }

  try {
    await ingestAdminLog({
      level: 'info',
      source: 'auth',
      event: 'invitation_signup',
      message: `Pendaftaran invitation baru: ${values.name} (HP: ${values.phone}, Kategori: ${values.category}).`,
      data: { invitationId: invitation.id, name: values.name, phone: values.phone },
    })
  } catch (logError) {
    console.error('Failed to log invitation signup:', logError)
  }

  // Tanpa aktivasi email: langsung login supaya bisa diarahkan ke dashboard.
  await createInvitationSession({ id: invitation.id, phone: invitation.phone, name: invitation.name })

  return { success: true, phone: values.phone }
}

export async function signInInvitation(values: LoginFormValues) {
  const limit = await rateLimitByIp('invitation-login', 20, 5 * 60 * 1000, values.phone)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan login. Coba lagi beberapa menit lagi.' }
  }

  const validated = loginSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Nomor HP/Email atau password tidak valid' }
  }

  const input = values.phone.trim()
  const isEmail = input.includes('@')

  let invitation = null
  let auth = null

  if (isEmail) {
    invitation = await findInvitationByEmail(input)
    if (invitation) auth = await findInvitationAuthById(invitation.id)
  } else {
    invitation = await findInvitationByPhone(input)
    if (invitation) auth = await findInvitationAuthByPhone(input)
  }

  if (!invitation || !auth || !verifyPassword(values.password, auth)) {
    return { error: 'Nomor HP/Email atau password salah' }
  }

  clearRateLimit('invitation-login')
  await createInvitationSession({ id: invitation.id, phone: invitation.phone, name: invitation.name })

  return { success: true, user: { id: invitation.id, phone: invitation.phone, name: invitation.name } }
}

export async function signOutInvitation() {
  await clearInvitationSession()
  return { success: true }
}
