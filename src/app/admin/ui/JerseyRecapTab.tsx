'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AdminSettings, PackageKey } from '@/lib/admin/settings-schema'

type JerseyPackageKey = Exclude<PackageKey, 'umkm'>
type SizeRow = { tshirt_size: string; payment_status?: string; status?: string }

const PACKAGE_KEYS: JerseyPackageKey[] = ['community', 'family', 'individual', 'invitation', 'pacer']

type SizeStat = { size: string; label: string; enabled: boolean; soldOut: boolean; quota: number; paid: number; pending: number }

/** Lunas/pending per ukuran. Aturan hitung sama dengan countJerseyUsage di server (pacer: approved/pending). */
function buildStats(settings: AdminSettings, pkg: JerseyPackageKey, rows: SizeRow[]): SizeStat[] {
  const stats = settings.registrationForm[pkg].participants.tshirt_size.options.map((option) => ({
    size: option.value,
    label: option.label,
    enabled: option.enabled !== false,
    soldOut: option.soldOut === true,
    quota: option.quota || 0,
    paid: 0,
    pending: 0,
  }))
  for (const row of rows) {
    const status = pkg === 'pacer' ? row.status : row.payment_status
    const stat = stats.find((s) => s.size === row.tshirt_size)
    if (!stat) continue
    if (status === 'paid' || status === 'approved') stat.paid++
    else if (status === 'pending') stat.pending++
  }
  return stats
}

export function JerseyRecapTab({
  settings,
  rowsByPackage,
}: {
  settings: AdminSettings
  rowsByPackage: Record<JerseyPackageKey, SizeRow[]>
}) {
  const [selected, setSelected] = useState<JerseyPackageKey | 'all'>('all')

  const statsByPackage = useMemo(
    () => Object.fromEntries(PACKAGE_KEYS.map((pkg) => [pkg, buildStats(settings, pkg, rowsByPackage[pkg])])) as Record<JerseyPackageKey, SizeStat[]>,
    [settings, rowsByPackage]
  )
  const sizes = statsByPackage.community.map((s) => s.size)
  const usedOf = (pkg: JerseyPackageKey, size: string) => {
    const stat = statsByPackage[pkg].find((s) => s.size === size)
    return stat ? stat.paid + stat.pending : 0
  }

  const exportXlsx = async () => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(
        sizes.map((size) => ({
          Ukuran: size,
          ...Object.fromEntries(PACKAGE_KEYS.map((pkg) => [settings.packages[pkg].label, usedOf(pkg, size)])),
          Total: PACKAGE_KEYS.reduce((sum, pkg) => sum + usedOf(pkg, size), 0),
        }))
      ),
      'Semua Paket'
    )
    for (const pkg of PACKAGE_KEYS) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(
          statsByPackage[pkg].map((s) => ({
            Ukuran: s.size,
            Status: !s.enabled ? 'Disembunyikan' : s.soldOut ? 'Habis (manual)' : 'Tersedia',
            Lunas: s.paid,
            Pending: s.pending,
            Total: s.paid + s.pending,
            Kuota: s.quota || 'Tak terbatas',
            Sisa: s.quota ? Math.max(0, s.quota - s.paid - s.pending) : '-',
          }))
        ),
        settings.packages[pkg].label.slice(0, 31)
      )
    }
    XLSX.writeFile(workbook, `topsell-run-rekap-jersey-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const th = 'px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-brand-muted'
  const td = 'px-4 py-3 text-xs font-bold text-foreground'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(['all', ...PACKAGE_KEYS] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`px-3 py-1.5 rounded-lg border text-[11px] font-black uppercase transition-colors cursor-pointer ${
                selected === key ? 'border-sport-orange bg-sport-orange/15 text-sport-orange' : 'border-card-border text-brand-muted hover:text-foreground'
              }`}
            >
              {key === 'all' ? 'Semua Paket' : settings.packages[key].label}
            </button>
          ))}
        </div>
        <Button type="button" variant="secondary" onClick={exportXlsx}>
          <Download className="w-4 h-4" /> Export Excel
        </Button>
      </div>

      <p className="text-[11px] text-brand-muted">
        Terpakai = lunas + pending (pending ditahan 24 jam, lalu dilepas otomatis). Pacer: approved + pending. Kuota & ukuran yang tampil diatur di Kelola Paket → Edit Form Pendaftaran.
      </p>

      <div className="border border-card-border rounded-xl bg-card-bg overflow-x-auto">
        {selected === 'all' ? (
          <table className="w-full min-w-[640px]">
            <thead className="bg-brand-gray/20 border-b border-card-border">
              <tr>
                <th className={th}>Ukuran</th>
                {PACKAGE_KEYS.map((pkg) => <th key={pkg} className={th}>{settings.packages[pkg].label}</th>)}
                <th className={th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((size) => (
                <tr key={size} className="border-b border-card-border last:border-0">
                  <td className={td}>{size}</td>
                  {PACKAGE_KEYS.map((pkg) => <td key={pkg} className={td}>{usedOf(pkg, size)}</td>)}
                  <td className={`${td} text-sport-orange`}>{PACKAGE_KEYS.reduce((sum, pkg) => sum + usedOf(pkg, size), 0)}</td>
                </tr>
              ))}
              <tr className="bg-brand-gray/20">
                <td className={`${td} uppercase`}>Total</td>
                {PACKAGE_KEYS.map((pkg) => (
                  <td key={pkg} className={td}>{sizes.reduce((sum, size) => sum + usedOf(pkg, size), 0)}</td>
                ))}
                <td className={`${td} text-sport-orange`}>
                  {PACKAGE_KEYS.reduce((sum, pkg) => sum + sizes.reduce((s, size) => s + usedOf(pkg, size), 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[640px]">
            <thead className="bg-brand-gray/20 border-b border-card-border">
              <tr>
                {['Ukuran', 'Lunas', 'Pending', 'Terpakai', 'Kuota', 'Sisa', 'Status'].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {statsByPackage[selected].map((s) => {
                const used = s.paid + s.pending
                const full = s.soldOut || (s.quota > 0 && used >= s.quota)
                return (
                  <tr key={s.size} className={`border-b border-card-border last:border-0 ${s.enabled ? '' : 'opacity-50'}`}>
                    <td className={td}>{s.size}</td>
                    <td className={`${td} text-green-400`}>{s.paid}</td>
                    <td className={`${td} text-amber-400`}>{s.pending}</td>
                    <td className={td}>{used}</td>
                    <td className={td}>{s.quota || '∞'}</td>
                    <td className={td}>{s.quota ? Math.max(0, s.quota - used) : '-'}</td>
                    <td className={td}>
                      {!s.enabled ? (
                        <span className="text-brand-muted">Disembunyikan</span>
                      ) : full ? (
                        <span className="text-red-400">Habis</span>
                      ) : (
                        <span className="text-green-400">Tersedia</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
