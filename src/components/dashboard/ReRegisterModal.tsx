'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Trophy, AlertCircle, Info, RefreshCw, X } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { VoucherInput } from '@/components/ui/voucher-input'
import { usePackagesSettings, resolveCategoryLabel } from '@/lib/hooks/usePackagesSettings'
import type { AppliedVoucher, VoucherPackageKey } from '@/lib/types/voucher'
import {
  reRegisterIndividualAction,
  reRegisterFamilyAction,
  reRegisterCommunityAction,
} from '@/app/actions/re-registration'

type ParticipantFormState = {
  full_name: string
  bib_name: string
  ktp_number: string
  email: string
  phone: string
  date_of_birth: string
  gender: 'male' | 'female'
  tshirt_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL'
  blood_type: 'A' | 'B' | 'AB' | 'O'
  medical_condition: string
  emergency_contact_name: string
  emergency_contact_phone: string
}

const emptyParticipant = (defaultName = '', defaultEmail = '', defaultPhone = ''): ParticipantFormState => ({
  full_name: defaultName,
  bib_name: defaultName ? defaultName.slice(0, 15) : '',
  ktp_number: '',
  email: defaultEmail,
  phone: defaultPhone,
  date_of_birth: '',
  gender: 'male',
  tshirt_size: 'M',
  blood_type: 'O',
  medical_condition: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
})

interface ReRegisterModalProps {
  isOpen: boolean
  onClose: () => void
  packageKey: 'individual' | 'family' | 'community'
  userProfile: {
    name?: string | null
    leader_name?: string | null
    phone?: string | null
    email?: string | null
    category?: string | null
  } | null
  existingParticipants?: Array<{ payment_status: string; period_key?: string | null }>
  onSuccess: () => void
}

