'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Users, Trophy, CheckCircle, Calendar, MapPin,
  Timer, ArrowRight, UserPlus, Plus, Trash2, Mail,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { registerFamilySchema, RegisterFamilyFormValues } from '@/lib/validations/auth'
import { signUpFamily } from '@/app/actions/family-auth'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { DEFAULT_REGISTRATION_FORM_SETTINGS, type RegistrationFormSettings } from '@/lib/admin/settings-schema'
import { usePackagesSettings } from '@/lib/hooks/usePackagesSettings'
import { addFamilyParticipantsAction, addCommunityParticipantsAction, type AddParticipantsValues } from '@/app/actions/add-participants'
import { EventCountdown, SiteShell, useActiveSession } from '@/components/landing/shell'
import { trackMetaPixelPurchase } from '@/lib/utils/meta-pixel'
import { TOPSELL_RUN_EVENT } from '@/lib/types'
import { VoucherInput } from '@/components/ui/voucher-input'
import type { AppliedVoucher } from '@/lib/types/voucher'

const defaultParticipant = {
  full_name: '',
  bib_name: '',
  ktp_number: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: 'male' as const,
  tshirt_size: 'M' as const,
  blood_type: 'A' as const,
  medical_condition: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
}

export default function BroAndSistForm() {
  const router = useRouter()
  const [isSuccess, setIsSuccess] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState<string>('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [formSettings, setFormSettings] = useState<RegistrationFormSettings>(DEFAULT_REGISTRATION_FORM_SETTINGS)
  const packagesSettings = usePackagesSettings()
  const [activeSession, setActiveSession] = useActiveSession()
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)

  // Location states
  const [provinsiList, setProvinsiList] = useState<Array<{ value: string; label: string }>>([])
  const [kotaList, setKotaList] = useState<Array<{ value: string; label: string }>>([])
  const [kecamatanList, setKecamatanList] = useState<Array<{ value: string; label: string }>>([])
  const [loadingProvinsi, setLoadingProvinsi] = useState(false)
  const [loadingKota, setLoadingKota] = useState(false)
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFamilyFormValues>({
    resolver: zodResolver(registerFamilySchema),
    defaultValues: {
      name: '',
      leader_name: '',
      phone: '',
      email: '',
      category: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000',
      provinsi: '',
      kota: '',
      kecamatan: '',
      password: '',
      confirmPassword: '',
      participants: Array.from({ length: 3 }, () => ({ ...defaultParticipant })),
      agreement_safety: false,
      agreement_data: false,
      agreement_refund: false,
    },
  })

  const selectedProvinsi = useWatch({ control, name: 'provinsi' })
  const selectedKota = useWatch({ control, name: 'kota' })
  const selectedCategory = useWatch({ control, name: 'category' })

  // Calculate base price from packagesSettings categories
  const allCategories = packagesSettings?.family?.periods?.flatMap((p: {categories: {value: string; price: number}[]}) => p.categories) || []
  const basePrice = allCategories.find((c: {value: string; price: number}) => c.value === selectedCategory)?.price || 0

  const familyFallbacks = {
    name: 'Bro & Sist Topsell',
    leader_name: 'Perwakilan Bro & Sist',
    phone: '081234567890',
    email: 'presentasi@topsell-run.com',
    category: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000',
    provinsi: '-',
    kota: '-',
    kecamatan: '-',
    password: 'topsell123',
    confirmPassword: 'topsell123',
  } as const
  const participantFallbacks = (index: number) => ({
    full_name: `Peserta ${index + 1}`,
    bib_name: `PESERTA${index + 1}`,
    ktp_number: '0000000000000000',
    email: `peserta${index + 1}@gmail.com`,
    phone: `08123456${String(1000 + index).slice(-4)}`,
    date_of_birth: '2000-01-01',
    gender: 'male',
    tshirt_size: 'M',
    blood_type: 'A',
    medical_condition: '',
    emergency_contact_name: 'Kontak Darurat',
    emergency_contact_phone: `08198765${String(1000 + index).slice(-4)}`,
  }) as const

  // Load provinces on mount
  useEffect(() => {
    fetch('/api/settings/registration-form')
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => {
        if (settings) setFormSettings(settings)
      })
      .catch(() => undefined)

    const loadProvinsi = async () => {
      setLoadingProvinsi(true)
      try {
        const data = await fetchProvinsi()
        setProvinsiList(data)
      } catch (error) {
        console.error('Error loading provinsi:', error)
      } finally {
        setLoadingProvinsi(false)
      }
    }
    loadProvinsi()
  }, [])

  // Load kota when provinsi changes
  useEffect(() => {
    const loadKota = async () => {
      if (!selectedProvinsi) {
        setKotaList([])
        setKecamatanList([])
        setValue('kota', '')
        setValue('kecamatan', '')
        return
      }

      setLoadingKota(true)
      try {
        const data = await fetchKota(selectedProvinsi)
        setKotaList(data)
        setKecamatanList([])
        setValue('kota', '')
        setValue('kecamatan', '')
      } catch (error) {
        console.error('Error loading kota:', error)
      } finally {
        setLoadingKota(false)
      }
    }

    loadKota()
  }, [selectedProvinsi, setValue])

  // Load kecamatan when kota changes
  useEffect(() => {
    const loadKecamatan = async () => {
      if (!selectedKota) {
        setKecamatanList([])
        setValue('kecamatan', '')
        return
      }

      setLoadingKecamatan(true)
      try {
        const data = await fetchKecamatan(selectedKota)
        setKecamatanList(data)
        setValue('kecamatan', '')
      } catch (error) {
        console.error('Error loading kecamatan:', error)
      } finally {
        setLoadingKecamatan(false)
      }
    }

    loadKecamatan()
  }, [selectedKota, setValue])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'participants',
  })

  // ——— STATE ———
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState<number | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addFields, setAddFields] = useState([{ ...defaultParticipant }, { ...defaultParticipant }, { ...defaultParticipant }])

  const onSubmit = async (values: RegisterFamilyFormValues) => {
    setAuthError(null)
    const provinsiName = provinsiList.find((p) => p.value === values.provinsi)?.label || values.provinsi
    const kotaName = kotaList.find((k) => k.value === values.kota)?.label || values.kota
    const kecamatanName = kecamatanList.find((k) => k.value === values.kecamatan)?.label || values.kecamatan

    const result = await signUpFamily({
      ...values,
      provinsi: provinsiName,
      kota: kotaName,
      kecamatan: kecamatanName,
    }, 'family', appliedVoucher?.code)
    if (result.error) {
      setAuthError(result.error)
    } else {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#ef4444', '#f97316', '#ffffff'],
      })
      // Track Meta Pixel Purchase event
      await trackMetaPixelPurchase(
        values.participants.length * TOPSELL_RUN_EVENT.price_per_participant,
        'IDR',
        {
          content_ids: [values.email],
          content_type: 'product',
          num_items: values.participants.length
        }
      )
      // Store email and show success modal
      setRegisteredEmail(values.email)
      setIsSuccess(true)
    }
  }

  const onAddParticipantsSubmit = async () => {
    setAddError(null)
    setAddLoading(true)
    try {
      const values: AddParticipantsValues = { participants: addFields }
      const result = activeSession?.type === 'family'
        ? await addFamilyParticipantsAction(values)
        : await addCommunityParticipantsAction(values)
      if (result.error) {
        setAddError(result.error)
      } else {
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#7c3aed', '#ef4444', '#f97316', '#ffffff'] })
        setAddSuccess(result.count ?? addFields.length)
      }
    } finally {
      setAddLoading(false)
    }
  }

  const handleScrollToRegister = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const element = document.getElementById('register-section')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <SiteShell session={activeSession} onLogout={() => setActiveSession(null)}>
      {/* Email Verification Success Modal */}
      <Dialog
        isOpen={isSuccess}
        onClose={() => {
          setIsSuccess(false)
          router.push('/login')
        }}
        title="✅ REGISTRASI BERHASIL"
      >
        <div className="flex flex-col items-center text-center gap-6">
          {/* Success Icon */}
          <div className="p-5 bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 rounded-full shadow-xl animate-pulse">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          {/* Main Message */}
          <div>
            <h3 className="text-2xl font-black uppercase text-slate-900 mb-2">
              Bro & Sist Package Terdaftar!
            </h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              Akun Anda telah berhasil dibuat dengan email:
            </p>
            <p className="text-sm font-bold text-sport-purple mt-2 break-all">
              {registeredEmail}
            </p>
          </div>

          {/* Email Verification Notice */}
          <div className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-5 text-left shadow-md">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                <Mail className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900 mb-3 uppercase tracking-wide">
                  📧 Aktivasi Email Diperlukan
                </p>
                <p className="text-xs text-amber-800 leading-relaxed mb-2">
                  Kami telah mengirim <strong>link aktivasi</strong> ke email Anda. 
                </p>
                <p className="text-xs text-amber-800 leading-relaxed mb-3">
                  Silakan buka email dan <strong>klik link untuk mengaktifkan akun</strong> sebelum login ke dashboard.
                </p>
                <div className="flex items-center gap-2 bg-amber-100 rounded-lg px-3 py-2">
                  <Timer className="w-4 h-4 text-amber-700" />
                  <p className="text-xs text-amber-700 font-semibold">
                    Link aktivasi berlaku selama 24 jam
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-3 mt-2">
            <Button
              onClick={() => {
                setIsSuccess(false)
                router.push('/login')
              }}
              variant="primary"
              className="w-full py-4 text-sm font-black shadow-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Login Setelah Aktivasi
            </Button>
            
            <p className="text-xs text-center text-brand-muted leading-relaxed px-4">
              Tidak menerima email? <strong>Cek folder spam</strong> atau minta kirim ulang dari halaman login.
            </p>
            <p className="text-xs text-center text-brand-muted leading-relaxed px-4 mt-0.5">
              Mengalami kesulitan? Hubungi kami via{' '}
              <a
                href="https://wa.me/6282119227871?text=Halo%20Admin%20Topsell%20Run%2C%20saya%20mengalami%20kesulitan%20aktivasi%20email%20pendaftaran%20Bro%20%26%20Sist%20Package."
                target="_blank"
                rel="noopener noreferrer"
                className="text-sport-orange hover:text-sport-red font-bold transition-colors hover:underline"
              >
                WhatsApp CS (0858-9259-9688)
              </a>
            </p>
          </div>
        </div>
      </Dialog>

      {/* ——— HERO ——— */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-16 pb-12 overflow-hidden z-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Event badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-card-border rounded-full backdrop-blur-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Pendaftaran Bro & Sist Package Dibuka</span>
          </div>

          {/* Main title */}
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <h1 className="sr-only">TOPSELL x Samsung Run For Changes 2026</h1>
            <p className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-none text-slate-900">
              TOPSELL x Samsung
            </p>
            <Image
              src="/images/hero.png"
              alt="Run For Changes 2026"
              width={492}
              height={216}
              className="w-full max-w-[280px] sm:max-w-[456px] h-auto object-contain"
              priority
            />
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-card-border shadow-sm text-brand-muted">
              <span className="text-sm font-black uppercase tracking-widest">Supported by</span>
              <Image
                src="/images/mandiri.png"
                alt="Mandiri"
                width={160}
                height={45}
                className="h-9 sm:h-11 w-auto object-contain"
              />
            </div>
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-brand-muted">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-sport-orange" />18 Oktober 2026</span>
            <span className="text-brand-muted/30">|</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sport-orange" />Sunrise Mall, Kota Mojokerto</span>
            <span className="text-brand-muted/30">|</span>
            <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-sport-orange" />Kategori 6K</span>
          </div>

          {/* Countdown */}
          <EventCountdown />

          {/* CTA Link */}
          <a
            href="#register-section"
            onClick={handleScrollToRegister}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-xs font-black text-white uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-sport-purple/20 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
          >
            Daftar Bro & Sist Package <ArrowRight className="w-4 h-4" />
          </a>

          <p className="text-[10px] text-brand-muted font-bold uppercase tracking-wider mt-1">
            Rp 135.000 / peserta • Pembayaran Kolektif • QR Race Pass Resmi
          </p>
        </div>
      </section>

      {/* ——— FORM SECTION ——— */}
      <section id="register-section" className="px-4 py-8 z-10 relative max-w-3xl mx-auto scroll-mt-20">
        {/* ——— LOGGED-IN: Add participants form ——— */}
        {activeSession ? (
          addSuccess !== null ? (
            <div className="bg-white border border-card-border rounded-2xl p-8 flex flex-col items-center text-center gap-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-sport-purple via-sport-red to-sport-orange" />
              <div className="p-4 bg-green-50 border border-green-200 rounded-full text-green-500">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-sport-orange mb-1">Berhasil!</p>
                <h2 className="text-xl font-black uppercase text-slate-900">{addSuccess} Anggota Ditambahkan</h2>
                <p className="text-xs text-brand-muted mt-2 leading-relaxed">
                  Anggota baru telah ditambahkan ke akun Anda. Lanjutkan ke dashboard untuk melakukan pembayaran.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  type="button"
                  onClick={() => { setAddSuccess(null); setAddFields([{ ...defaultParticipant }, { ...defaultParticipant }, { ...defaultParticipant }]) }}
                  className="flex-1 py-3 border border-card-border rounded-xl text-xs font-black text-brand-muted hover:text-foreground transition-colors"
                >
                  Tambah Lagi
                </button>
                <a
                  href={activeSession.dashboardUrl}
                  className="flex-1 py-3 rounded-xl text-xs font-black text-white text-center transition-all shadow-md"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                >
                  Ke Dashboard →
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-sport-purple via-sport-red to-sport-orange" />
              <div className="flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-1.5 mb-2">
                  <div className="p-3 rounded-xl mb-1 bg-linear-to-br from-sport-purple via-sport-red to-sport-orange">
                    <UserPlus className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-black uppercase text-slate-900">Tambah Anggota</h2>
                  <p className="text-xs text-brand-muted font-medium">
                    Masuk sebagai <span className="font-bold text-sport-purple">{activeSession.name}</span> · Daftarkan anggota baru ke {activeSession.type === 'family' ? 'grup Bro & Sist' : 'komunitas'} Anda
                  </p>
                </div>

                {/* Info strip */}
                <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                  <Users className="w-4 h-4 text-sport-purple shrink-0 mt-0.5" />
                  <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
                    <span className="text-slate-900 font-bold">Anda sudah login.</span> Tambahkan anggota baru, lalu lakukan checkout di dashboard untuk mendapatkan QR Race Pass resmi.
                  </p>
                </div>

                {addError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
                    {addError}
                  </div>
                )}

                {/* Participants list */}
                <div className="flex flex-col gap-4">
                  {addFields.map((field, index) => (
                    <div key={index} className="p-4 border border-card-border rounded-xl bg-slate-50/50 flex flex-col gap-4">
                      <div className="flex justify-between items-center pb-2 border-b border-card-border/50">
                        <span className="text-[10px] font-black uppercase text-sport-purple tracking-wider">Peserta #{index + 1}</span>
                        {addFields.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setAddFields((f) => f.filter((_, i) => i !== index))}
                            className="inline-flex items-center gap-0.5 text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-0.5" /> Hapus
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {[
                          { label: 'Nama Lengkap', key: 'full_name', placeholder: 'Nama sesuai KTP' },
                          { label: 'Nama BIB', key: 'bib_name', placeholder: 'Maks 20 huruf' },
                          { label: 'Email', key: 'email', placeholder: 'email@domain.com' },
                          { label: 'No. WhatsApp', key: 'phone', placeholder: '08xxxxxxxxxx' },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key} className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-brand-muted">{label}</label>
                            <input
                              type="text"
                              placeholder={placeholder}
                              value={(field as Record<string, string>)[key] || ''}
                              onChange={(e) => setAddFields((f) => f.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))}
                              className="border border-card-border rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sport-purple/30 focus:border-sport-purple/50 bg-white"
                            />
                          </div>
                        ))}
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-brand-muted">Tgl. Lahir</label>
                          <DateInput
                            value={(field as Record<string, string>)['date_of_birth'] || ''}
                            onChange={(value) => setAddFields((f) => f.map((item, i) => i === index ? { ...item, date_of_birth: value } : item))}
                            className="border border-card-border rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sport-purple/30 focus:border-sport-purple/50 bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {([
                          { label: 'Gender', key: 'gender', options: [{ value: 'male', label: 'Laki-laki' }, { value: 'female', label: 'Perempuan' }] },
                          { label: 'Ukuran Jersey', key: 'tshirt_size', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((v) => ({ value: v, label: v })) },
                          { label: 'Gol. Darah', key: 'blood_type', options: ['A', 'B', 'AB', 'O'].map((v) => ({ value: v, label: v })) },
                        ] as const).map(({ label, key, options }) => (
                          <div key={key} className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-brand-muted">{label}</label>
                            <select
                              value={(field as Record<string, string>)[key] || ''}
                              onChange={(e) => setAddFields((f) => f.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))}
                              className="border border-card-border rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sport-purple/30 bg-white"
                            >
                              {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            {key === 'tshirt_size' && (
                              <button
                                type="button"
                                onClick={() => setIsSizeChartOpen(true)}
                                className="text-[9px] text-sport-purple hover:text-sport-purple/80 font-semibold hover:underline text-left cursor-pointer"
                              >
                                Lihat Size Chart
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: 'Nama Kontak Darurat', key: 'emergency_contact_name', placeholder: 'Nama lengkap' },
                          { label: 'No. Kontak Darurat', key: 'emergency_contact_phone', placeholder: '08xxxxxxxxxx' },
                        ].map(({ label, key, placeholder }) => (
                          <div key={key} className="flex flex-col gap-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-brand-muted">{label}</label>
                            <input
                              type="text"
                              placeholder={placeholder}
                              value={(field as Record<string, string>)[key] || ''}
                              onChange={(e) => setAddFields((f) => f.map((item, i) => i === index ? { ...item, [key]: e.target.value } : item))}
                              className="border border-card-border rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sport-purple/30 focus:border-sport-purple/50 bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setAddFields((f) => [...f, { ...defaultParticipant }])}
                  className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-sport-purple/10 border border-sport-purple/20 text-sport-purple hover:bg-sport-purple/20 transition-all rounded-lg text-xs font-black uppercase cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Peserta
                </button>

                <Button
                  type="button"
                  variant="primary"
                  className="w-full py-4 text-xs font-black mt-2 shadow-md shadow-sport-purple/10"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                  isLoading={addLoading}
                  onClick={onAddParticipantsSubmit}
                >
                  <Trophy className="w-4 h-4 mr-2" />Simpan & Daftarkan Anggota
                </Button>

                <p className="text-xs text-center text-brand-muted">
                  Ingin ke dashboard?{' '}
                  <a href={activeSession.dashboardUrl} className="font-bold hover:underline text-sport-purple">Klik di sini</a>
                </p>
              </div>
            </div>
          )
        ) : (
          /* ——— Form State (guest) ——— */
          <>
            {/* Login prompt above form */}
            <div className="mb-4 flex items-center justify-between gap-3 bg-white border border-card-border rounded-xl px-4 py-3 shadow-sm">
              <p className="text-xs text-brand-muted font-medium">
                Sudah punya akun?
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-black text-white px-4 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
                style={{ background: 'linear-gradient(90deg, #7c3aed, #ef4444, #f97316)' }}
              >
                Login Sekarang →
              </Link>
            </div>

            <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            {/* Header Gradient line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-sport-purple via-sport-red to-sport-orange" />

            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center text-center gap-1.5 mb-2">
                <div className="p-3 rounded-xl mb-1 bg-linear-to-br from-sport-purple via-sport-red to-sport-orange">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-black uppercase text-slate-900">Daftar Bro & Sist Package</h2>
                <p className="text-xs text-brand-muted font-medium">Buat akun untuk mendaftarkan peserta lari bersama saudara Anda</p>
              </div>

              {/* Info strip */}
              <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                <Users className="w-4 h-4 text-sport-purple shrink-0 mt-0.5" />
                <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
                  <span className="text-slate-900 font-bold">Daftar peserta langsung di sini.</span> Isi data grup, input semua nama peserta Bro & Sist, lalu lakukan checkout di dashboard untuk mendapatkan QR Race Pass resmi.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
                  {authError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {formSettings.family.registrant.name.visible ? (
                  <Input
                    label="Nama Grup"
                    required={formSettings.family.registrant.name.required}
                    placeholder="Contoh: Sibling Runners, Budi & Sani"
                    error={errors.name?.message}
                    disabled={isSubmitting}
                    {...register('name')}
                  />
                ) : (
                  <input type="hidden" value={familyFallbacks.name} {...register('name')} />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formSettings.family.registrant.leader_name.visible ? (
                    <Input
                      label="Nama Perwakilan"
                      required={formSettings.family.registrant.leader_name.required}
                      placeholder="Nama lengkap perwakilan grup"
                      error={errors.leader_name?.message}
                      disabled={isSubmitting}
                      {...register('leader_name')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.leader_name} {...register('leader_name')} />
                  )}
                  {formSettings.family.registrant.phone.visible ? (
                    <Input
                      label="No. WhatsApp Perwakilan"
                      required={formSettings.family.registrant.phone.required}
                      placeholder="08xxxxxxxxxx"
                      error={errors.phone?.message}
                      disabled={isSubmitting}
                      {...register('phone')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.phone} {...register('phone')} />
                  )}
                </div>

                {formSettings.family.registrant.email.visible ? (
                  <Input
                    label="Email Perwakilan"
                    required={formSettings.family.registrant.email.required}
                    type="email"
                    placeholder="email@example.com"
                    error={errors.email?.message}
                    disabled={isSubmitting}
                    {...register('email')}
                  />
                ) : (
                  <input type="hidden" value={familyFallbacks.email} {...register('email')} />
                )}

                {formSettings.family.registrant.category.visible ? (
                  <Select
                    label="Kategori"
                    required={formSettings.family.registrant.category.required}
                    placeholder="Pilih kategori"
                    error={errors.category?.message}
                    disabled={isSubmitting}
                    options={formSettings.family.registrant.category.options}
                    {...register('category')}
                  />
                ) : (
                  <input type="hidden" value={familyFallbacks.category} {...register('category')} />
                )}

                {/* Address Section */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {formSettings.family.registrant.provinsi.visible ? (
                    <Select
                      label={formSettings.family.registrant.provinsi.label}
                      required={formSettings.family.registrant.provinsi.required}
                      placeholder={loadingProvinsi ? 'Memuat provinsi...' : formSettings.family.registrant.provinsi.placeholder}
                      error={errors.provinsi?.message}
                      disabled={isSubmitting || loadingProvinsi}
                      options={provinsiList}
                      {...register('provinsi')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.provinsi} {...register('provinsi')} />
                  )}

                  {formSettings.family.registrant.kota.visible ? (
                    <Select
                      label={formSettings.family.registrant.kota.label}
                      required={formSettings.family.registrant.kota.required}
                      placeholder={selectedProvinsi ? (loadingKota ? 'Memuat kota...' : formSettings.family.registrant.kota.placeholder) : 'Pilih provinsi dulu'}
                      error={errors.kota?.message}
                      disabled={isSubmitting || loadingKota || !selectedProvinsi}
                      options={kotaList}
                      {...register('kota')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.kota} {...register('kota')} />
                  )}

                  {formSettings.family.registrant.kecamatan.visible ? (
                    <Select
                      label={formSettings.family.registrant.kecamatan.label}
                      required={formSettings.family.registrant.kecamatan.required}
                      placeholder={selectedKota ? (loadingKecamatan ? 'Memuat kecamatan...' : formSettings.family.registrant.kecamatan.placeholder) : 'Pilih kota dulu'}
                      error={errors.kecamatan?.message}
                      disabled={isSubmitting || loadingKecamatan || !selectedKota}
                      options={kecamatanList}
                      {...register('kecamatan')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.kecamatan} {...register('kecamatan')} />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formSettings.family.registrant.password.visible ? (
                    <Input
                      label={formSettings.family.registrant.password.label}
                      required={formSettings.family.registrant.password.required}
                      type="password"
                      placeholder={formSettings.family.registrant.password.placeholder}
                      error={errors.password?.message}
                      disabled={isSubmitting}
                      {...register('password')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.password} {...register('password')} />
                  )}
                  {formSettings.family.registrant.confirmPassword.visible ? (
                    <Input
                      label={formSettings.family.registrant.confirmPassword.label}
                      required={formSettings.family.registrant.confirmPassword.required}
                      type="password"
                      placeholder={formSettings.family.registrant.confirmPassword.placeholder}
                      error={errors.confirmPassword?.message}
                      disabled={isSubmitting}
                      {...register('confirmPassword')}
                    />
                  ) : (
                    <input type="hidden" value={familyFallbacks.confirmPassword} {...register('confirmPassword')} />
                  )}
                </div>

                {/* --- SEPARATOR & PARTICIPANTS HEADER --- */}
                <div className="border-t border-card-border/60 my-4 pt-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-sport-purple" />
                        Daftar Peserta Bro & Sist
                      </h3>
                      <p className="text-[10px] text-brand-muted mt-0.5">Input minimal 3 peserta untuk grup Anda</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => append({ ...defaultParticipant })}
                      className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-sport-purple/10 border border-sport-purple/20 text-sport-purple hover:bg-sport-purple/20 transition-all rounded-lg text-[10px] font-black uppercase cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Peserta
                    </button>
                  </div>
                </div>

                {/* --- PARTICIPANTS LIST --- */}
                <div className="flex flex-col gap-4 my-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border border-card-border rounded-xl bg-slate-50/50 relative flex flex-col gap-4">
                      {/* Participant Header */}
                      <div className="flex justify-between items-center pb-2 border-b border-card-border/50">
                        <span className="text-[10px] font-black uppercase text-sport-purple tracking-wider">Peserta #{index + 1}</span>
                        {fields.length > 3 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="inline-flex items-center gap-0.5 text-[9px] font-black text-red-500 hover:text-red-700 uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-0.5" /> Hapus
                          </button>
                        )}
                      </div>

                      {/* Inputs */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {formSettings.family.participants.full_name.visible ? (
                          <Input
                            label={formSettings.family.participants.full_name.label}
                            required={formSettings.family.participants.full_name.required}
                            placeholder={formSettings.family.participants.full_name.placeholder}
                            error={errors.participants?.[index]?.full_name?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.full_name` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).full_name} {...register(`participants.${index}.full_name` as const)} />
                        )}
                        {formSettings.family.participants.bib_name.visible ? (
                          <Input
                            label={formSettings.family.participants.bib_name.label}
                            required={formSettings.family.participants.bib_name.required}
                            placeholder={formSettings.family.participants.bib_name.placeholder}
                            error={errors.participants?.[index]?.bib_name?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.bib_name` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).bib_name} {...register(`participants.${index}.bib_name` as const)} />
                        )}
                        {formSettings.family.participants.ktp_number.visible ? (
                          <Input
                            label={formSettings.family.participants.ktp_number.label}
                            required={formSettings.family.participants.ktp_number.required}
                            placeholder={formSettings.family.participants.ktp_number.placeholder}
                            error={errors.participants?.[index]?.ktp_number?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.ktp_number` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).ktp_number} {...register(`participants.${index}.ktp_number` as const)} />
                        )}
                        {formSettings.family.participants.email.visible ? (
                          <Input
                            label={formSettings.family.participants.email.label}
                            required={formSettings.family.participants.email.required}
                            type="email"
                            placeholder={formSettings.family.participants.email.placeholder}
                            error={errors.participants?.[index]?.email?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.email` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).email} {...register(`participants.${index}.email` as const)} />
                        )}
                        {formSettings.family.participants.phone.visible ? (
                          <Input
                            label={formSettings.family.participants.phone.label}
                            required={formSettings.family.participants.phone.required}
                            placeholder={formSettings.family.participants.phone.placeholder}
                            error={errors.participants?.[index]?.phone?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.phone` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).phone} {...register(`participants.${index}.phone` as const)} />
                        )}
                        {formSettings.family.participants.date_of_birth.visible ? (
                          <Controller
                            name={`participants.${index}.date_of_birth` as const}
                            control={control}
                            render={({ field }) => (
                              <DateInput
                                label={formSettings.family.participants.date_of_birth.label}
                                required={formSettings.family.participants.date_of_birth.required}
                                placeholder={formSettings.family.participants.date_of_birth.placeholder}
                                error={errors.participants?.[index]?.date_of_birth?.message}
                                disabled={isSubmitting}
                                value={field.value}
                                onChange={field.onChange}
                              />
                            )}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).date_of_birth} {...register(`participants.${index}.date_of_birth` as const)} />
                        )}
                      </div>

                      {/* Gender & Jersey Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {formSettings.family.participants.gender.visible ? (
                          <Select
                            label={formSettings.family.participants.gender.label}
                            required={formSettings.family.participants.gender.required}
                            placeholder={formSettings.family.participants.gender.placeholder}
                            error={errors.participants?.[index]?.gender?.message}
                            disabled={isSubmitting}
                            options={formSettings.family.participants.gender.options}
                            {...register(`participants.${index}.gender` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).gender} {...register(`participants.${index}.gender` as const)} />
                        )}

                        {formSettings.family.participants.tshirt_size.visible ? (
                          <div className="flex flex-col gap-1">
                            <Select
                              label={formSettings.family.participants.tshirt_size.label}
                              required={formSettings.family.participants.tshirt_size.required}
                              placeholder={formSettings.family.participants.tshirt_size.placeholder}
                              error={errors.participants?.[index]?.tshirt_size?.message}
                              disabled={isSubmitting}
                              options={formSettings.family.participants.tshirt_size.options}
                              {...register(`participants.${index}.tshirt_size` as const)}
                            />
                            <button
                              type="button"
                              onClick={() => setIsSizeChartOpen(true)}
                              className="text-[9px] text-sport-purple hover:text-sport-purple/80 font-semibold hover:underline text-left cursor-pointer"
                            >
                              Lihat Size Chart
                            </button>
                          </div>
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).tshirt_size} {...register(`participants.${index}.tshirt_size` as const)} />
                        )}
                        {formSettings.family.participants.blood_type.visible ? (
                          <Select
                            label={formSettings.family.participants.blood_type.label}
                            required={formSettings.family.participants.blood_type.required}
                            placeholder={formSettings.family.participants.blood_type.placeholder}
                            error={errors.participants?.[index]?.blood_type?.message}
                            disabled={isSubmitting}
                            options={formSettings.family.participants.blood_type.options}
                            {...register(`participants.${index}.blood_type` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).blood_type} {...register(`participants.${index}.blood_type` as const)} />
                        )}
                      </div>

                      {formSettings.family.participants.medical_condition.visible ? (
                        <Input
                          label={formSettings.family.participants.medical_condition.label}
                          required={formSettings.family.participants.medical_condition.required}
                          placeholder={formSettings.family.participants.medical_condition.placeholder}
                          error={errors.participants?.[index]?.medical_condition?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.medical_condition` as const)}
                        />
                      ) : (
                        <input type="hidden" value={participantFallbacks(index).medical_condition} {...register(`participants.${index}.medical_condition` as const)} />
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {formSettings.family.participants.emergency_contact_name.visible ? (
                          <Input
                            label={formSettings.family.participants.emergency_contact_name.label}
                            required={formSettings.family.participants.emergency_contact_name.required}
                            placeholder={formSettings.family.participants.emergency_contact_name.placeholder}
                            error={errors.participants?.[index]?.emergency_contact_name?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.emergency_contact_name` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).emergency_contact_name} {...register(`participants.${index}.emergency_contact_name` as const)} />
                        )}
                        {formSettings.family.participants.emergency_contact_phone.visible ? (
                          <Input
                            label={formSettings.family.participants.emergency_contact_phone.label}
                            required={formSettings.family.participants.emergency_contact_phone.required}
                            placeholder={formSettings.family.participants.emergency_contact_phone.placeholder}
                            error={errors.participants?.[index]?.emergency_contact_phone?.message}
                            disabled={isSubmitting}
                            {...register(`participants.${index}.emergency_contact_phone` as const)}
                          />
                        ) : (
                          <input type="hidden" value={participantFallbacks(index).emergency_contact_phone} {...register(`participants.${index}.emergency_contact_phone` as const)} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Add Participant Button */}
                <div className="flex justify-end mt-2 mb-6">
                  <button
                    type="button"
                    onClick={() => append({ ...defaultParticipant })}
                    className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-sport-purple/10 border border-sport-purple/20 text-sport-purple hover:bg-sport-purple/20 transition-all rounded-lg text-xs font-black uppercase cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Tambah Peserta
                  </button>
                </div>

                {/* --- VOUCHER INPUT --- */}
                {selectedCategory && basePrice > 0 && (
                  <div className="mt-4">
                    <VoucherInput
                      packageKey="family"
                      basePrice={basePrice * fields.length}
                      category={selectedCategory}
                      onApply={(voucher) => setAppliedVoucher(voucher)}
                      onRemove={() => setAppliedVoucher(null)}
                    />
                  </div>
                )}

                {/* --- RINGKASAN BIAYA --- */}
                {basePrice > 0 && (
                  <div className="mt-4 p-4 rounded-xl border border-card-border bg-brand-gray/5 flex flex-col gap-2">
                    <h4 className="text-[10px] font-black uppercase text-brand-muted tracking-wider mb-1">Ringkasan Biaya</h4>
                    <div className="flex justify-between text-xs text-brand-muted">
                      <span>Biaya Pendaftaran ({fields.length} peserta)</span>
                      <span className="font-bold">Rp {(basePrice * fields.length).toLocaleString('id-ID')}</span>
                    </div>
                    {appliedVoucher && appliedVoucher.finalDiscount > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Diskon Voucher ({appliedVoucher.name})</span>
                        <span className="font-bold">- Rp {appliedVoucher.finalDiscount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="border-t border-card-border my-1" />
                    <div className="flex justify-between text-sm text-foreground font-black uppercase">
                      <span>Total Pembayaran</span>
                      <span className="text-sport-orange">Rp {Math.max(0, basePrice * fields.length - (appliedVoucher?.finalDiscount || 0)).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}

                {/* --- SYARAT & KETENTUAN (S&K) --- */}
                <div className="mt-6 p-4 bg-violet-50/50 border border-violet-100/80 rounded-xl flex flex-col gap-3">
                  <h4 className="text-[10px] font-black uppercase text-sport-purple tracking-wider">Syarat & Ketentuan</h4>
                  
                  {/* Agreement 1 */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-card-border text-sport-purple focus:ring-sport-purple/30 cursor-pointer"
                      {...register('agreement_safety')}
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-brand-muted leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                        Saya setuju bahwa panitia tidak bertanggung jawab atas segala risiko yang mungkin terjadi selama partisipasi saya dalam kegiatan ini.
                      </span>
                      {errors.agreement_safety?.message && (
                        <span className="text-[10px] text-sport-red font-medium mt-0.5">{errors.agreement_safety?.message}</span>
                      )}
                    </div>
                  </label>

                  {/* Agreement 2 */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-card-border text-sport-purple focus:ring-sport-purple/30 cursor-pointer"
                      {...register('agreement_data')}
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-brand-muted leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                        Saya setuju bahwa panitia berhak menggunakan data peserta untuk keperluan pihak ketiga atau terkait.
                      </span>
                      {errors.agreement_data?.message && (
                        <span className="text-[10px] text-sport-red font-medium mt-0.5">{errors.agreement_data?.message}</span>
                      )}
                    </div>
                  </label>

                  {/* Agreement 3 */}
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-card-border text-sport-purple focus:ring-sport-purple/30 cursor-pointer"
                      {...register('agreement_refund')}
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-brand-muted leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                        Saya setuju bahwa biaya registrasi tidak dapat dikembalikan apabila saya batal berpartisipasi baik karena alasan pribadi maupun force majeure, seperti bencana alam atau wabah penyakit yang mengakibatkan acara tidak terselenggara.
                      </span>
                      {errors.agreement_refund?.message && (
                        <span className="text-[10px] text-sport-red font-medium mt-0.5">{errors.agreement_refund?.message}</span>
                      )}
                    </div>
                  </label>
                </div>

                {/* General participants array errors (e.g. duplicate email/phone check) */}
                {errors.participants && 'message' in errors.participants && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500 my-2">
                    {(errors.participants as any).message}
                  </div>
                )}
                {errors.participants && 'root' in errors.participants && (errors.participants as any).root?.message && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500 my-2">
                    {(errors.participants as any).root.message}
                  </div>
                )}

              {/* 
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-4 text-xs font-black mt-2 shadow-md shadow-sport-purple/10"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                  isLoading={isSubmitting}
                >
                  <Trophy className="w-4 h-4 mr-2" />Daftar Bro & Sist Package Sekarang
                </Button> 
                */}
              </form>

              <p className="text-xs text-center text-brand-muted mt-2">
                Sudah punya akun?{' '}
                <Link href="/login" className="font-bold hover:underline text-sport-purple">Login di sini</Link>
              </p>
            </div>
          </div>
        </>
      )}
      </section>

      {/* Size Chart Modal */}
      <Dialog
        isOpen={isSizeChartOpen}
        onClose={() => setIsSizeChartOpen(false)}
        title="Size Chart Jersey"
        className="max-w-2xl"
      >
        <div className="flex flex-col items-center">
          <Image
            src={packagesSettings?.family.sizeChartImage || '/images/size.jpg'}
            alt="Size Chart Jersey"
            width={800}
            height={800}
            className="w-full h-auto rounded-lg shadow-md"
          />
        </div>
      </Dialog>

    </SiteShell>
  )
}
