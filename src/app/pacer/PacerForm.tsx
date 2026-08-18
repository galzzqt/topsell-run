'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle, ArrowRight, UserPlus, Trophy, User, ImagePlus, X, Mail, AlertTriangle } from 'lucide-react'
import confetti from 'canvas-confetti'
import { registerPacerSchema, RegisterPacerFormValues, RegisterPacerFormInput } from '@/lib/validations/auth'
import { signUpPacer } from '@/app/actions/pacer-auth'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SiteShell, useActiveSession } from '@/components/landing/shell'
import { DEFAULT_REGISTRATION_FORM_SETTINGS, type RegistrationFormSettings } from '@/lib/admin/settings-schema'

type CategoryOption = { value: string; label: string; price: number }

const MAX_MEDIA = 5


export default function PacerForm() {
  const router = useRouter()
  const [activeSession, setActiveSession] = useActiveSession()
  const [isSuccess, setIsSuccess] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([
    { value: '3K', label: '3K', price: 0 },
    { value: '6K', label: '6K', price: 0 },
  ])
  const [sizeChartImage, setSizeChartImage] = useState('')
  const [formSettings, setFormSettings] = useState<RegistrationFormSettings>(DEFAULT_REGISTRATION_FORM_SETTINGS)

  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)

  const [pbMediaUrls, setPbMediaUrls] = useState<string[]>([])
  const [isUploadingPbMedia, setIsUploadingPbMedia] = useState(false)
  const [pbMediaError, setPbMediaError] = useState<string | null>(null)

  // Location states
  const [provinsiList, setProvinsiList] = useState<Array<{ value: string; label: string }>>([])
  const [kotaList, setKotaList] = useState<Array<{ value: string; label: string }>>([])
  const [kecamatanList, setKecamatanList] = useState<Array<{ value: string; label: string }>>([])
  const [loadingProvinsi, setLoadingProvinsi] = useState(false)
  const [loadingKota, setLoadingKota] = useState(false)
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<RegisterPacerFormInput, unknown, RegisterPacerFormValues>({
    resolver: zodResolver(registerPacerSchema),
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
      category: categoryOptions[0].value,
      provinsi: '',
      kota: '',
      kecamatan: '',
      age: undefined,
      sosmed_instagram: '',
      sosmed_tiktok: '',
      strava_link: '',
      strava_username: '',
      bank_name: '',
      bank_account_number: '',
      bank_account_holder: '',
      has_smartwatch: 'no',
      media_urls: [] as string[],
      pb_media_urls: [] as string[],
      password: '',
      confirmPassword: '',
      agreement_safety: false,
      agreement_data: false,
    },
  })

  const selectedProvinsi = useWatch({ control, name: 'provinsi' })
  const selectedKota = useWatch({ control, name: 'kota' })

  // Load kategori & size chart pacer dari pengaturan admin (Kelola Paket / Kelola Periode)
  useEffect(() => {
    fetch('/api/settings/packages')
      .then((r) => (r.ok ? r.json() : null))
      .then((packages) => {
        const cats = packages?.pacer?.periods?.flatMap((period: { categories: CategoryOption[] }) => period.categories)
        if (Array.isArray(cats) && cats.length > 0) {
          setCategoryOptions(cats)
          setValue('category', cats[0].value)
        }
        if (typeof packages?.pacer?.sizeChartImage === 'string') {
          setSizeChartImage(packages.pacer.sizeChartImage)
        }
      })
      .catch(() => undefined)
  }, [setValue])

  // Load konfigurasi field form pendaftaran pacer (label/placeholder/visibility) dari admin
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

  const uploadMediaFiles = async (files: File[], onError: (msg: string) => void) => {
    const uploaded: string[] = []
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/pacer/upload', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) {
        onError(data.error || 'Gagal upload foto.')
        continue
      }
      uploaded.push(data.url)
    }
    return uploaded
  }

  const handleMediaSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setMediaError(null)
    const remaining = MAX_MEDIA - mediaUrls.length
    if (remaining <= 0) {
      setMediaError('Maksimal 5 foto.')
      return
    }

    setIsUploadingMedia(true)
    try {
      const uploaded = await uploadMediaFiles(files.slice(0, remaining), setMediaError)
      const next = [...mediaUrls, ...uploaded]
      setMediaUrls(next)
      setValue('media_urls', next)
    } finally {
      setIsUploadingMedia(false)
    }
  }

  const removeMedia = (url: string) => {
    const next = mediaUrls.filter((u) => u !== url)
    setMediaUrls(next)
    setValue('media_urls', next)
  }

  const handlePbMediaSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (files.length === 0) return

    setPbMediaError(null)
    const remaining = MAX_MEDIA - pbMediaUrls.length
    if (remaining <= 0) {
      setPbMediaError('Maksimal 5 foto.')
      return
    }

    setIsUploadingPbMedia(true)
    try {
      const uploaded = await uploadMediaFiles(files.slice(0, remaining), setPbMediaError)
      const next = [...pbMediaUrls, ...uploaded]
      setPbMediaUrls(next)
      setValue('pb_media_urls', next)
    } finally {
      setIsUploadingPbMedia(false)
    }
  }

  const removePbMedia = (url: string) => {
    const next = pbMediaUrls.filter((u) => u !== url)
    setPbMediaUrls(next)
    setValue('pb_media_urls', next)
  }

  const [emailSent, setEmailSent] = useState(false)

  const onSubmit = async (values: RegisterPacerFormValues) => {
    setAuthError(null)
    const provinsiName = provinsiList.find((p) => p.value === values.provinsi)?.label || values.provinsi
    const kotaName = kotaList.find((k) => k.value === values.kota)?.label || values.kota
    const kecamatanName = kecamatanList.find((k) => k.value === values.kecamatan)?.label || values.kecamatan


    if (mediaUrls.length === 0) {
      setMediaError('Minimal 1 foto portofolio lari wajib diunggah.')
      return
    }

    const res = await signUpPacer({
      ...values,
      media_urls: mediaUrls,
      pb_media_urls: pbMediaUrls,
    })

    if (res?.error) {
      setAuthError(res.error)
      return
    }

    setSubmittedEmail(values.email)
    setEmailSent(res?.emailSent !== false)
    setIsSuccess(true)
    reset()
    setMediaUrls([])
    setPbMediaUrls([])

    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      })
    } catch {
      // Ignored
    }
  }

  const pacerPkg = formSettings.pacer

  return (
    <SiteShell session={activeSession} onLogout={() => setActiveSession(null)}>
      {/* SUCCESS MODAL */}
      <Dialog
        isOpen={isSuccess}
        onClose={() => {
          setIsSuccess(false)
          router.push('/login')
        }}
        title="PENDAFTARAN DITERIMA"
      >
        <div className="flex flex-col items-center text-center gap-6">
          <div className="p-5 bg-gradient-to-br from-green-400 via-green-500 to-emerald-600 rounded-full shadow-xl animate-pulse">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          <div>
            <h3 className="text-2xl font-black uppercase text-slate-900 mb-2">
              Pendaftaran Pacer Berhasil!
            </h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              Akun Anda telah dibuat dan pendaftaran sedang <strong>menunggu review admin</strong>. Anda bisa login
              kapan saja untuk memantau status persetujuan.
            </p>
          </div>

          {emailSent ? (
            <div className="w-full flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
              <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-amber-900 mb-1">Cek Email Anda</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Kami telah mengirimkan link aktivasi ke <strong>{submittedEmail}</strong>. Klik link tersebut untuk mengaktifkan akun sebelum login.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-left">
              <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black text-yellow-900 mb-1">Email Verifikasi Belum Terkirim</p>
                <p className="text-[11px] text-yellow-800 leading-relaxed">
                  Gagal mengirim email aktivasi. Silakan minta kirim ulang dari halaman login, atau hubungi CS.
                </p>
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
              Login ke Dashboard Pacer
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ——— FORM SECTION ——— */}
      <section className="px-4 pt-10 pb-8 z-10 relative max-w-3xl mx-auto">
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
              <h2 className="text-xl font-black uppercase text-slate-900">Pendaftaran Pacer</h2>
              <p className="text-xs text-brand-muted font-medium">Daftar sebagai pacer — tanpa biaya, seleksi oleh panitia</p>
            </div>

            <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
              <User className="w-4 h-4 text-sport-purple shrink-0 mt-0.5" />
              <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
                <span className="text-slate-900 font-bold">Isi data diri Anda.</span> Pendaftaran pacer gratis dan akan
                direview oleh panitia. Status persetujuan bisa dipantau di dashboard setelah login.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.pacer.participants.full_name.visible && (
                  <Input
                    label={formSettings.pacer.participants.full_name.label}
                    required={formSettings.pacer.participants.full_name.required}
                    placeholder={formSettings.pacer.participants.full_name.placeholder}
                    error={errors.full_name?.message}
                    disabled={isSubmitting}
                    {...register('full_name')}
                  />
                )}
                {formSettings.pacer.participants.bib_name.visible && (
                  <Input
                    label={formSettings.pacer.participants.bib_name.label}
                    required={formSettings.pacer.participants.bib_name.required}
                    placeholder={formSettings.pacer.participants.bib_name.placeholder}
                    error={errors.bib_name?.message}
                    disabled={isSubmitting}
                    {...register('bib_name')}
                  />
                )}
              </div>

              {formSettings.pacer.participants.ktp_number.visible && (
                <Input
                  label={formSettings.pacer.participants.ktp_number.label}
                  required={formSettings.pacer.participants.ktp_number.required}
                  placeholder={formSettings.pacer.participants.ktp_number.placeholder}
                  error={errors.ktp_number?.message}
                  disabled={isSubmitting}
                  {...register('ktp_number')}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.pacer.participants.email.visible && (
                  <Input
                    label={formSettings.pacer.participants.email.label}
                    required={formSettings.pacer.participants.email.required}
                    type="email"
                    placeholder={formSettings.pacer.participants.email.placeholder}
                    error={errors.email?.message}
                    disabled={isSubmitting}
                    {...register('email')}
                  />
                )}
                {formSettings.pacer.participants.phone.visible && (
                  <Input
                    label={formSettings.pacer.participants.phone.label}
                    required={formSettings.pacer.participants.phone.required}
                    placeholder={formSettings.pacer.participants.phone.placeholder}
                    error={errors.phone?.message}
                    disabled={isSubmitting}
                    {...register('phone')}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {formSettings.pacer.participants.date_of_birth.visible && (
                  <Controller
                    name="date_of_birth"
                    control={control}
                    render={({ field }) => (
                      <DateInput
                        label={formSettings.pacer.participants.date_of_birth.label}
                        required={formSettings.pacer.participants.date_of_birth.required}
                        placeholder={formSettings.pacer.participants.date_of_birth.placeholder}
                        error={errors.date_of_birth?.message}
                        disabled={isSubmitting}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                )}
                {formSettings.pacer.participants.age.visible && (
                  <Input
                    label={formSettings.pacer.participants.age.label}
                    required={formSettings.pacer.participants.age.required}
                    type="number"
                    placeholder={formSettings.pacer.participants.age.placeholder}
                    error={errors.age?.message}
                    disabled={isSubmitting}
                    {...register('age')}
                  />
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
                {formSettings.pacer.participants.gender.visible && (
                  <Select
                    label={formSettings.pacer.participants.gender.label}
                    required={formSettings.pacer.participants.gender.required}
                    error={errors.gender?.message}
                    disabled={isSubmitting}
                    options={formSettings.pacer.participants.gender.options}
                    {...register('gender')}
                  />
                )}
                {formSettings.pacer.participants.tshirt_size.visible && (
                  <div className="flex flex-col gap-1">
                    <Select
                      label={formSettings.pacer.participants.tshirt_size.label}
                      required={formSettings.pacer.participants.tshirt_size.required}
                      error={errors.tshirt_size?.message}
                      disabled={isSubmitting}
                      options={formSettings.pacer.participants.tshirt_size.options}
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
                )}
                {formSettings.pacer.participants.blood_type.visible && (
                  <Select
                    label={formSettings.pacer.participants.blood_type.label}
                    required={formSettings.pacer.participants.blood_type.required}
                    error={errors.blood_type?.message}
                    disabled={isSubmitting}
                    options={formSettings.pacer.participants.blood_type.options}
                    {...register('blood_type')}
                  />
                )}
              </div>

              {formSettings.pacer.participants.medical_condition.visible && (
                <Input
                  label={formSettings.pacer.participants.medical_condition.label}
                  required={formSettings.pacer.participants.medical_condition.required}
                  placeholder={formSettings.pacer.participants.medical_condition.placeholder}
                  error={errors.medical_condition?.message}
                  disabled={isSubmitting}
                  {...register('medical_condition')}
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.pacer.participants.emergency_contact_name.visible && (
                  <Input
                    label={formSettings.pacer.participants.emergency_contact_name.label}
                    required={formSettings.pacer.participants.emergency_contact_name.required}
                    placeholder={formSettings.pacer.participants.emergency_contact_name.placeholder}
                    error={errors.emergency_contact_name?.message}
                    disabled={isSubmitting}
                    {...register('emergency_contact_name')}
                  />
                )}
                {formSettings.pacer.participants.emergency_contact_phone.visible && (
                  <Input
                    label={formSettings.pacer.participants.emergency_contact_phone.label}
                    required={formSettings.pacer.participants.emergency_contact_phone.required}
                    placeholder={formSettings.pacer.participants.emergency_contact_phone.placeholder}
                    error={errors.emergency_contact_phone?.message}
                    disabled={isSubmitting}
                    {...register('emergency_contact_phone')}
                  />
                )}
              </div>

              {/* Address Section */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {formSettings.pacer.registrant.provinsi.visible && (
                  <Select
                    label={formSettings.pacer.registrant.provinsi.label}
                    required={formSettings.pacer.registrant.provinsi.required}
                    placeholder={loadingProvinsi ? 'Memuat provinsi...' : formSettings.pacer.registrant.provinsi.placeholder}
                    error={errors.provinsi?.message}
                    disabled={isSubmitting || loadingProvinsi}
                    options={provinsiList}
                    {...register('provinsi')}
                  />
                )}
                {formSettings.pacer.registrant.kota.visible && (
                  <Select
                    label={formSettings.pacer.registrant.kota.label}
                    required={formSettings.pacer.registrant.kota.required}
                    placeholder={selectedProvinsi ? (loadingKota ? 'Memuat kota...' : formSettings.pacer.registrant.kota.placeholder) : 'Pilih provinsi dulu'}
                    error={errors.kota?.message}
                    disabled={isSubmitting || loadingKota || !selectedProvinsi}
                    options={kotaList}
                    {...register('kota')}
                  />
                )}
                {formSettings.pacer.registrant.kecamatan.visible && (
                  <Select
                    label={formSettings.pacer.registrant.kecamatan.label}
                    required={formSettings.pacer.registrant.kecamatan.required}
                    placeholder={selectedKota ? (loadingKecamatan ? 'Memuat kecamatan...' : formSettings.pacer.registrant.kecamatan.placeholder) : 'Pilih kota dulu'}
                    error={errors.kecamatan?.message}
                    disabled={isSubmitting || loadingKecamatan || !selectedKota}
                    options={kecamatanList}
                    {...register('kecamatan')}
                  />
                )}
              </div>

              {/* --- FIELD KHUSUS PACER --- */}
              <div className="mt-1 p-4 bg-orange-50/50 border border-orange-100/80 rounded-xl flex flex-col gap-4">
                <h4 className="text-[10px] font-black uppercase text-sport-orange tracking-wider">Info Pacer</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formSettings.pacer.participants.sosmed_instagram.visible && (
                    <Input
                      label={formSettings.pacer.participants.sosmed_instagram.label}
                      required={formSettings.pacer.participants.sosmed_instagram.required}
                      placeholder={formSettings.pacer.participants.sosmed_instagram.placeholder}
                      error={errors.sosmed_instagram?.message}
                      disabled={isSubmitting}
                      {...register('sosmed_instagram')}
                    />
                  )}
                  {formSettings.pacer.participants.sosmed_tiktok.visible && (
                    <Input
                      label={formSettings.pacer.participants.sosmed_tiktok.label}
                      required={formSettings.pacer.participants.sosmed_tiktok.required}
                      placeholder={formSettings.pacer.participants.sosmed_tiktok.placeholder}
                      error={errors.sosmed_tiktok?.message}
                      disabled={isSubmitting}
                      {...register('sosmed_tiktok')}
                    />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {formSettings.pacer.participants.strava_link.visible && (
                    <Input
                      label={formSettings.pacer.participants.strava_link.label}
                      required={formSettings.pacer.participants.strava_link.required}
                      placeholder={formSettings.pacer.participants.strava_link.placeholder}
                      error={errors.strava_link?.message}
                      disabled={isSubmitting}
                      {...register('strava_link')}
                    />
                  )}
                  {formSettings.pacer.participants.strava_username.visible && (
                    <Input
                      label={formSettings.pacer.participants.strava_username.label}
                      required={formSettings.pacer.participants.strava_username.required}
                      placeholder={formSettings.pacer.participants.strava_username.placeholder}
                      error={errors.strava_username?.message}
                      disabled={isSubmitting}
                      {...register('strava_username')}
                    />
                  )}
                </div>

                {formSettings.pacer.participants.has_smartwatch.visible && (
                  <Select
                    label={formSettings.pacer.participants.has_smartwatch.label}
                    required={formSettings.pacer.participants.has_smartwatch.required}
                    error={errors.has_smartwatch?.message}
                    disabled={isSubmitting}
                    options={formSettings.pacer.participants.has_smartwatch.options}
                    {...register('has_smartwatch')}
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {formSettings.pacer.participants.bank_name.visible && (
                    <Input
                      label={formSettings.pacer.participants.bank_name.label}
                      required={formSettings.pacer.participants.bank_name.required}
                      placeholder={formSettings.pacer.participants.bank_name.placeholder}
                      error={errors.bank_name?.message}
                      disabled={isSubmitting}
                      {...register('bank_name')}
                    />
                  )}
                  {formSettings.pacer.participants.bank_account_number.visible && (
                    <Input
                      label={formSettings.pacer.participants.bank_account_number.label}
                      required={formSettings.pacer.participants.bank_account_number.required}
                      placeholder={formSettings.pacer.participants.bank_account_number.placeholder}
                      error={errors.bank_account_number?.message}
                      disabled={isSubmitting}
                      {...register('bank_account_number')}
                    />
                  )}
                  {formSettings.pacer.participants.bank_account_holder.visible && (
                    <Input
                      label={formSettings.pacer.participants.bank_account_holder.label}
                      required={formSettings.pacer.participants.bank_account_holder.required}
                      placeholder={formSettings.pacer.participants.bank_account_holder.placeholder}
                      error={errors.bank_account_holder?.message}
                      disabled={isSubmitting}
                      {...register('bank_account_holder')}
                    />
                  )}
                </div>

                {/* Upload foto portofolio/aksi — fixed, tidak admin-configurable */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                    Foto Portofolio / Aksi * <span className="normal-case text-[9px] font-medium text-brand-muted/70">(min. 1, maks. {MAX_MEDIA})</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {mediaUrls.map((url) => (
                      <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-card-border">
                        <Image src={url} alt="Foto pacer" fill unoptimized className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removeMedia(url)}
                          className="absolute top-0.5 right-0.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {mediaUrls.length < MAX_MEDIA && (
                      <label className="w-20 h-20 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-card-border rounded-lg cursor-pointer text-brand-muted hover:text-sport-orange hover:border-sport-orange transition-colors">
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[9px] font-bold">
                          {isUploadingMedia ? 'Upload...' : 'Tambah'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={isSubmitting || isUploadingMedia}
                          onChange={handleMediaSelected}
                        />
                      </label>
                    )}
                  </div>
                  {mediaError && <span className="text-xs text-sport-red font-medium">{mediaError}</span>}
                  {errors.media_urls?.message && <span className="text-xs text-sport-red font-medium">{errors.media_urls.message}</span>}
                </div>

                {/* Upload bukti Personal Best (PB) — fixed, tidak admin-configurable */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                    Bukti Personal Best / PB * <span className="normal-case text-[9px] font-medium text-brand-muted/70">(min. 1, maks. {MAX_MEDIA})</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {pbMediaUrls.map((url) => (
                      <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-card-border">
                        <Image src={url} alt="Foto PB pacer" fill unoptimized className="object-cover" />
                        <button
                          type="button"
                          onClick={() => removePbMedia(url)}
                          className="absolute top-0.5 right-0.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {pbMediaUrls.length < MAX_MEDIA && (
                      <label className="w-20 h-20 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-card-border rounded-lg cursor-pointer text-brand-muted hover:text-sport-orange hover:border-sport-orange transition-colors">
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-[9px] font-bold">
                          {isUploadingPbMedia ? 'Upload...' : 'Tambah'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={isSubmitting || isUploadingPbMedia}
                          onChange={handlePbMediaSelected}
                        />
                      </label>
                    )}
                  </div>
                  {pbMediaError && <span className="text-xs text-sport-red font-medium">{pbMediaError}</span>}
                  {errors.pb_media_urls?.message && <span className="text-xs text-sport-red font-medium">{errors.pb_media_urls.message}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {formSettings.pacer.registrant.password.visible && (
                  <Input
                    label={formSettings.pacer.registrant.password.label}
                    required={formSettings.pacer.registrant.password.required}
                    type="password"
                    placeholder={formSettings.pacer.registrant.password.placeholder}
                    error={errors.password?.message}
                    disabled={isSubmitting}
                    {...register('password')}
                  />
                )}
                {formSettings.pacer.registrant.confirmPassword.visible && (
                  <Input
                    label={formSettings.pacer.registrant.confirmPassword.label}
                    required={formSettings.pacer.registrant.confirmPassword.required}
                    type="password"
                    placeholder={formSettings.pacer.registrant.confirmPassword.placeholder}
                    error={errors.confirmPassword?.message}
                    disabled={isSubmitting}
                    {...register('confirmPassword')}
                  />
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
                    text: 'Saya setuju bahwa panitia berhak menggunakan data & foto yang saya kirimkan untuk keperluan seleksi dan publikasi terkait acara ini.',
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
