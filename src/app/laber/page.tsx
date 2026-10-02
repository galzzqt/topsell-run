import type { Metadata } from 'next'
import { getPackagesSettings, isPackageOpen } from '@/lib/admin/settings'
import { ClosedNotice } from '@/components/landing/ClosedNotice'
import LaberForm from './LaberForm'

// Status buka/tutup, jadwal & daftar komunitas dibaca dari DB per request — jangan diprerender saat build.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { laber } = await getPackagesSettings()
  const names = [...new Set(laber.periods.flatMap((p) => p.categories.map((c) => c.label)))]
  return {
    title: 'Pendaftaran Laber — Topsell Run 2026',
    description: `Formulir pendaftaran Latihan Bersama (Laber) Komunitas Topsell Run 2026${names.length ? ` bersama ${names.join(', ')}` : ''}. Gratis tanpa pembayaran.`,
    keywords: ['laber topsell run', 'lari bersama topsell', 'komunitas lari mojokerto', ...names.map((n) => n.toLowerCase())].join(', '),
  }
}

export default async function LaberPage() {
  const gate = await isPackageOpen('laber')
  if (!gate.open || !gate.period) {
    return <ClosedNotice reason={gate.reason} />
  }
  const communities = gate.period.categories.map(({ value, label }) => ({ value, label }))
  return <LaberForm communities={communities} />
}
