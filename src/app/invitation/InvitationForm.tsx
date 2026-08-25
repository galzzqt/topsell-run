'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle, Timer, ArrowRight, UserPlus, Trophy, User, Mail } from 'lucide-react'
import confetti from 'canvas-confetti'
import { registerInvitationSchema, RegisterInvitationFormValues } from '@/lib/validations/auth'
import { signUpInvitation } from '@/app/actions/invitation-auth'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SiteShell, useActiveSession } from '@/components/landing/shell'
import { trackMetaPixelPurchase } from '@/lib/utils/meta-pixel'
import { INVITATION_CATEGORY_OPTIONS } from '@/lib/types'
import { DEFAULT_REGISTRATION_FORM_SETTINGS, type RegistrationFormSettings } from '@/lib/admin/settings-schema'
import { VoucherInput } from '@/components/ui/voucher-input'
import type { AppliedVoucher } from '@/lib/types/voucher'

type CategoryOption = { value: string; label: string; price: number }

export default function InvitationForm() {
  const router = useRouter()
  const [activeSession, setActiveSession] = useActiveSession()
  const [isSuccess, setIsSuccess] = useState(false)
  const [emailSent, setEmailSent] = useState(true)
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(
    INVITATION_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label, price: 0 }))
  )
  const [sizeChartImage, setSizeChartImage] = useState('')
  const [formSettings, setFormSettings] = useState<RegistrationFormSettings>(DEFAULT_REGISTRATION_FORM_SETTINGS)

  // Location states
  const [provinsiList, setProvinsiList] = useState<Array<{ value: string; label: string }>>([])
  const [kotaList, setKotaList] = useState<Array<{ value: string; label: string }>>([])
  const [kecamatanList, setKecamatanList] = useState<Array<{ value: string; label: string }>>([])
  const [loadingProvinsi, setLoadingProvinsi] = useState(false)
  const [loadingKota, setLoadingKota] = useState(false)
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<RegisterInvitationFormValues>({
    resolver: zodResolver(registerInvitationSchema),
    defaultValues: {
      full_name: '',
      bib_name: '',
      ktp_number: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: 'male',
      tshirt_size: 'M',
      blood_type: 'A',
      medical_condition: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      community_name: '',
      category: INVITATION_CATEGORY_OPTIONS[0].value,
      provinsi: '',
      kota: '',
      kecamatan: '',
      password: '',
      confirmPassword: '',
      agreement_safety: false,
      agreement_data: false,
      agreement_refund: false,
    },
  })

  const selectedProvinsi = useWatch({ control, name: 'provinsi' })
  const selectedKota = useWatch({ control, name: 'kota' })
  const selectedCategory = useWatch({ control, name: 'category' })
  const basePrice = categoryOptions.find((c) => c.value === selectedCategory)?.price || 0

  const invitationFallbacks = {
    full_name: 'Peserta Invitation',
    bib_name: 'PESERTA',
    ktp_number: '0000000000000000',
    community_name: '',
    email: 'peserta@topsell-run.com',
    phone: '081234567890',
    date_of_birth: '2000-01-01',
    gender: 'male',
    tshirt_size: 'M',
    blood_type: 'A',
    medical_condition: '',
    emergency_contact_name: '-',
    emergency_contact_phone: '081234567890',
    provinsi: '-',
    kota: '-',
    kecamatan: '-',
    password: 'topsell123',
    confirmPassword: 'topsell123',
  }

  // Load kategori & harga invitation dari pengaturan admin (Kelola Paket / Kelola Periode)
  useEffect(() => {
    fetch('/api/settings/packages')
      .then((r) => (r.ok ? r.json() : null))
      .then((packages) => {
        const cats = packages?.invitation?.periods?.flatMap((period: { categories: CategoryOption[] }) => period.categories)
        if (Array.isArray(cats) && cats.length > 0) {
          setCategoryOptions(cats)
          setValue('category', cats[0].value)
        }
        if (typeof packages?.invitation?.sizeChartImage === 'string') {
          setSizeChartImage(packages.invitation.sizeChartImage)
        }
      })
      .catch(() => undefined)
  }, [setValue])

  // Load konfigurasi field form pendaftaran invitation (label/placeholder/visibility) dari admin
  useEffect(() => {
    fetch('/api/settings/registration-form')
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (settings) setFormSettings(settings)
      })
      .catch(() => undefined)
  }, [])

  // Load provinces on mount
  useEffect(() => {
    const loadProvinsi = async () => {
      setLoadingProvinsi(true)
      try {
        setProvinsiList(await fetchProvinsi())
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
      setKotaList([])
      setKecamatanList([])
      setValue('kota', '')
      setValue('kecamatan', '')
      if (!selectedProvinsi) return

      setLoadingKota(true)
      try {
        setKotaList(await fetchKota(selectedProvinsi))
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
      setKecamatanList([])
      setValue('kecamatan', '')
      if (!selectedKota) return

      setLoadingKecamatan(true)
      try {
        setKecamatanList(await fetchKecamatan(selectedKota))
      } catch (error) {
        console.error('Error loading kecamatan:', error)
      } finally {
        setLoadingKecamatan(false)
      }
    }
    loadKecamatan()
  }, [selectedKota, setValue])

  const onSubmit = async (values: RegisterInvitationFormValues) => {
    setAuthError(null)
    const {
      category, provinsi, kota, kecamatan, password, confirmPassword,
      agreement_safety, agreement_data, agreement_refund, ...participant
    } = values

    const provinsiName = provinsiList.find((p) => p.value === provinsi)?.label || provinsi
    const kotaName = kotaList.find((k) => k.value === kota)?.label || kota
    const kecamatanName = kecamatanList.find((k) => k.value === kecamatan)?.label || kecamatan

    const result = await signUpInvitation({
      // Akun invitation = record 1 peserta, dinamai sesuai peserta itu sendiri
      name: participant.full_name,
      leader_name: participant.full_name,
      phone: participant.phone,
      email: participant.email,
      category,
      provinsi: provinsiName,
      kota: kotaName,
      kecamatan: kecamatanName,
      password,
      confirmPassword,
      participants: [participant],
      agreement_safety,
      agreement_data,
      agreement_refund,
    }, appliedVoucher?.code)

    if (result.error) {
      setAuthError(result.error)
      return
    }

    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#7c3aed', '#ef4444', '#f97316', '#ffffff'],
    })
    const chosenPrice = categoryOptions.find((c) => c.value === values.category)?.price || 0
    const finalPrice = Math.max(0, chosenPrice - (appliedVoucher?.finalDiscount || 0))
    await trackMetaPixelPurchase(finalPrice, 'IDR', {
      content_ids: [values.email],
      content_type: 'product',
      num_items: 1,
    })
    setRegisteredEmail(values.email)
    setEmailSent(result.emailSent !== false)
    setIsSuccess(true)
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
        title="REGISTRASI BERHASIL"
      >
        <div className="flex flex-col items-center text-center gap-6">
          <div className="p-5 bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 rounded-full shadow-xl animate-pulse">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          <div>
            <h3 className="text-2xl font-black uppercase text-slate-900 mb-2">
              Pendaftaran Invitation Berhasil!
            </h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              Akun Anda telah berhasil dibuat dengan email:
            </p>
            <p className="text-sm font-bold text-sport-purple mt-2 break-all">
              {registeredEmail}
            </p>
          </div>

          {emailSent ? (
            <div className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-5 text-left shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                  <Mail className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-amber-900 mb-3 uppercase tracking-wide">
                    Aktivasi Email Diperlukan
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed mb-3">
                    Kami telah mengirim <strong>link aktivasi</strong> ke email Anda. Silakan buka email dan{' '}
                    <strong>klik link untuk mengaktifkan akun</strong> sebelum login ke dashboard.
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
          ) : (
            <div className="w-full bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-300 rounded-xl p-5 text-left shadow-md">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-red-100 rounded-lg shrink-0">
                  <Mail className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-red-900 mb-3 uppercase tracking-wide">
                    Email Aktivasi Gagal Terkirim
                  </p>
                  <p className="text-xs text-red-800 leading-relaxed">
                    Akun Anda <strong>berhasil dibuat</strong>, tetapi kami gagal mengirim email aktivasi.
                    Silakan buka halaman <strong>Login</strong> lalu klik{' '}
                    <strong>&quot;Kirim Ulang Email Verifikasi&quot;</strong> untuk mencoba lagi. Jika masih gagal,
                    hubungi Admin via WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          )}

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
          </div>
        </div>
      </Dialog>

      {/* ——— FORM SECTION ——— */}
      <section className="px-4 pt-10 pb-8 z-10 relative max-w-3xl mx-auto">
        {/* Login prompt above form */}
        <div className="mb-4 flex items-center justify-between gap-3 bg-white border border-card-border rounded-xl px-4 py-3 shadow-sm">
          <p className="text-xs text-brand-muted font-medium">Sudah punya akun?</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-black text-white px-4 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
            style={{ background: 'linear-gradient(90deg, #7c3aed, #ef4444, #f97316)' }}
          >
            Login Sekarang →
          </Link>
        </div>

        <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-sport-purple via-sport-red to-sport-orange" />

          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center text-center gap-1.5 mb-2">
              <div className="p-3 rounded-xl mb-1 bg-linear-to-br from-sport-purple via-sport-red to-sport-orange">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-black uppercase text-slate-900">Pendaftaran Invitation</h2>
              <p className="text-xs text-brand-muted font-medium">Daftar sebagai satu peserta — pilih kategori 3K atau 6K</p>
            </div>

            <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
              <User className="w-4 h-4 text-sport-purple shrink-0 mt-0.5" />
              <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">Isi data diri Anda.</span> Akun akan dibuat dengan email &amp;
                nomor WhatsApp ini, lalu lakukan checkout di dashboard untuk mendapatkan QR Race Pass resmi.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.invitation.participants.full_name.visible ? (
                  <Input
                    label={formSettings.invitation.participants.full_name.label}
                    required={formSettings.invitation.participants.full_name.required}
                    placeholder={formSettings.invitation.participants.full_name.placeholder}
                    error={errors.full_name?.message}
                    disabled={isSubmitting}
                    {...register('full_name')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.full_name} {...register('full_name')} />
                )}
                {formSettings.invitation.participants.bib_name.visible ? (
                  <Input
                    label={formSettings.invitation.participants.bib_name.label}
                    required={formSettings.invitation.participants.bib_name.required}
                    placeholder={formSettings.invitation.participants.bib_name.placeholder}
                    error={errors.bib_name?.message}
                    disabled={isSubmitting}
                    {...register('bib_name')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.bib_name} {...register('bib_name')} />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.invitation.participants.ktp_number.visible ? (
                  <Input
                    label={formSettings.invitation.participants.ktp_number.label}
                    required={formSettings.invitation.participants.ktp_number.required}
                    placeholder={formSettings.invitation.participants.ktp_number.placeholder}
                    error={errors.ktp_number?.message}
                    disabled={isSubmitting}
                    {...register('ktp_number')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.ktp_number} {...register('ktp_number')} />
                )}
                {formSettings.invitation.participants.community_name?.visible ? (
                  <Input
                    label={formSettings.invitation.participants.community_name.label}
                    required={formSettings.invitation.participants.community_name.required}
                    placeholder={formSettings.invitation.participants.community_name.placeholder}
                    error={errors.community_name?.message}
                    disabled={isSubmitting}
                    {...register('community_name')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.community_name} {...register('community_name')} />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.invitation.participants.email.visible ? (
                  <Input
                    label={formSettings.invitation.participants.email.label}
                    required={formSettings.invitation.participants.email.required}
                    type="email"
                    placeholder={formSettings.invitation.participants.email.placeholder}
                    error={errors.email?.message}
                    disabled={isSubmitting}
                    {...register('email')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.email} {...register('email')} />
                )}
                {formSettings.invitation.participants.phone.visible ? (
                  <Input
                    label={formSettings.invitation.participants.phone.label}
                    required={formSettings.invitation.participants.phone.required}
                    placeholder={formSettings.invitation.participants.phone.placeholder}
                    error={errors.phone?.message}
                    disabled={isSubmitting}
                    {...register('phone')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.phone} {...register('phone')} />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.invitation.participants.date_of_birth.visible ? (
                  <Controller
                    name="date_of_birth"
                    control={control}
                    render={({ field }) => (
                      <DateInput
                        label={formSettings.invitation.participants.date_of_birth.label}
                        required={formSettings.invitation.participants.date_of_birth.required}
                        placeholder={formSettings.invitation.participants.date_of_birth.placeholder}
                        error={errors.date_of_birth?.message}
                        disabled={isSubmitting}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.date_of_birth} {...register('date_of_birth')} />
                )}
                <Select
                  label="Kategori"
                  required
                  error={errors.category?.message}
                  disabled={isSubmitting}
                  options={categoryOptions.map((o) => ({ value: o.value, label: o.label }))}
                  {...register('category')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {formSettings.invitation.participants.gender.visible ? (
                  <Select
                    label={formSettings.invitation.participants.gender.label}
                    required={formSettings.invitation.participants.gender.required}
                    error={errors.gender?.message}
                    disabled={isSubmitting}
                    options={formSettings.invitation.participants.gender.options}
                    {...register('gender')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.gender} {...register('gender')} />
                )}
                {formSettings.invitation.participants.tshirt_size.visible ? (
                  <div className="flex flex-col gap-1">
                    <Select
                      label={formSettings.invitation.participants.tshirt_size.label}
                      required={formSettings.invitation.participants.tshirt_size.required}
                      error={errors.tshirt_size?.message}
                      disabled={isSubmitting}
                      options={formSettings.invitation.participants.tshirt_size.options}
                      {...register('tshirt_size')}
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
                  <input type="hidden" value={invitationFallbacks.tshirt_size} {...register('tshirt_size')} />
                )}
                {formSettings.invitation.participants.blood_type.visible ? (
                  <Select
                    label={formSettings.invitation.participants.blood_type.label}
                    required={formSettings.invitation.participants.blood_type.required}
                    error={errors.blood_type?.message}
                    disabled={isSubmitting}
                    options={formSettings.invitation.participants.blood_type.options}
                    {...register('blood_type')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.blood_type} {...register('blood_type')} />
                )}
              </div>

              {formSettings.invitation.participants.medical_condition.visible ? (
                <Input
                  label={formSettings.invitation.participants.medical_condition.label}
                  required={formSettings.invitation.participants.medical_condition.required}
                  placeholder={formSettings.invitation.participants.medical_condition.placeholder}
                  error={errors.medical_condition?.message}
                  disabled={isSubmitting}
                  {...register('medical_condition')}
                />
              ) : (
                <input type="hidden" value={invitationFallbacks.medical_condition} {...register('medical_condition')} />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.invitation.participants.emergency_contact_name.visible ? (
                  <Input
                    label={formSettings.invitation.participants.emergency_contact_name.label}
                    required={formSettings.invitation.participants.emergency_contact_name.required}
                    placeholder={formSettings.invitation.participants.emergency_contact_name.placeholder}
                    error={errors.emergency_contact_name?.message}
                    disabled={isSubmitting}
                    {...register('emergency_contact_name')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.emergency_contact_name} {...register('emergency_contact_name')} />
                )}
                {formSettings.invitation.participants.emergency_contact_phone.visible ? (
                  <Input
                    label={formSettings.invitation.participants.emergency_contact_phone.label}
                    required={formSettings.invitation.participants.emergency_contact_phone.required}
                    placeholder={formSettings.invitation.participants.emergency_contact_phone.placeholder}
                    error={errors.emergency_contact_phone?.message}
                    disabled={isSubmitting}
                    {...register('emergency_contact_phone')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.emergency_contact_phone} {...register('emergency_contact_phone')} />
                )}
              </div>

              {/* Address Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {formSettings.invitation.registrant.provinsi.visible ? (
                  <Select
                    label={formSettings.invitation.registrant.provinsi.label}
                    required={formSettings.invitation.registrant.provinsi.required}
                    placeholder={
                      loadingProvinsi
                        ? 'Memuat provinsi...'
                        : (formSettings.invitation.registrant.provinsi.placeholder?.replace(/\s*komunitas/gi, '') || 'Pilih provinsi')
                    }
                    error={errors.provinsi?.message}
                    disabled={isSubmitting || loadingProvinsi}
                    options={provinsiList}
                    {...register('provinsi')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.provinsi} {...register('provinsi')} />
                )}
                {formSettings.invitation.registrant.kota.visible ? (
                  <Select
                    label={formSettings.invitation.registrant.kota.label}
                    required={formSettings.invitation.registrant.kota.required}
                    placeholder={
                      selectedProvinsi
                        ? (loadingKota
                            ? 'Memuat kota...'
                            : (formSettings.invitation.registrant.kota.placeholder?.replace(/\s*komunitas/gi, '') || 'Pilih kota/kabupaten'))
                        : 'Pilih provinsi dulu'
                    }
                    error={errors.kota?.message}
                    disabled={isSubmitting || loadingKota || !selectedProvinsi}
                    options={kotaList}
                    {...register('kota')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.kota} {...register('kota')} />
                )}
                {formSettings.invitation.registrant.kecamatan.visible ? (
                  <Select
                    label={formSettings.invitation.registrant.kecamatan.label}
                    required={formSettings.invitation.registrant.kecamatan.required}
                    placeholder={
                      selectedKota
                        ? (loadingKecamatan
                            ? 'Memuat kecamatan...'
                            : (formSettings.invitation.registrant.kecamatan.placeholder?.replace(/\s*komunitas/gi, '') || 'Pilih kecamatan'))
                        : 'Pilih kota dulu'
                    }
                    error={errors.kecamatan?.message}
                    disabled={isSubmitting || loadingKecamatan || !selectedKota}
                    options={kecamatanList}
                    {...register('kecamatan')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.kecamatan} {...register('kecamatan')} />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.invitation.registrant.password.visible ? (
                  <Input
                    label={formSettings.invitation.registrant.password.label}
                    required={formSettings.invitation.registrant.password.required}
                    type="password"
                    placeholder={formSettings.invitation.registrant.password.placeholder}
                    error={errors.password?.message}
                    disabled={isSubmitting}
                    {...register('password')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.password} {...register('password')} />
                )}
                {formSettings.invitation.registrant.confirmPassword.visible ? (
                  <Input
                    label={formSettings.invitation.registrant.confirmPassword.label}
                    required={formSettings.invitation.registrant.confirmPassword.required}
                    type="password"
                    placeholder={formSettings.invitation.registrant.confirmPassword.placeholder}
                    error={errors.confirmPassword?.message}
                    disabled={isSubmitting}
                    {...register('confirmPassword')}
                  />
                ) : (
                  <input type="hidden" value={invitationFallbacks.confirmPassword} {...register('confirmPassword')} />
                )}
              </div>

              {/* --- SYARAT & KETENTUAN (S&K) --- */}
              <div className="mt-2 p-4 bg-violet-50/50 border border-violet-100/80 rounded-xl flex flex-col gap-3">
                <h4 className="text-[10px] font-black uppercase text-sport-purple tracking-wider">Syarat &amp; Ketentuan</h4>

                {([
                  {
                    key: 'agreement_safety',
                    text: 'Saya setuju bahwa panitia tidak bertanggung jawab atas segala risiko yang mungkin terjadi selama partisipasi saya dalam kegiatan ini.',
                  },
                  {
                    key: 'agreement_data',
                    text: 'Saya setuju bahwa panitia berhak menggunakan data peserta untuk keperluan pihak ketiga atau terkait.',
                  },
                  {
                    key: 'agreement_refund',
                    text: 'Saya setuju bahwa biaya registrasi tidak dapat dikembalikan apabila saya batal berpartisipasi baik karena alasan pribadi maupun force majeure, seperti bencana alam atau wabah penyakit yang mengakibatkan acara tidak terselenggara.',
                  },
                ] as const).map(({ key, text }) => (
                  <label key={key} className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="mt-0.5 w-4 h-4 rounded border-card-border text-sport-purple focus:ring-sport-purple/30 cursor-pointer"
                      {...register(key)}
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-brand-muted leading-relaxed font-medium group-hover:text-slate-800 transition-colors">
                        {text}
                      </span>
                      {errors[key]?.message && (
                        <span className="text-[10px] text-sport-red font-medium mt-0.5">{errors[key]?.message}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* --- VOUCHER INPUT --- */}
              {selectedCategory && basePrice > 0 && (
                <div className="mt-4">
                  <VoucherInput
                    packageKey="invitation"
                    basePrice={basePrice}
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
                    <span>Biaya Pendaftaran</span>
                    <span className="font-bold">Rp {basePrice.toLocaleString('id-ID')}</span>
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
                    <span className="text-sport-orange">Rp {Math.max(0, basePrice - (appliedVoucher?.finalDiscount || 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}


              <Button
                type="submit"
                variant="primary"
                className="w-full py-4 text-xs font-black mt-2 shadow-md shadow-sport-purple/10"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                isLoading={isSubmitting}
              >
                <Trophy className="w-4 h-4 mr-2" />Daftar Sekarang
              </Button>
            </form>

            <p className="text-xs text-center text-brand-muted mt-2">
              Sudah punya akun?{' '}
              <Link href="/login" className="font-bold hover:underline text-sport-purple">Login di sini</Link>
            </p>
          </div>
        </div>
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
            src={sizeChartImage || '/images/size.jpg'}
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
