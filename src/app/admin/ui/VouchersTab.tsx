'use client'

import { useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, TicketCheck, RefreshCw, X, Key, Sparkles } from 'lucide-react'
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
  packageKeys: ['community', 'family', 'individual', 'umkm'],
  allowedCategories: [],
}

const ALL_PACKAGES = [
  { key: 'community', label: 'Komunitas' },
  { key: 'family', label: 'Bro & Sist' },
  { key: 'individual', label: 'Individu' },
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
    if (!v.enabled) return { label: 'Nonaktif', color: 'bg-brand-muted/20 text-brand-muted' }
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

      {/* Voucher List */}
      <section className="bg-card-bg border border-card-border rounded-lg overflow-hidden">
        {voucherLoading && voucherList.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-xs">Memuat voucher…</div>
        ) : voucherList.length === 0 ? (
          <div className="p-8 text-center text-brand-muted text-xs">
            Belum ada voucher. Klik <strong>Buat Voucher</strong> untuk mulai.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-foreground">
              <thead>
                <tr className="border-b border-card-border">
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
                {voucherList.map((v) => {
                  const status = getStatus(v)
                  return (
                    <tr key={v.id} className="hover:bg-brand-dark/20 transition-colors">
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
                              {pkg === 'community' ? 'Komunitas' : pkg === 'family' ? 'Bro & Sist' : pkg === 'individual' ? 'Individu' : pkg === 'umkm' ? 'Tenant UMKM' : pkg}
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
