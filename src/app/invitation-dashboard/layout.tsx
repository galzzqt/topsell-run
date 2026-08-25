import { redirect } from 'next/navigation'
import { getInvitationSession } from '@/lib/auth/invitation'

export default async function InvitationDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getInvitationSession()
  if (!session) {
    redirect('/login')
  }

  return children
}
