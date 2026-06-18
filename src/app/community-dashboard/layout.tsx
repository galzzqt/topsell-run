import { redirect } from 'next/navigation'
import { getCommunitySession } from '@/lib/auth/community'

export default async function CommunityDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCommunitySession()
  if (!session) {
    redirect('/community-login')
  }

  return children
}
