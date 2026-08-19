import { getAdminSession } from '@/lib/admin/auth'
import { getAdminPublicAccounts } from '@/lib/admin/accounts'
import { queryAdminLogs } from '@/lib/axiom/logs'
import {
  listCommunities,
  listParticipantsWithCommunity,
  listPaymentsWithRelations,
  listFamilies,
  listFamilyParticipantsWithFamily,
  listFamilyPaymentsWithRelations,
  listIndividuals,
  listIndividualParticipantsWithIndividual,
  listIndividualPaymentsWithRelations,
  listPacerParticipantsWithPacer,
  listUmkms,
  listUmkmPayments,
} from '@/lib/db'
import { AdminDashboardClient, type AdminCommunity, type AdminParticipant, type AdminPayment, type AdminStats, type AdminPacerRow } from './ui/AdminDashboardClient'
import { AdminLogin } from './ui/AdminLogin'
import { readAdminSettings, readEditableEnvSnapshot } from '@/lib/admin/settings'

export const dynamic = 'force-dynamic'

function sumPaidAmount(payments: AdminPayment[]) {
  return payments
    .filter((payment) => payment.status === 'paid')
    .reduce((total, payment) => total + payment.amount, 0)
}

export default async function AdminPage() {
  const session = await getAdminSession()
  if (!session) return <AdminLogin />

  const [
    participants,
    communities,
    payments,
    familyParticipants,
    families,
    familyPayments,
    individualParticipantsRaw,
    individualsRaw,
    individualPaymentsRaw,
    pacerParticipantsRaw,
    umkmsRaw,
    umkmPaymentsRaw,
    adminSettings,
    editableEnv,
    getAdminAccountsResult,
    axiomLogs,
  ] = await Promise.all([
    listParticipantsWithCommunity(),
    listCommunities(),
    listPaymentsWithRelations(),
    listFamilyParticipantsWithFamily(),
    listFamilies(),
    listFamilyPaymentsWithRelations(),
    listIndividualParticipantsWithIndividual(),
    listIndividuals(),
    listIndividualPaymentsWithRelations(),
    listPacerParticipantsWithPacer(),
    listUmkms(),
    listUmkmPayments(),
    readAdminSettings(),
    readEditableEnvSnapshot(),
    getAdminPublicAccounts(),
    session.role === 'superadmin' ? queryAdminLogs(100) : Promise.resolve({ logs: [], error: null }),
  ])

  // Overwrite session allowed_tabs with the fresh one from database/file if it exists
  const freshAdmin = getAdminAccountsResult.find((account) => account.id === session.id)
  if (freshAdmin) {
    session.allowed_tabs = freshAdmin.allowed_tabs || []
  } else if (session.role === 'admin' && session.id === 'admin-env') {
    // Fallback for env admin
    session.allowed_tabs = [
      'summary',
      'participants',
      'payments',
      'scanner',
      'export_participants',
      'export_payments',
      'pacer',
      'umkm',
    ]
  }

  const participantRows = participants as AdminParticipant[]
  const paymentRows = payments as AdminPayment[]
  const communityRows = communities as AdminCommunity[]

  // Map family rows to AdminCommunity shape for UI compatibility
  const familyRows = families.map((f) => ({
    id: f.id,
    name: f.name,
    leader_name: f.leader_name,
    email: f.email,
    phone: f.phone,
    category: f.category,
    community_code: f.family_code,
    provinsi: f.provinsi,
    kota: f.kota,
    kecamatan: f.kecamatan,
    created_at: f.created_at,
    registration_type: f.registration_type ?? 'family',
  })) as AdminCommunity[]

  // Map family participants to AdminParticipant shape for UI compatibility
  const familyParticipantRows = familyParticipants.map((fp) => ({
    id: fp.id,
    full_name: fp.full_name,
    bib_name: fp.bib_name,
    ktp_number: fp.ktp_number,
    email: fp.email,
    phone: fp.phone,
    date_of_birth: fp.date_of_birth,
    gender: fp.gender,
    tshirt_size: fp.tshirt_size,
    blood_type: fp.blood_type,
    medical_condition: fp.medical_condition,
    emergency_contact_name: fp.emergency_contact_name,
    emergency_contact_phone: fp.emergency_contact_phone,
    participant_code: fp.participant_code,
    qr_code_data: fp.qr_code_data,
    payment_status: fp.payment_status as 'pending' | 'paid' | 'failed' | 'expired',
    checked_in: fp.checked_in,
    checked_in_at: fp.checked_in_at,
    created_at: fp.created_at,
    community: fp.family
      ? {
        id: fp.family.id,
        name: fp.family.name,
        leader_name: fp.family.leader_name,
        email: fp.family.email,
        phone: fp.family.phone,
        category: fp.family.category,
        community_code: fp.family.family_code,
        provinsi: fp.family.provinsi,
        kota: fp.family.kota,
        kecamatan: fp.family.kecamatan,
      }
      : null,
  })) as AdminParticipant[]

  // Map family payments to AdminPayment shape for UI compatibility
  const familyPaymentRows = familyPayments.map((fp) => ({
    id: fp.id,
    registration_id: fp.registration_id,
    amount: fp.amount,
    payment_method: fp.payment_method,
    payment_reference: fp.payment_reference,
    status: fp.status as 'pending' | 'paid' | 'failed' | 'expired',
    paid_at: fp.paid_at,
    created_at: fp.created_at,
    registration: fp.registration
      ? {
        community_id: fp.registration.family_id,
        total_participants: fp.registration.total_participants,
        community: fp.registration.family
          ? {
            id: fp.registration.family.id,
            name: fp.registration.family.name,
            leader_name: fp.registration.family.leader_name,
            email: fp.registration.family.email,
            phone: fp.registration.family.phone,
            category: fp.registration.family.category,
            community_code: fp.registration.family.family_code,
            provinsi: fp.registration.family.provinsi,
            kota: fp.registration.family.kota,
            kecamatan: fp.registration.family.kecamatan,
          }
          : null,
      }
      : null,
  })) as AdminPayment[]

  // Map individual rows to AdminCommunity shape for UI compatibility
  const individualRows = individualsRaw.map((f) => ({
    id: f.id,
    name: f.name,
    leader_name: f.leader_name,
    email: f.email,
    phone: f.phone,
    category: f.category,
    community_code: f.individual_code,
    provinsi: f.provinsi,
    kota: f.kota,
    kecamatan: f.kecamatan,
    created_at: f.created_at,
  })) as AdminCommunity[]

  const individualParticipantRows = individualParticipantsRaw.map((fp) => ({
    id: fp.id,
    full_name: fp.full_name,
    bib_name: fp.bib_name,
    ktp_number: fp.ktp_number,
    email: fp.email,
    phone: fp.phone,
    date_of_birth: fp.date_of_birth,
    gender: fp.gender,
    tshirt_size: fp.tshirt_size,
    blood_type: fp.blood_type,
    medical_condition: fp.medical_condition,
    emergency_contact_name: fp.emergency_contact_name,
    emergency_contact_phone: fp.emergency_contact_phone,
    participant_code: fp.participant_code,
    qr_code_data: fp.qr_code_data,
    payment_status: fp.payment_status as 'pending' | 'paid' | 'failed' | 'expired',
    checked_in: fp.checked_in,
    checked_in_at: fp.checked_in_at,
    created_at: fp.created_at,
    community: fp.individual
      ? {
        id: fp.individual.id,
        name: fp.individual.name,
        leader_name: fp.individual.leader_name,
        email: fp.individual.email,
        phone: fp.individual.phone,
        category: fp.individual.category,
        community_code: fp.individual.individual_code,
        provinsi: fp.individual.provinsi,
        kota: fp.individual.kota,
        kecamatan: fp.individual.kecamatan,
      }
      : null,
  })) as AdminParticipant[]

  const individualPaymentRows = individualPaymentsRaw.map((fp) => ({
    id: fp.id,
    registration_id: fp.registration_id,
    amount: fp.amount,
    payment_method: fp.payment_method,
    payment_reference: fp.payment_reference,
    status: fp.status as 'pending' | 'paid' | 'failed' | 'expired',
    paid_at: fp.paid_at,
    created_at: fp.created_at,
    registration: fp.registration
      ? {
        community_id: fp.registration.individual_id,
        total_participants: fp.registration.total_participants,
        community: fp.registration.individual
          ? {
            id: fp.registration.individual.id,
            name: fp.registration.individual.name,
            leader_name: fp.registration.individual.leader_name,
            email: fp.registration.individual.email,
            phone: fp.registration.individual.phone,
            community_code: fp.registration.individual.individual_code,
            provinsi: fp.registration.individual.provinsi,
            kota: fp.registration.individual.kota,
            kecamatan: fp.registration.individual.kecamatan,
          }
          : null,
      }
      : null,
  })) as AdminPayment[]

  const pacerRows = pacerParticipantsRaw.map((p) => ({
    id: p.id,
    pacer_id: p.pacer_id,
    full_name: p.full_name,
    bib_name: p.bib_name,
    ktp_number: p.ktp_number,
    email: p.email,
    phone: p.phone,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
    tshirt_size: p.tshirt_size,
    blood_type: p.blood_type,
    medical_condition: p.medical_condition,
    emergency_contact_name: p.emergency_contact_name,
    emergency_contact_phone: p.emergency_contact_phone,
    age: p.age,
    sosmed_instagram: p.sosmed_instagram,
    sosmed_tiktok: p.sosmed_tiktok,
    strava_link: p.strava_link,
    strava_username: p.strava_username,
    bank_name: p.bank_name,
    bank_account_number: p.bank_account_number,
    bank_account_holder: p.bank_account_holder,
    has_smartwatch: p.has_smartwatch,
    media_urls: p.media_urls,
    pb_media_urls: p.pb_media_urls,
    category: p.pacer?.category || '',
    pacer_code: p.pacer?.pacer_code || '',
    provinsi: p.provinsi,
    kota: p.kota,
    kecamatan: p.kecamatan,
    status: p.pacer?.status || 'pending',
    status_note: p.pacer?.status_note || null,
    created_at: p.created_at,
  })) as AdminPacerRow[]

  // Combined stats
  const stats: AdminStats = {
    communities: communityRows.length + familyRows.length + individualRows.length,
    participants: participantRows.length + familyParticipantRows.length + individualParticipantRows.length,
    paidParticipants:
      participantRows.filter((p) => p.payment_status === 'paid').length +
      familyParticipantRows.filter((p) => p.payment_status === 'paid').length +
      individualParticipantRows.filter((p) => p.payment_status === 'paid').length,
    pendingParticipants:
      participantRows.filter((p) => p.payment_status === 'pending').length +
      familyParticipantRows.filter((p) => p.payment_status === 'pending').length +
      individualParticipantRows.filter((p) => p.payment_status === 'pending').length,
    racepacksPickedUp:
      participantRows.filter((p) => p.checked_in).length +
      familyParticipantRows.filter((p) => p.checked_in).length +
      individualParticipantRows.filter((p) => p.checked_in).length,
    revenue: sumPaidAmount(paymentRows) + sumPaidAmount(familyPaymentRows) + sumPaidAmount(individualPaymentRows),
  }

  return (
    <AdminDashboardClient
      stats={stats}
      participants={participantRows}
      communities={communityRows}
      payments={paymentRows}
      familyParticipants={familyParticipantRows}
      families={familyRows}
      familyPayments={familyPaymentRows}
      individualParticipants={individualParticipantRows}
      individuals={individualRows}
      individualPayments={individualPaymentRows}
      pacerRows={pacerRows}
      umkmRows={umkmsRaw}
      umkmPayments={umkmPaymentsRaw}
      adminSettings={adminSettings}
      editableEnv={editableEnv}
      currentAdmin={session}
      managedAdmins={getAdminAccountsResult}
      axiomLogs={axiomLogs.logs}
      axiomLogsError={axiomLogs.error}
    />
  )
}
