import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import IndividuForm from './IndividuForm'

// Pengaturan admin dibaca dari DB per request — jangan diprerender saat build.
export const dynamic = 'force-dynamic'

export default async function IndividuPage() {
  const gate = await isPackageOpen('individual')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <IndividuForm />
}
