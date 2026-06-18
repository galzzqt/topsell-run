import { redirect } from 'next/navigation'
import { getCommunitySession } from '@/lib/auth/community'

export default async function CommunityLoginLayout({ children }: { children: React.ReactNode }) {
  const session = await getCommunitySession()
  if (session) {
    redirect('/community-dashboard')
  }

  return children
}
