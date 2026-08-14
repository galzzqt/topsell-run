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
  const [autoVoucher, setAutoVoucher] = useState<AppliedVoucher | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const isDismissed = useRef(false)
  const prevCategory = useRef(category)
  const prevPkg = useRef(packageKey)
  const onApplyRef = useRef(onApply)
  const onRemoveRef = useRef(onRemove)
  const appliedRef = useRef<AppliedVoucher | null>(null)

  onApplyRef.current = onApply
  onRemoveRef.current = onRemove
  appliedRef.current = applied

  // ── Auto-apply & Re-validation: cek saat komponen mount & saat category/basePrice/packageKey berubah ──
  useEffect(() => {
    if (!category || !basePrice || basePrice <= 0) {
      setAutoVoucher(null)
      setApplied(null)
      setStatus('idle')
      return
    }

    let isMounted = true
    const isCategoryOrPkgChanged = prevCategory.current !== category || prevPkg.current !== packageKey

    if (isCategoryOrPkgChanged) {
      isDismissed.current = false
      prevCategory.current = category
      prevPkg.current = packageKey
    }

    const checkAndSyncVouchers = async () => {
      // 1. Selalu cek voucher auto untuk paket, kategori, dan basePrice saat ini
      let fetchedAutoVoucher: AppliedVoucher | null = null
      try {
        const autoUrl = `/api/voucher/validate?code=AUTO&pkg=${encodeURIComponent(packageKey)}&category=${encodeURIComponent(category)}&basePrice=${basePrice}`
        const autoRes = await fetch(autoUrl)
        const autoData: VoucherValidation = await autoRes.json()
        if (autoData.valid && autoData.finalDiscount > 0) {
          fetchedAutoVoucher = {
            code: 'AUTO',
            name: autoData.name || 'Voucher Auto',
            discountType: autoData.discountType!,
            discountValue: autoData.discountValue!,
            finalDiscount: autoData.finalDiscount,
          }
        }
      } catch {
        // Abaikan error fetch auto
      }

      if (!isMounted) return
      setAutoVoucher(fetchedAutoVoucher)

      const currApplied = appliedRef.current

      // 2. Jika ada voucher yang sedang aktif sebelumnya
      if (currApplied) {
        if (currApplied.code === 'AUTO') {
          if (fetchedAutoVoucher) {
            if (isDismissed.current) {
              setApplied(null)
              setStatus('idle')
              onRemoveRef.current()
            } else {
              setApplied(fetchedAutoVoucher)
              setStatus('valid')
              onApplyRef.current(fetchedAutoVoucher)
            }
          } else {
            setApplied(null)
            setStatus('idle')
            onRemoveRef.current()
          }
        } else {
          // Voucher kode manual yang sedang terpasang
          try {
            const manualUrl = `/api/voucher/validate?code=${encodeURIComponent(currApplied.code)}&pkg=${encodeURIComponent(packageKey)}&category=${encodeURIComponent(category)}&basePrice=${basePrice}`
            const manualRes = await fetch(manualUrl)
            const manualData: VoucherValidation = await manualRes.json()
            if (!isMounted) return

            if (manualData.valid) {
              const manualV: AppliedVoucher = {
                code: currApplied.code,
                name: manualData.name || currApplied.code,
                discountType: manualData.discountType!,
                discountValue: manualData.discountValue!,
                finalDiscount: manualData.finalDiscount,
              }
              setApplied(manualV)
              setStatus('valid')
              onApplyRef.current(manualV)
            } else {
              if (fetchedAutoVoucher && !isDismissed.current) {
                setApplied(fetchedAutoVoucher)
                setStatus('valid')
                onApplyRef.current(fetchedAutoVoucher)
              } else {
                setApplied(null)
                setStatus('idle')
                onRemoveRef.current()
              }
            }
          } catch {
            if (!isMounted) return
            setApplied(null)
            setStatus('idle')
            onRemoveRef.current()
          }
        }
      } else {
        // 3. Tidak ada voucher terpasang: pasang auto-voucher jika tersedia dan belum di-dismiss
        if (fetchedAutoVoucher && !isDismissed.current) {
          setApplied(fetchedAutoVoucher)
          setStatus('valid')
          onApplyRef.current(fetchedAutoVoucher)
        }
      }
    }

    checkAndSyncVouchers()

    return () => {
      isMounted = false
    }
  }, [category, basePrice, packageKey])

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
        isDismissed.current = false
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

  function handleApplyAuto(v: AppliedVoucher) {
    isDismissed.current = false
    setApplied(v)
    setStatus('valid')
    setErrorMsg('')
    onApplyRef.current(v)
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
    onApplyRef.current(v)
  }

  function handleRemove(isUserAction = true) {
    if (isUserAction) {
      isDismissed.current = true
    }
    setApplied(null)
    setCode('')
    setStatus('idle')
    setErrorMsg('')
    onRemoveRef.current()
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
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 shadow-sm">
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
            onClick={() => handleRemove(true)}
            className="shrink-0 text-green-500 hover:text-red-500 p-1 rounded-md hover:bg-green-100/60 transition-all cursor-pointer"
            title="Hapus voucher"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Voucher Auto yang tersedia (tampil jika voucher dilepas / belum terpasang) ── */}
      {status !== 'valid' && autoVoucher && (
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-white border border-sport-purple/20 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-md bg-sport-purple/10 flex items-center justify-center shrink-0">
              <Tag className="w-3.5 h-3.5 text-sport-purple" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider bg-violet-100 text-sport-purple px-1.5 py-0.5 rounded">Tersedia</span>
                <p className="text-xs font-black text-foreground truncate">{autoVoucher.name}</p>
              </div>
              <p className="text-[10px] text-brand-muted font-medium mt-0.5">
                {autoVoucher.discountType === 'percent'
                  ? `${autoVoucher.discountValue}% OFF`
                  : formatRp(autoVoucher.discountValue) + ' OFF'}{' '}
                &mdash; hemat {formatRp(autoVoucher.finalDiscount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleApplyAuto(autoVoucher)}
            className="px-3.5 py-1.5 rounded-lg bg-sport-purple text-white text-[10px] font-black uppercase tracking-wide hover:bg-sport-purple/90 active:scale-95 shadow-sm transition-all shrink-0 cursor-pointer"
          >
            Pakai
          </button>
        </div>
      )}

      {/* ── Input kode voucher manual ── */}
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
            placeholder={autoVoucher ? "Atau masukkan kode voucher lain" : "Masukkan kode voucher"}
            disabled={status === 'loading'}
            className="flex-1 px-3 py-2 text-xs font-mono font-bold tracking-widest uppercase rounded-lg border border-card-border bg-white text-foreground placeholder:text-brand-muted/60 focus:outline-none focus:border-sport-purple/60 disabled:opacity-50 transition-colors"
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || status === 'loading'}
            className="px-4 py-2 rounded-lg bg-sport-purple text-white text-[10px] font-black uppercase tracking-wide hover:bg-sport-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
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
