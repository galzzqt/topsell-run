import { redirect } from 'next/navigation'
import { getPacerSession } from '@/lib/auth/pacer'

export default async function PacerDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getPacerSession()
  if (!session) {
    redirect('/login')
  }

  return children
}
