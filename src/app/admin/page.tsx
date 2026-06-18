import { getAdminSession } from '@/lib/admin/auth'
import { getAdminPublicAccounts } from '@/lib/admin/accounts'
import { queryAdminLogs } from '@/lib/axiom/logs'
import { listCommunities, listParticipantsWithCommunity, listPaymentsWithRelations } from '@/lib/db'
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

  const [participants, communities, payments, adminSettings, editableEnv, managedAdmins, axiomLogs] = await Promise.all([
    listParticipantsWithCommunity(),
    listCommunities(),
    listPaymentsWithRelations(),
    readAdminSettings(),
    readEditableEnvSnapshot(),
    getAdminPublicAccounts(),
    session.role === 'superadmin' ? queryAdminLogs(100) : Promise.resolve({ logs: [], error: null }),
  ])

  const participantRows = participants as AdminParticipant[]
  const paymentRows = payments as AdminPayment[]
  const communityRows = communities as AdminCommunity[]

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
