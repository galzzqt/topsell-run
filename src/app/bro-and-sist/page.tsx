import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import BroAndSistForm from './BroAndSistForm'

export default async function BroAndSistPage() {
  const gate = await isPackageOpen('family')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <BroAndSistForm />
}
