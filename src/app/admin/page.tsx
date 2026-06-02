import { createAdminClient } from '@/lib/supabase/server'
import { getAdminSession } from '@/lib/admin/auth'
import { getAdminPublicAccounts } from '@/lib/admin/accounts'
import { queryAdminLogs } from '@/lib/axiom/logs'
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

  const supabase = createAdminClient()
  const [{ data: participants }, { data: communities }, { data: payments }, adminSettings, editableEnv, managedAdmins, axiomLogs] = await Promise.all([
    supabase
      .from('participants')
      .select('id, full_name, bib_name, email, phone, date_of_birth, gender, tshirt_size, blood_type, medical_condition, emergency_contact_name, emergency_contact_phone, participant_code, qr_code_data, payment_status, checked_in, checked_in_at, created_at, community:communities(id, name, leader_name, email, phone, community_code, provinsi, kota, kecamatan)'),
    supabase
      .from('communities')
      .select('id, name, leader_name, email, phone, community_code, provinsi, kota, kecamatan, created_at'),
    supabase
      .from('payments')
      .select('id, registration_id, amount, payment_method, payment_reference, status, paid_at, created_at, registration:registrations(community_id, community:communities(id, name, leader_name, email, phone, community_code, provinsi, kota, kecamatan))')
      .order('created_at', { ascending: false }),
    readAdminSettings(),
    readEditableEnvSnapshot(),
    getAdminPublicAccounts(),
    session.role === 'superadmin' ? queryAdminLogs(100) : Promise.resolve({ logs: [], error: null }),
  ])

  const participantRows = (participants || []) as AdminParticipant[]
  const paymentRows = (payments || []) as AdminPayment[]
  const communityRows = (communities || []) as AdminCommunity[]

  const stats: AdminStats = {
    communities: communityRows.length,
    participants: participantRows.length,
    paidParticipants: participantRows.filter((participant) => participant.payment_status === 'paid').length,
    pendingParticipants: participantRows.filter((participant) => participant.payment_status === 'pending').length,
    racepacksPickedUp: participantRows.filter((participant) => participant.checked_in).length,
    revenue: sumPaidAmount(paymentRows),
  }

  return (
    <AdminDashboardClient
      stats={stats}
      participants={participantRows}
      communities={communityRows}
      payments={paymentRows}
      adminSettings={adminSettings}
      editableEnv={editableEnv}
      currentAdmin={session}
      managedAdmins={managedAdmins}
      axiomLogs={axiomLogs.logs}
      axiomLogsError={axiomLogs.error}
    />
  )
}
