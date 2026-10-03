import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import CommunityPackageForm from './CommunityPackageForm'

// Pengaturan admin dibaca dari DB per request — jangan diprerender saat build.
export const dynamic = 'force-dynamic'

export default async function CommunityPackagePage() {
  const gate = await isPackageOpen('community')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <CommunityPackageForm />
}
