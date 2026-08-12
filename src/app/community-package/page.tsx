import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import CommunityPackageForm from './CommunityPackageForm'

export default async function CommunityPackagePage() {
  const gate = await isPackageOpen('community')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <CommunityPackageForm />
}
