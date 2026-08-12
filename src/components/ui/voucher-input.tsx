'use client'

import { useEffect, useRef, useState } from 'react'
import { Tag, X, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import type { AppliedVoucher, VoucherPackageKey, VoucherValidation } from '@/lib/types/voucher'

interface VoucherInputProps {
  packageKey: VoucherPackageKey
  /** Harga dasar per peserta (atau total) sebelum diskon, dalam Rp. */
  basePrice: number
  /** Kategori yang dipilih user (mis. '6K 149.000'). */
  category: string
  /** Dipanggil saat voucher berhasil di-apply. */
  onApply: (voucher: AppliedVoucher) => void
  /** Dipanggil saat voucher dilepas. */
  onRemove: () => void
}

type Status = 'idle' | 'loading' | 'valid' | 'invalid'

function formatRp(amount: number) {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

export function VoucherInput({ packageKey, basePrice, category, onApply, onRemove }: VoucherInputProps) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [applied, setApplied] = useState<AppliedVoucher | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const autoChecked = useRef(false)

  // ── Auto-apply & Re-validation: cek saat komponen mount & saat category/basePrice berubah ──
  useEffect(() => {
    if (!category || !basePrice) return

    const revalidateCurrentVoucher = async (currApplied: AppliedVoucher) => {
      const codeToValidate = currApplied.code === 'AUTO' ? 'AUTO' : currApplied.code
      try {
        const url = `/api/voucher/validate?code=${encodeURIComponent(codeToValidate)}&pkg=${encodeURIComponent(packageKey)}&category=${encodeURIComponent(category)}&basePrice=${basePrice}`
        const res = await fetch(url)
        const data: VoucherValidation = await res.json()
        if (data.valid) {
          applyResult(codeToValidate, data)
        } else {
          handleRemove()
        }
      } catch {
        handleRemove()
      }
    }

    if (applied) {
      revalidateCurrentVoucher(applied)
    } else {
      autoChecked.current = false
      checkAutoVoucher()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, basePrice])

  async function checkAutoVoucher() {
    if (autoChecked.current) return
    autoChecked.current = true
    try {
      const url = `/api/voucher/validate?code=AUTO&pkg=${encodeURIComponent(packageKey)}&category=${encodeURIComponent(category)}&basePrice=${basePrice}`
      const res = await fetch(url)
      const data: VoucherValidation = await res.json()
      if (data.valid && data.finalDiscount > 0) {
        applyResult('AUTO', data)
      }
    } catch {
      // Diam — auto-apply gagal tidak perlu error ke user
    }
  }

  async function handleApply() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    if (!category) {
      setStatus('invalid')
      setErrorMsg('Pilih kategori terlebih dahulu sebelum memakai voucher.')
      return
    }
    setStatus('loading')
    setErrorMsg('')
    try {
      const url = `/api/voucher/validate?code=${encodeURIComponent(trimmed)}&pkg=${encodeURIComponent(packageKey)}&category=${encodeURIComponent(category)}&basePrice=${basePrice}`
      const res = await fetch(url)
      const data: VoucherValidation = await res.json()
      if (data.valid) {
        applyResult(trimmed, data)
      } else {
        setStatus('invalid')
        setErrorMsg(data.error || 'Kode voucher tidak valid.')
      }
    } catch {
      setStatus('invalid')
      setErrorMsg('Gagal menghubungi server. Coba lagi.')
    }
  }

  function applyResult(usedCode: string, data: VoucherValidation) {
    const v: AppliedVoucher = {
      code: usedCode,
      name: data.name || usedCode,
      discountType: data.discountType!,
      discountValue: data.discountValue!,
      finalDiscount: data.finalDiscount,
    }
    setApplied(v)
    setStatus('valid')
    onApply(v)
  }

  function handleRemove() {
    setApplied(null)
    setCode('')
    setStatus('idle')
    setErrorMsg('')
    autoChecked.current = false
    onRemove()
    // Re-check auto-apply after manual removal
    setTimeout(() => checkAutoVoucher(), 0)
  }

  const discountLabel =
    applied?.discountType === 'percent'
      ? `${applied.discountValue}% OFF`
      : formatRp(applied?.discountValue ?? 0) + ' OFF'

  return (
    <div className="rounded-xl border border-dashed border-sport-purple/30 bg-violet-50/30 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-sport-purple shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-sport-purple">Kode Promo / Voucher</span>
      </div>

      {/* ── Voucher sudah di-apply ── */}
      {status === 'valid' && applied && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black text-green-700 truncate">{applied.name}</p>
              <p className="text-[10px] text-green-600 font-medium">
                {discountLabel} &mdash; hemat {formatRp(applied.finalDiscount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 text-green-400 hover:text-red-400 transition-colors"
            title="Hapus voucher"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Input kode (tersembunyi jika sudah ada auto-apply) ── */}
      {status !== 'valid' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              if (status === 'invalid') { setStatus('idle'); setErrorMsg('') }
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleApply())}
            placeholder="Masukkan kode voucher"
            disabled={status === 'loading'}
            className="flex-1 px-3 py-2 text-xs font-mono font-bold tracking-widest uppercase rounded-lg border border-card-border bg-white text-foreground placeholder:text-brand-muted/60 focus:outline-none focus:border-sport-purple/60 disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || status === 'loading'}
            className="px-4 py-2 rounded-lg bg-sport-purple text-white text-[10px] font-black uppercase tracking-wide hover:bg-sport-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0"
          >
            {status === 'loading' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              'Pakai'
            )}
          </button>
        </div>
      )}

      {/* ── Error message ── */}
      {status === 'invalid' && errorMsg && (
        <div className="flex items-start gap-1.5 text-[10px] text-red-500 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
