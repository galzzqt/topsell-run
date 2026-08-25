import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import InvitationForm from './InvitationForm'

export default async function InvitationPage() {
  const gate = await isPackageOpen('invitation')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <InvitationForm />
}
