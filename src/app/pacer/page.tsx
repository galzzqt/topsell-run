import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import PacerForm from './PacerForm'

export default async function PacerPage() {
  const gate = await isPackageOpen('pacer')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <PacerForm />
}
