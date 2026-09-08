'use client'

import { useEffect, useCallback, useState } from 'react'
import { Plus, Pencil, Trash2, TicketCheck, RefreshCw, X, Key, Sparkles, FileEdit, CheckCircle2, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog } from '@/components/ui/dialog'
import type { VoucherDoc } from '@/lib/types/voucher'
import type { AdminSettings, PackageKey } from '@/lib/admin/settings-schema'
import { getWibNowString } from '@/lib/utils/format'

type VoucherFormState = {
  name: string
  code: string
  type: 'code' | 'auto'
  discountType: 'percent' | 'flat'
  discountValue: number
  maxUsage: number | null
  validFrom: string
  validUntil: string
  packageKeys: string[]
  allowedCategories: string[]
}

const defaultVoucherForm: VoucherFormState = {
  name: '',
  code: '',
  type: 'code',
  discountType: 'percent',
  discountValue: 0,
  maxUsage: null,
  validFrom: '',
  validUntil: '',
  packageKeys: ['community', 'family', 'individual', 'invitation', 'umkm'],
  allowedCategories: [],
}

const ALL_PACKAGES = [
  { key: 'community', label: 'Komunitas' },
  { key: 'family', label: 'Bro & Sist' },
  { key: 'individual', label: 'Individu' },
  { key: 'invitation', label: 'Invitation' },
  { key: 'umkm', label: 'Tenant UMKM' },
]

function formatDate(iso: string) {
  if (!iso) return '-'
  const [datePart, timePart] = iso.split('T')
  if (!datePart) return iso
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  const monthName = months[parseInt(m, 10) - 1] || m
  return `${d} ${monthName} ${y} ${timePart || ''}`.trim()
}