export function ReRegisterModal({
  isOpen,
  onClose,
  packageKey,
  userProfile,
  existingParticipants = [],
  onSuccess,
}: ReRegisterModalProps) {
  const packages = usePackagesSettings()
  const pkgConfig = packages?.[packageKey]

  // Collect category options for this package
  const categoryOptions = (() => {
    const cats: Array<{ value: string; label: string; price: number }> = []
    if (pkgConfig?.periods) {
      pkgConfig.periods.forEach((period) => {
        if (period.categories) {
          period.categories.forEach((cat) => {
            if (!cats.some((c) => c.value === cat.value)) {
              cats.push(cat)
            }
          })
        }
      })
    }
    return cats
  })()

  const [selectedCategory, setSelectedCategory] = useState('')
  const [participants, setParticipants] = useState<ParticipantFormState[]>([])
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize selectedCategory & participants when opened
  useEffect(() => {
    if (!isOpen) return
    const defaultCat = userProfile?.category || categoryOptions[0]?.value || ''
    setSelectedCategory(defaultCat)
    setErrorMsg('')
    setAppliedVoucher(null)
    setAgreeTerms(false)

    const name = userProfile?.leader_name || userProfile?.name || ''
    const email = userProfile?.email || ''
    const phone = userProfile?.phone || ''

    if (packageKey === 'individual') {
      setParticipants([emptyParticipant(name, email, phone)])
    } else {
      setParticipants([
        emptyParticipant(name, email, phone),
        emptyParticipant(),
        emptyParticipant(),
      ])
    }
  }, [isOpen, packageKey, userProfile])

  const selectedCategoryObj = categoryOptions.find((c) => c.value === selectedCategory)
  const unitPrice = selectedCategoryObj?.price || 0
  const basePrice = participants.length * unitPrice
  const discountAmount = appliedVoucher?.finalDiscount || 0
  const totalAmount = Math.max(0, basePrice - discountAmount)

  // Check if user already has a PAID registration for the selected category/period
  const isPaidForSelectedPeriod = (() => {
    if (!existingParticipants || existingParticipants.length === 0) return false
    return existingParticipants.some((p) => p.payment_status === 'paid')
  })()

  const handleUpdateParticipant = (index: number, field: keyof ParticipantFormState, value: string) => {
    setParticipants((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleAddParticipant = () => {
    setParticipants((prev) => [...prev, emptyParticipant()])
  }

  const handleRemoveParticipant = (index: number) => {
    if (packageKey !== 'individual' && participants.length <= 3) {
      alert('Minimal 3 peserta untuk paket ini.')
      return
    }
    if (packageKey === 'individual' && participants.length <= 1) return
    setParticipants((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCategory) {
      setErrorMsg('Pilih kategori lomba terlebih dahulu.')
      return
    }
    if (!agreeTerms) {
      setErrorMsg('Anda harus menyetujui Syarat & Ketentuan pendaftaran.')
      return
    }
    setErrorMsg('')
    setIsSubmitting(true)

    try {
      if (packageKey === 'individual') {
        const res = await reRegisterIndividualAction({
          category: selectedCategory,
          participant: participants[0],
          voucherCode: appliedVoucher?.code === 'AUTO' ? undefined : appliedVoucher?.code,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
      } else if (packageKey === 'family') {
        const res = await reRegisterFamilyAction({
          category: selectedCategory,
          participants,
          voucherCode: appliedVoucher?.code === 'AUTO' ? undefined : appliedVoucher?.code,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
      } else {
        const res = await reRegisterCommunityAction({
          category: selectedCategory,
          participants,
          voucherCode: appliedVoucher?.code === 'AUTO' ? undefined : appliedVoucher?.code,
        })
        if (res.error) {
          setErrorMsg(res.error)
          return
        }
      }

      onSuccess()
      onClose()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const packageTitle =
    packageKey === 'individual' ? 'Individu' : packageKey === 'family' ? 'Bro & Sist' : 'Komunitas'

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={`Daftar Kembali — Paket ${packageTitle}`} className="max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
        {/* LOGGED IN ACCOUNT BANNER (No need to ask Phone/Email/Password!) */}
        <div className="p-3.5 bg-sport-purple/10 border border-sport-purple/20 rounded-xl flex items-start gap-3">
          <Info className="w-4 h-4 text-sport-purple shrink-0 mt-0.5" />
          <div className="text-[11px] text-foreground">
            <p className="font-bold text-sport-purple">Terhubung dengan Akun Anda</p>
            <p className="text-brand-muted">
              Pendaftaran ini akan otomatis dihubungkan ke akun <strong>{userProfile?.name || userProfile?.leader_name || 'Anda'}</strong> ({userProfile?.phone || '-'}). Data kontak &amp; alamat akun digunakan secara otomatis tanpa perlu diisi ulang.
            </p>
          </div>
        </div>

        {isPaidForSelectedPeriod && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 font-bold flex items-start gap-2.5 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-black uppercase">Pendaftaran Periode Ini Sudah Lunas</p>
              <p className="text-[11px] text-amber-400/90 font-normal mt-0.5">
                Anda telah menyelesaikan pembayaran (LUNAS) untuk periode ini. Pendaftaran ulang di periode yang sama tidak diperbolehkan. Silakan daftar kembali jika ada periode baru.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* CATEGORY SELECTOR */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-brand-muted">
            Pilih Kategori Lomba <span className="text-sport-red">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {categoryOptions.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`p-3 rounded-xl border font-bold text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedCategory === cat.value
                    ? 'bg-sport-orange/15 border-sport-orange text-foreground'
                    : 'bg-brand-gray/40 border-card-border text-brand-muted hover:border-sport-orange/40'
                }`}
              >
                <div>
                  <p className="text-xs font-black uppercase">{cat.label || cat.value}</p>
                  <p className="text-[10px] text-sport-orange">Rp {cat.price.toLocaleString('id-ID')} / peserta</p>
                </div>
                {selectedCategory === cat.value && (
                  <span className="w-2.5 h-2.5 rounded-full bg-sport-orange shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* PARTICIPANT FORMS */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-wider text-brand-muted">
              Data Peserta ({participants.length} Peserta)
            </label>
            {packageKey !== 'individual' && (
              <Button type="button" variant="ghost" size="sm" onClick={handleAddParticipant} className="text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Tambah Peserta
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-1">
            {participants.map((p, idx) => (
              <div key={idx} className="p-3.5 bg-brand-dark/40 border border-card-border rounded-xl flex flex-col gap-3 relative">
                <div className="flex items-center justify-between border-b border-card-border/60 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-sport-orange">
                    Peserta #{idx + 1}
                  </span>
                  {packageKey !== 'individual' && participants.length > 3 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveParticipant(idx)}
                      className="text-brand-muted hover:text-sport-red transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Nama Lengkap *</span>
                    <input
                      required
                      value={p.full_name}
                      onChange={(e) => handleUpdateParticipant(idx, 'full_name', e.target.value)}
                      placeholder="Nama sesuai KTP"
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Nama BIB *</span>
                    <input
                      required
                      maxLength={20}
                      value={p.bib_name}
                      onChange={(e) => handleUpdateParticipant(idx, 'bib_name', e.target.value)}
                      placeholder="Nama di BIB (maks 20 Karakter)"
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">NIK / No. KTP (16 Digit) *</span>
                    <input
                      required
                      maxLength={16}
                      value={p.ktp_number}
                      onChange={(e) => handleUpdateParticipant(idx, 'ktp_number', e.target.value.replace(/\D/g, ''))}
                      placeholder="3517xxxxxxxxxxxx"
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-sport-orange"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Email Peserta *</span>
                    <input
                      type="email"
                      required
                      value={p.email}
                      onChange={(e) => handleUpdateParticipant(idx, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">No. HP / WhatsApp *</span>
                    <input
                      required
                      value={p.phone}
                      onChange={(e) => handleUpdateParticipant(idx, 'phone', e.target.value)}
                      placeholder="08xxxxxxxxxx"
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-sport-orange"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Tanggal Lahir *</span>
                    <input
                      type="date"
                      required
                      value={p.date_of_birth}
                      onChange={(e) => handleUpdateParticipant(idx, 'date_of_birth', e.target.value)}
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Gender *</span>
                    <select
                      value={p.gender}
                      onChange={(e) => handleUpdateParticipant(idx, 'gender', e.target.value as 'male' | 'female')}
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    >
                      <option value="male">Laki-Laki (Male)</option>
                      <option value="female">Perempuan (Female)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Ukuran Jersey *</span>
                    <select
                      value={p.tshirt_size}
                      onChange={(e) => handleUpdateParticipant(idx, 'tshirt_size', e.target.value as any)}
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    >
                      <option value="XS">XS</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                      <option value="XXL">XXL</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-brand-muted font-bold">Golongan Darah *</span>
                    <select
                      value={p.blood_type}
                      onChange={(e) => handleUpdateParticipant(idx, 'blood_type', e.target.value as any)}
                      className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                      <option value="O">O</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-[10px] text-brand-muted font-bold">Kontak Darurat (Nama &amp; No. HP) *</span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        required
                        value={p.emergency_contact_name}
                        onChange={(e) => handleUpdateParticipant(idx, 'emergency_contact_name', e.target.value)}
                        placeholder="Nama Kontak Darurat"
                        className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                      />
                      <input
                        required
                        value={p.emergency_contact_phone}
                        onChange={(e) => handleUpdateParticipant(idx, 'emergency_contact_phone', e.target.value)}
                        placeholder="No. HP Kontak Darurat"
                        className="px-3 py-1.5 bg-brand-gray/50 border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-sport-orange"
                      />
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* VOUCHER INPUT */}
        {selectedCategory && basePrice > 0 && (
          <div className="mt-2">
            <VoucherInput
              packageKey={packageKey as VoucherPackageKey}
              basePrice={basePrice}
              category={selectedCategory}
              onApply={(v) => setAppliedVoucher(v)}
              onRemove={() => setAppliedVoucher(null)}
            />
          </div>
        )}

        {/* RINGKASAN BIAYA */}
        {basePrice > 0 && (
          <div className="p-3.5 rounded-xl border border-card-border bg-brand-dark/40 flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-brand-muted">Ringkasan Biaya</p>
            <div className="flex justify-between text-xs text-brand-muted">
              <span>Biaya Pendaftaran ({participants.length} Peserta)</span>
              <span className="font-bold">Rp {basePrice.toLocaleString('id-ID')}</span>
            </div>
            {appliedVoucher && appliedVoucher.finalDiscount > 0 && (
              <div className="flex justify-between text-xs text-green-400 font-bold">
                <span>Diskon Voucher ({appliedVoucher.name})</span>
                <span>- Rp {appliedVoucher.finalDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="border-t border-card-border my-1" />
            <div className="flex justify-between text-sm font-black uppercase text-foreground">
              <span>Total Pembayaran</span>
              <span className="text-sport-orange">Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        {/* S&K AGREEMENT */}
        <label className="flex items-start gap-2 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-card-border text-sport-purple focus:ring-sport-purple/30"
          />
          <span className="text-[10px] text-brand-muted leading-relaxed font-medium">
            Saya menyetujui seluruh Syarat &amp; Ketentuan event TOPSELL RUN 2026 dan menyatakan bahwa data peserta yang diisikan sudah benar.
          </span>
        </label>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end gap-2 pt-2 border-t border-card-border mt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting}>
            <X className="w-4 h-4 mr-1" /> Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={!agreeTerms || !selectedCategory || isPaidForSelectedPeriod}
          >
            <Trophy className="w-4 h-4 mr-1.5" /> Daftar Sekarang
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
