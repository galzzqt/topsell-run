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
} from '@/lib/db'
import { AdminDashboardClient, type AdminCommunity, type AdminParticipant, type AdminPayment, type AdminStats } from './ui/AdminDashboardClient'
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
    readAdminSettings(),
    readEditableEnvSnapshot(),
    getAdminPublicAccounts(),
    session.role === 'superadmin' ? queryAdminLogs(100) : Promise.resolve({ logs: [], error: null }),
  ])

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
    community_code: f.family_code,
    provinsi: f.provinsi,
    kota: f.kota,
    kecamatan: f.kecamatan,
    created_at: f.created_at,
  })) as AdminCommunity[]

  // Map family participants to AdminParticipant shape for UI compatibility
  const familyParticipantRows = familyParticipants.map((fp) => ({
    id: fp.id,
    full_name: fp.full_name,
    bib_name: fp.bib_name,
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
    payment_status: fp.payment_status as 'pending' | 'paid' | 'failed',
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
    status: fp.status as 'pending' | 'paid' | 'failed',
    paid_at: fp.paid_at,
    created_at: fp.created_at,
    registration: fp.registration
      ? {
        community_id: fp.registration.family_id,
        community: fp.registration.family
          ? {
            id: fp.registration.family.id,
            name: fp.registration.family.name,
            leader_name: fp.registration.family.leader_name,
            email: fp.registration.family.email,
            phone: fp.registration.family.phone,
            community_code: fp.registration.family.family_code,
            provinsi: fp.registration.family.provinsi,
            kota: fp.registration.family.kota,
            kecamatan: fp.registration.family.kecamatan,
          }
          : null,
      }
      : null,
  })) as AdminPayment[]

  // Combined stats
  const stats: AdminStats = {
    communities: communityRows.length + familyRows.length,
    participants: participantRows.length + familyParticipantRows.length,
    paidParticipants:
      participantRows.filter((p) => p.payment_status === 'paid').length +
      familyParticipantRows.filter((p) => p.payment_status === 'paid').length,
    pendingParticipants:
      participantRows.filter((p) => p.payment_status === 'pending').length +
      familyParticipantRows.filter((p) => p.payment_status === 'pending').length,
    racepacksPickedUp:
      participantRows.filter((p) => p.checked_in).length +
      familyParticipantRows.filter((p) => p.checked_in).length,
    revenue: sumPaidAmount(paymentRows) + sumPaidAmount(familyPaymentRows),
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
      adminSettings={adminSettings}
      editableEnv={editableEnv}
      currentAdmin={session}
      managedAdmins={getAdminAccountsResult}
      axiomLogs={axiomLogs.logs}
      axiomLogsError={axiomLogs.error}
    />
  )
}