export function VouchersTab({
  adminSettings,
  voucherList,
  setVoucherList,
  voucherLoading,
  setVoucherLoading,
  voucherError,
  setVoucherError,
  voucherSuccess,
  setVoucherSuccess,
  voucherDialogOpen,
  setVoucherDialogOpen,
  voucherEditTarget,
  setVoucherEditTarget,
  voucherForm,
  setVoucherForm,
}: {
  adminSettings: AdminSettings
  voucherList: VoucherDoc[]
  setVoucherList: (v: VoucherDoc[]) => void
  voucherLoading: boolean
  setVoucherLoading: (v: boolean) => void
  voucherError: string | null
  setVoucherError: (v: string | null) => void
  voucherSuccess: string | null
  setVoucherSuccess: (v: string | null) => void
  voucherDialogOpen: boolean
  setVoucherDialogOpen: (v: boolean) => void
  voucherEditTarget: VoucherDoc | null
  setVoucherEditTarget: (v: VoucherDoc | null) => void
  voucherForm: VoucherFormState
  setVoucherForm: (v: VoucherFormState) => void
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  const loadVouchers = useCallback(async () => {
    setVoucherLoading(true)
    setVoucherError(null)
    try {
      const res = await fetch('/api/admin/vouchers')
      if (!res.ok) throw new Error('Gagal memuat data voucher')
      const data = await res.json()
      setVoucherList(data.vouchers || [])
    } catch (e) {
      setVoucherError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      setVoucherLoading(false)
    }
  }, [setVoucherList, setVoucherLoading, setVoucherError])

  useEffect(() => {
    loadVouchers()
  }, [loadVouchers])

  const openCreate = () => {
    setVoucherEditTarget(null)
    setVoucherForm(defaultVoucherForm)
    setVoucherDialogOpen(true)
    setVoucherError(null)
    setVoucherSuccess(null)
  }

  const openEdit = (v: VoucherDoc) => {
    setVoucherEditTarget(v)
    setVoucherForm({
      name: v.name,
      code: v.code,
      type: v.type,
      discountType: v.discountType,
      discountValue: v.discountValue,
      maxUsage: v.maxUsage === 0 ? null : v.maxUsage,
      validFrom: v.validFrom,
      validUntil: v.validUntil,
      packageKeys: v.packages,
      allowedCategories: v.categories,
    })
    setVoucherDialogOpen(true)
    setVoucherError(null)
    setVoucherSuccess(null)
  }

  const handleSubmit = async () => {
    setVoucherError(null)
    setVoucherSuccess(null)
    try {
      if (voucherEditTarget) {
        const res = await fetch('/api/admin/vouchers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: voucherEditTarget.id, ...voucherForm }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal update')
        setVoucherSuccess('Voucher berhasil diperbarui')
      } else {
        const res = await fetch('/api/admin/vouchers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(voucherForm),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Gagal membuat')
        setVoucherSuccess('Voucher berhasil dibuat')
      }
      await loadVouchers()
      setVoucherDialogOpen(false)
    } catch (e) {
      setVoucherError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    }
  }

  const handleToggleEnabled = async (v: VoucherDoc) => {
    try {
      await fetch('/api/admin/vouchers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: v.id, enabled: !v.enabled }),
      })
      await loadVouchers()
    } catch {
      // silent
    }
  }

  // ── Search & pagination (client-side; seluruh voucher sudah ada di memori) ──
  const filtered = (() => {
    const q = search.trim().toLowerCase()
    if (!q) return voucherList
    return voucherList.filter((v) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q))
  })()

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedList = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ── Bulk actions ──────────────────────────────────────────────
  // Pakai endpoint satu-satu yang sudah ada; jumlah voucher masih puluhan.
  // ponytail: N request paralel, ganti ke endpoint bulk kalau daftarnya sudah ratusan.
  const allSelected = pagedList.length > 0 && pagedList.every((v) => selectedIds.has(v.id))

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // Pilih semua = semua baris di halaman yang sedang tampil.
  const toggleSelectAll = () => {
    const next = new Set(selectedIds)
    for (const v of pagedList) {
      if (allSelected) next.delete(v.id)
      else next.add(v.id)
    }
    setSelectedIds(next)
  }

  const runBulk = async (label: string, fn: (id: string) => Promise<Response>) => {
    setVoucherError(null)
    setVoucherSuccess(null)
    setVoucherLoading(true)
    try {
      const results = await Promise.allSettled([...selectedIds].map(fn))
      const failed = results.filter((r) => r.status === 'rejected' || !r.value.ok).length
      if (failed) throw new Error(`${failed} dari ${results.length} voucher gagal ${label}`)
      setVoucherSuccess(`${results.length} voucher berhasil ${label}`)
      setSelectedIds(new Set())
    } catch (e) {
      setVoucherError(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally {
      await loadVouchers()
      setVoucherLoading(false)
    }
  }

  const bulkSetEnabled = (enabled: boolean) =>
    runBulk(enabled ? 'diaktifkan' : 'dijadikan draft', (id) =>
      fetch('/api/admin/vouchers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      })
    )

  const bulkDelete = () => {
    if (!confirm(`Hapus ${selectedIds.size} voucher terpilih? Tindakan ini tidak bisa dibatalkan.`)) return
    return runBulk('dihapus', (id) => fetch(`/api/admin/vouchers?id=${id}`, { method: 'DELETE' }))
  }

  const handleDelete = async (v: VoucherDoc) => {
    if (!confirm(`Hapus voucher "${v.name}"? Tindakan ini tidak bisa dibatalkan.`)) return
    try {
      await fetch(`/api/admin/vouchers?id=${v.id}`, { method: 'DELETE' })
      await loadVouchers()
    } catch {
      // silent
    }
  }

  // Dynamically resolve category options from adminSettings based on selected packageKeys
  const categoryOptions = (() => {
    const cats = new Set<string>()
    voucherForm.packageKeys.forEach((pkgKey) => {
      const pkg = adminSettings?.packages?.[pkgKey as PackageKey]
      if (pkg?.periods) {
        pkg.periods.forEach((period) => {
          if (period.categories) {
            period.categories.forEach((cat) => {
              cats.add(cat.value)
            })
          }
        })
      }
    })
    return Array.from(cats)
  })()

  const togglePackage = (key: string) => {
    const curr = voucherForm.packageKeys
    const nextPackageKeys = curr.includes(key) ? curr.filter((k) => k !== key) : [...curr, key]

    // Compute valid categories for the new packageKeys
    const validCats = new Set<string>()
    nextPackageKeys.forEach((pkgKey) => {
      const pkg = adminSettings?.packages?.[pkgKey as PackageKey]
      if (pkg?.periods) {
        pkg.periods.forEach((period) => {
          if (period.categories) {
            period.categories.forEach((cat) => {
              validCats.add(cat.value)
            })
          }
        })
      }
    })

    // Filter allowedCategories to keep only those that are still valid
    const nextAllowedCategories = voucherForm.allowedCategories.filter((cat) => validCats.has(cat))

    setVoucherForm({
      ...voucherForm,
      packageKeys: nextPackageKeys,
      allowedCategories: nextAllowedCategories,
    })
  }

  const toggleCategory = (cat: string) => {
    const curr = voucherForm.allowedCategories
    setVoucherForm({
      ...voucherForm,
      allowedCategories: curr.includes(cat) ? curr.filter((c) => c !== cat) : [...curr, cat],
    })
  }

  const now = getWibNowString()
  const getStatus = (v: VoucherDoc) => {
    if (!v.enabled) return { label: 'Draft', color: 'bg-brand-muted/20 text-brand-muted' }
    if (v.validUntil < now) return { label: 'Expired', color: 'bg-red-500/20 text-red-400' }
    if (v.validFrom > now) return { label: 'Belum Mulai', color: 'bg-amber-500/20 text-amber-400' }
    if (v.maxUsage > 0 && v.usedCount >= v.maxUsage) return { label: 'Habis', color: 'bg-orange-500/20 text-orange-400' }
    return { label: 'Aktif', color: 'bg-green-500/20 text-green-400' }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Manajemen</p>
          <h2 className="text-sm font-black uppercase text-foreground flex items-center gap-2">
            <TicketCheck className="w-4 h-4 text-sport-purple" /> Voucher & Promo
          </h2>
          <p className="text-[11px] text-brand-muted mt-0.5">
            Buat voucher kode atau auto-apply untuk Community, Bro &amp; Sist, Individu, dan Tenant UMKM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadVouchers} disabled={voucherLoading}>
            <RefreshCw className={`w-4 h-4 ${voucherLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Buat Voucher
          </Button>
        </div>
      </div>

      {/* Error / Success */}
      {voucherError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-semibold">
          {voucherError}
        </div>
      )}

      {voucherSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-400 font-semibold">
          {voucherSuccess}
        </div>
      )}

      {/* Search & page size */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Cari nama atau kode voucher…"
            className="w-full pl-9 pr-8 py-2 bg-card-bg border border-card-border rounded-lg text-xs text-foreground placeholder:text-brand-muted focus:outline-none focus:border-sport-purple"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-brand-muted hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          Tampilkan
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            className="bg-card-bg border border-card-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-sport-purple cursor-pointer"
          >
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-sport-purple/10 border border-sport-purple/30 rounded-lg">
          <span className="text-xs font-bold text-foreground">{selectedIds.size} voucher dipilih</span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => bulkSetEnabled(false)} disabled={voucherLoading}>
            <FileEdit className="w-3.5 h-3.5 mr-1" /> Jadikan Draft
          </Button>
          <Button variant="ghost" size="sm" onClick={() => bulkSetEnabled(true)} disabled={voucherLoading}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aktifkan
          </Button>
          <Button variant="ghost" size="sm" onClick={bulkDelete} disabled={voucherLoading}>
            <Trash2 className="w-3.5 h-3.5 mr-1 text-sport-red" /> <span className="text-sport-red">Hapus</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} disabled={voucherLoading}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Voucher List */}
      <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
        {voucherLoading && voucherList.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-xs">Memuat voucher…</div>
        ) : voucherList.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-xs">
            Belum ada voucher. Klik <strong>Buat Voucher</strong> untuk mulai.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-xs">
            Tidak ada voucher yang cocok dengan &quot;{search}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-foreground">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="pl-4 pr-1 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-3.5 h-3.5 accent-sport-purple cursor-pointer"
                      title="Pilih semua"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-brand-muted">Nama / Kode</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-brand-muted">Diskon</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-brand-muted">Paket</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-brand-muted">Penggunaan</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-brand-muted">Masa Berlaku</th>
                  <th className="px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest text-brand-muted">Status</th>
                  <th className="px-4 py-2.5 text-right text-[9px] font-black uppercase tracking-widest text-brand-muted">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {pagedList.map((v) => {
                  const status = getStatus(v)
                  return (
                    <tr key={v.id} className={`transition-colors ${selectedIds.has(v.id) ? 'bg-sport-purple/10' : 'hover:bg-brand-dark/20'}`}>
                      <td className="pl-4 pr-1 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(v.id)}
                          onChange={() => toggleSelect(v.id)}
                          className="w-3.5 h-3.5 accent-sport-purple cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground">{v.name}</div>
                        {v.type === 'code' ? (
                          <code className="text-[10px] bg-brand-dark/60 px-1.5 py-0.5 rounded text-sport-orange font-mono">{v.code}</code>
                        ) : (
                          <span className="text-[10px] text-brand-muted italic">Auto-apply</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-sport-orange">
                        {v.discountType === 'percent'
                          ? `${v.discountValue}%`
                          : `Rp ${v.discountValue.toLocaleString('id-ID')}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {v.packages.map((pkg) => (
                            <span key={pkg} className="text-[9px] px-1.5 py-0.5 rounded bg-sport-purple/20 text-sport-purple font-bold uppercase">
                              {pkg === 'community' ? 'Komunitas' : pkg === 'family' ? 'Bro & Sist' : pkg === 'individual' ? 'Individu' : pkg === 'invitation' ? 'Invitation' : pkg === 'umkm' ? 'Tenant UMKM' : pkg}
                            </span>
                          ))}
                        </div>
                        {v.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {v.categories.map((cat) => (
                              <span key={cat} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">
                                {cat.startsWith('3K') ? '3K' : cat.startsWith('6K') ? '6K' : cat}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        {v.usedCount} / {v.maxUsage === 0 ? '∞' : v.maxUsage}
                      </td>
                      <td className="px-4 py-3 text-brand-muted">
                        <div>{formatDate(v.validFrom)}</div>
                        <div className="text-[9px] text-brand-muted/60">s.d. {formatDate(v.validUntil)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleEnabled(v)}
                          className={`text-[9px] px-2 py-0.5 rounded font-bold cursor-pointer transition-opacity hover:opacity-80 ${status.color}`}
                        >
                          {status.label}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(v)}
                            className="p-1.5 text-brand-muted hover:text-sport-purple rounded transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(v)}
                            className="p-1.5 text-brand-muted hover:text-sport-red rounded transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-card-border">
              <span className="text-[10px] text-brand-muted font-bold uppercase tracking-wider">
                {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} dari {filtered.length} voucher
                {search && ` (difilter dari ${voucherList.length})`}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded text-brand-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-bold text-foreground px-2">Hal {currentPage} / {totalPages}</span>
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded text-brand-muted hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Create / Edit Dialog */}
      <Dialog
        isOpen={voucherDialogOpen}
        onClose={() => setVoucherDialogOpen(false)}
        title={voucherEditTarget ? 'Edit Voucher' : 'Buat Voucher Baru'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4 text-xs">
          {voucherError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-semibold text-xs">
              {voucherError}
            </div>
          )}
          {voucherSuccess && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 font-semibold text-xs">
              {voucherSuccess}
            </div>
          )}

          {/* Name */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-brand-muted">Nama Voucher <span className="text-sport-red">*</span></span>
            <input
              value={voucherForm.name}
              onChange={(e) => setVoucherForm({ ...voucherForm, name: e.target.value })}
              placeholder="Early Bird Agustus 2026"
              className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground focus:border-sport-purple/60 focus:outline-none"
            />
          </label>

          {/* Type */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-brand-muted">Tipe Voucher</span>
            <div className="flex gap-2">
              {(['code', 'auto'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setVoucherForm({ ...voucherForm, type: t })}
                  className={`flex-1 py-2 rounded-lg border font-bold text-xs cursor-pointer transition-all ${
                    voucherForm.type === t
                      ? 'bg-sport-purple text-white border-sport-purple'
                      : 'bg-transparent text-brand-muted border-card-border hover:border-sport-purple/40'
                  }`}
                >
                  {t === 'code' ? (
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <Key className="w-3.5 h-3.5" /> Kode
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 justify-center">
                      <Sparkles className="w-3.5 h-3.5" /> Auto-Apply
                    </span>
                  )}
                </button>
              ))}
            </div>
          </label>

          {/* Code (only for code type) */}
          {voucherForm.type === 'code' && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Kode Voucher <span className="text-sport-red">*</span></span>
              <input
                value={voucherForm.code}
                onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                placeholder="EARLYBIRD26"
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs font-mono text-sport-orange focus:border-sport-purple/60 focus:outline-none uppercase"
              />
            </label>
          )}

          {/* Discount Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Tipe Diskon</span>
              <select
                value={voucherForm.discountType}
                onChange={(e) => setVoucherForm({ ...voucherForm, discountType: e.target.value as 'percent' | 'flat' })}
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground focus:border-sport-purple/60 focus:outline-none"
              >
                <option value="percent">Persentase (%)</option>
                <option value="flat">Nominal (Rp)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">
                Nilai Diskon {voucherForm.discountType === 'percent' ? '(%)' : '(Rp)'}
              </span>
              <input
                type="number"
                min={0}
                max={voucherForm.discountType === 'percent' ? 100 : undefined}
                value={voucherForm.discountValue}
                onChange={(e) => setVoucherForm({ ...voucherForm, discountValue: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground focus:border-sport-purple/60 focus:outline-none"
              />
            </label>
          </div>

          {/* Max Usage */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-brand-muted">Kuota Maksimal (kosongkan = tak terbatas)</span>
            <input
              type="number"
              min={0}
              value={voucherForm.maxUsage ?? ''}
              onChange={(e) => setVoucherForm({ ...voucherForm, maxUsage: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="Tak terbatas"
              className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground focus:border-sport-purple/60 focus:outline-none"
            />
          </label>

          {/* Valid From / Until */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Berlaku Dari <span className="text-sport-red">*</span></span>
              <input
                type="datetime-local"
                value={voucherForm.validFrom}
                onChange={(e) => setVoucherForm({ ...voucherForm, validFrom: e.target.value })}
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground focus:border-sport-purple/60 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase text-brand-muted">Berlaku Hingga <span className="text-sport-red">*</span></span>
              <input
                type="datetime-local"
                value={voucherForm.validUntil}
                onChange={(e) => setVoucherForm({ ...voucherForm, validUntil: e.target.value })}
                className="w-full px-3 py-2 bg-brand-dark/40 border border-card-border rounded-lg text-xs text-foreground focus:border-sport-purple/60 focus:outline-none"
              />
            </label>
          </div>

          {/* Packages */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-brand-muted">Berlaku untuk Paket</span>
            <div className="flex flex-wrap gap-2">
              {ALL_PACKAGES.map((pkg) => (
                <button
                  key={pkg.key}
                  type="button"
                  onClick={() => togglePackage(pkg.key)}
                  className={`px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition-all ${
                    voucherForm.packageKeys.includes(pkg.key)
                      ? 'bg-sport-purple text-white border-sport-purple'
                      : 'bg-transparent text-brand-muted border-card-border hover:border-sport-purple/40'
                  }`}
                >
                  {pkg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase text-brand-muted">
              Kategori yang Berlaku (kosong = semua kategori)
            </span>
            <div className="flex flex-wrap gap-2">
              {categoryOptions.length === 0 ? (
                <p className="text-[10px] text-brand-muted italic">Pilih paket terlebih dahulu untuk memuat kategori yang tersedia.</p>
              ) : (
                categoryOptions.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg border font-bold text-xs cursor-pointer transition-all ${
                      voucherForm.allowedCategories.includes(cat)
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-transparent text-brand-muted border-card-border hover:border-amber-500/40'
                    }`}
                  >
                    {cat.startsWith('3K') ? `3K — ${cat}` : cat.startsWith('6K') ? `6K — ${cat}` : cat}
                  </button>
                ))
              )}
            </div>
            {voucherForm.allowedCategories.length === 0 && (
              <p className="text-[10px] text-brand-muted italic">Berlaku untuk semua kategori di paket yang dipilih.</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-card-border mt-2">
            <Button variant="ghost" size="sm" onClick={() => setVoucherDialogOpen(false)}>
              <X className="w-4 h-4 mr-1" /> Batal
            </Button>
            <Button variant="primary" size="sm" onClick={handleSubmit}>
              {voucherEditTarget ? 'Simpan Perubahan' : 'Buat Voucher'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
