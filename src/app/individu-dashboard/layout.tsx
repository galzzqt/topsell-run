import { redirect } from 'next/navigation'
import { getIndividualSession } from '@/lib/auth/individual'

export default async function IndividuDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getIndividualSession()
  if (!session) {
    redirect('/login')
  }

  return children
}
