import { redirect } from 'next/navigation'
import { getFamilySession } from '@/lib/auth/family'

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await getFamilySession()
  if (session) {
    redirect('/dashboard')
  }

  return children
}
