import { isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import UmkmRegisterForm from './UmkmRegisterForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pendaftaran Tenant UMKM — Topsell Run 2026',
  description: 'Daftarkan usaha UMKM Anda sebagai tenant di Topsell Run 2026. Biaya pendaftaran Rp 500.000.',
}

export default async function RegistrasiTenantUmkmPage() {
  const gate = await isPackageOpen('umkm')
  if (!gate.open) {
    return <ClosedNotice reason={gate.reason} />
  }
  return <UmkmRegisterForm />
}
