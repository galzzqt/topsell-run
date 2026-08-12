import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import IndividuForm from './IndividuForm'

export default async function IndividuPage() {
  const gate = await isPackageOpen('individual')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <IndividuForm />
}
