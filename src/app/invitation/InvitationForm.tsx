'use client'

import React, { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useForm, useWatch, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus, Trophy, User, CheckCircle } from 'lucide-react'
import confetti from 'canvas-confetti'
import { buildInvitationSchema, RegisterInvitationFormValues } from '@/lib/validations/auth'
import { registerInvitation } from '@/app/actions/invitation-registration'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SiteShell, useActiveSession } from '@/components/landing/shell'
import { INVITATION_CATEGORY_OPTIONS } from '@/lib/types'
import { DEFAULT_REGISTRATION_FORM_SETTINGS, type RegistrationFormSettings } from '@/lib/admin/settings-schema'

type CategoryOption = { value: string; label: string; price: number }

// Jenis peserta invitation — label field nama menyesuaikan pilihan ini.
const PARTICIPANT_TYPE_OPTIONS = [
  { value: 'brand', label: 'Brand' },
  { value: 'instansi', label: 'Instansi' },
  { value: 'perseorangan', label: 'Perseorangan' },
] as const

const PARTICIPANT_TYPE_NAME_LABEL: Record<string, string> = {
  brand: 'Nama Brand',
  instansi: 'Nama Instansi',
  perseorangan: 'Nama Perseorangan',
}

export default function InvitationForm() {
  const [activeSession, setActiveSession] = useActiveSession()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSizeChartOpen, setIsSizeChartOpen] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>(
    INVITATION_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label, price: 0 }))
  )
  const [sizeChartImage, setSizeChartImage] = useState('')
  const [formSettings, setFormSettings] = useState<RegistrationFormSettings>(DEFAULT_REGISTRATION_FORM_SETTINGS)
  // Dibaca resolver saat submit — selalu pengaturan admin terbaru.
  const formSettingsRef = useRef(formSettings)

  // Location states
  const [provinsiList, setProvinsiList] = useState<Array<{ value: string; label: string }>>([])
  const [kotaList, setKotaList] = useState<Array<{ value: string; label: string }>>([])
  const [kecamatanList, setKecamatanList] = useState<Array<{ value: string; label: string }>>([])
  const [loadingProvinsi, setLoadingProvinsi] = useState(false)
  const [loadingKota, setLoadingKota] = useState(false)
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<RegisterInvitationFormValues>({
    // Validasi mengikuti pengaturan admin terbaru (field tersembunyi / tidak wajib boleh kosong).
    resolver: ((values, context, options) =>
      zodResolver(buildInvitationSchema(formSettingsRef.current.invitation))(values, context, options as never)) as Resolver<RegisterInvitationFormValues>,
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
      participant_type: 'instansi',
      category: INVITATION_CATEGORY_OPTIONS[0].value,
      provinsi: '',
      kota: '',
      kecamatan: '',
      agreement_safety: false,
      agreement_data: false,
      agreement_refund: false,
    },
  })

  const selectedProvinsi = useWatch({ control, name: 'provinsi' })
  const selectedKota = useWatch({ control, name: 'kota' })
  const selectedCategory = useWatch({ control, name: 'category' })
  const selectedParticipantType = useWatch({ control, name: 'participant_type' })
  const participantNameLabel = PARTICIPANT_TYPE_NAME_LABEL[selectedParticipantType || ''] || 'Nama Instansi / Brand'

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
        if (settings) {
          formSettingsRef.current = settings
          setFormSettings(settings)
        }
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
    const result = await registerInvitation({
      ...values,
      provinsi: provinsiList.find((p) => p.value === values.provinsi)?.label || values.provinsi,
      kota: kotaList.find((k) => k.value === values.kota)?.label || values.kota,
      kecamatan: kecamatanList.find((k) => k.value === values.kecamatan)?.label || values.kecamatan,
    })

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
    reset()
    setIsSuccess(true)
  }

  return (
    <SiteShell session={activeSession} onLogout={() => setActiveSession(null)}>
      <Dialog isOpen={isSuccess} onClose={() => setIsSuccess(false)} title="PENDAFTARAN DITERIMA">
        <div className="flex flex-col items-center text-center gap-5">
          <div className="p-5 bg-linear-to-br from-green-400 via-green-500 to-emerald-600 rounded-full shadow-xl">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-slate-900 mb-2">Pendaftaran Invitation Diterima!</h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              Terima kasih, data pendaftaran Anda sudah kami terima. Konfirmasi pendaftaran akan dikirim melalui
              <strong> email</strong> dan <strong>WhatsApp</strong>, dan informasi racepack akan dikirimkan oleh panitia.
            </p>
          </div>
          <Button
            onClick={() => setIsSuccess(false)}
            variant="primary"
            className="w-full py-4 text-sm font-black"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
          >
            Tutup
          </Button>
        </div>
      </Dialog>

      {/* ——— FORM SECTION ——— */}
      <section className="px-4 pt-10 pb-8 z-10 relative max-w-3xl mx-auto">
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
                <span className="text-slate-900 font-bold">Isi data diri Anda.</span> Konfirmasi pendaftaran akan dikirim ke email &amp;
                nomor WhatsApp ini.
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
                ) : null}
                {formSettings.invitation.participants.bib_name.visible ? (
                  <Input
                    label={formSettings.invitation.participants.bib_name.label}
                    required={formSettings.invitation.participants.bib_name.required}
                    placeholder={formSettings.invitation.participants.bib_name.placeholder}
                    error={errors.bib_name?.message}
                    disabled={isSubmitting}
                    {...register('bib_name')}
                  />
                ) : null}
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
                ) : null}
                <Select
                  label="Jenis Peserta"
                  required
                  error={errors.participant_type?.message}
                  disabled={isSubmitting}
                  options={PARTICIPANT_TYPE_OPTIONS}
                  defaultValue="instansi"
                  {...register('participant_type')}
                />
                {formSettings.invitation.participants.community_name?.visible ? (
                  <Input
                    label={participantNameLabel}
                    required={formSettings.invitation.participants.community_name.required}
                    placeholder={`Masukkan ${participantNameLabel.toLowerCase()}`}
                    error={errors.community_name?.message}
                    disabled={isSubmitting}
                    {...register('community_name')}
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Email & WA selalu tampil & wajib (cek duplikat + konfirmasi). */}
                <Input
                  label={formSettings.invitation.participants.email.label}
                  required
                  type="email"
                  placeholder={formSettings.invitation.participants.email.placeholder}
                  error={errors.email?.message}
                  disabled={isSubmitting}
                  {...register('email')}
                />
                <Input
                  label={formSettings.invitation.participants.phone.label}
                  required
                  placeholder={formSettings.invitation.participants.phone.placeholder}
                  error={errors.phone?.message}
                  disabled={isSubmitting}
                  {...register('phone')}
                />
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
                ) : null}
                {/* Kategori disembunyikan admin → server pakai kategori pertama periode aktif. */}
                {formSettings.invitation.registrant.category?.visible !== false ? (
                  <Select
                    label={formSettings.invitation.registrant.category?.label || 'Kategori'}
                    required={formSettings.invitation.registrant.category?.required !== false}
                    error={errors.category?.message}
                    disabled={isSubmitting}
                    value={selectedCategory}
                    options={categoryOptions.map((o) => ({ value: o.value, label: o.label }))}
                    {...register('category')}
                  />
                ) : null}
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
                ) : null}
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
                ) : null}
                {formSettings.invitation.participants.blood_type.visible ? (
                  <Select
                    label={formSettings.invitation.participants.blood_type.label}
                    required={formSettings.invitation.participants.blood_type.required}
                    error={errors.blood_type?.message}
                    disabled={isSubmitting}
                    options={formSettings.invitation.participants.blood_type.options}
                    {...register('blood_type')}
                  />
                ) : null}
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
              ) : null}

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
                ) : null}
                {formSettings.invitation.participants.emergency_contact_phone.visible ? (
                  <Input
                    label={formSettings.invitation.participants.emergency_contact_phone.label}
                    required={formSettings.invitation.participants.emergency_contact_phone.required}
                    placeholder={formSettings.invitation.participants.emergency_contact_phone.placeholder}
                    error={errors.emergency_contact_phone?.message}
                    disabled={isSubmitting}
                    {...register('emergency_contact_phone')}
                  />
                ) : null}
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
                ) : null}
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
                ) : null}
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
                ) : null}
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
