import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import PacerForm from './PacerForm'

// Pengaturan admin dibaca dari DB per request — jangan diprerender saat build.
export const dynamic = 'force-dynamic'

export default async function PacerPage() {
  const gate = await isPackageOpen('pacer')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <PacerForm />
}
