'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Users, Trophy, CheckCircle, Calendar, MapPin,
  Timer, ArrowRight, UserPlus, Plus, Trash2,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { registerSchema, RegisterFormValues } from '@/lib/validations/auth'
import { signUpCommunity } from '@/app/actions/auth'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DEFAULT_REGISTRATION_FORM_SETTINGS, type RegistrationFormSettings } from '@/lib/admin/settings-schema'

const defaultParticipant = {
  full_name: '',
  bib_name: '',
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

// ——— Interactive Countdown Component ———
function EventCountdown() {
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(() => {
    const eventDate = new Date('2026-10-18T06:00:00+07:00')
    const now = new Date()
    const diff = eventDate.getTime() - now.getTime()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
    }
  })

  useEffect(() => {
    const eventDate = new Date('2026-10-18T06:00:00+07:00')

    const calculateTime = () => {
      const now = new Date()
      const diff = eventDate.getTime() - now.getTime()
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      }
    }

    const mountTimer = window.setTimeout(() => setMounted(true), 0)
    const timer = setInterval(() => {
      setTimeLeft(calculateTime())
    }, 1000)

    return () => {
      window.clearTimeout(mountTimer)
      clearInterval(timer)
    }
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center gap-3 sm:gap-5 justify-center opacity-60">
        {[
          { label: 'Hari' },
          { label: 'Jam' },
          { label: 'Menit' },
          { label: 'Detik' },
        ].map((t, i) => (
          <React.Fragment key={t.label}>
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-xl bg-white border border-card-border flex items-center justify-center shadow-sm">
                <span className="text-2xl sm:text-3xl font-black text-slate-300">--</span>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-brand-muted">{t.label}</span>
            </div>
            {i < 3 && <span className="text-xl font-black text-slate-300 -mt-5">:</span>}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 sm:gap-5 justify-center">
      {[
        { value: timeLeft.days, label: 'Hari' },
        { value: timeLeft.hours, label: 'Jam' },
        { value: timeLeft.minutes, label: 'Menit' },
        { value: timeLeft.seconds, label: 'Detik' },
      ].map((t, i) => (
        <React.Fragment key={t.label}>
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-xl bg-white border border-card-border flex items-center justify-center shadow-md relative overflow-hidden group hover:border-sport-purple/50 transition-colors">
              <span className="text-2xl sm:text-3xl font-black tabular-nums bg-gradient-to-r from-sport-purple via-sport-red to-sport-orange bg-clip-text text-transparent">
                {String(t.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-brand-muted">{t.label}</span>
          </div>
          {i < 3 && <span className="text-xl font-black text-brand-muted/30 -mt-5 animate-pulse">:</span>}
        </React.Fragment>
      ))}
    </div>
  )
}

export default function LandingPage() {
  const isSuccess = false
  const [authError, setAuthError] = useState<string | null>(null)
  const [formSettings, setFormSettings] = useState<RegistrationFormSettings>(DEFAULT_REGISTRATION_FORM_SETTINGS)
  
  // Location states
  const [provinsiList, setProvinsiList] = useState<Array<{ value: string; label: string }>>([])
  const [kotaList, setKotaList] = useState<Array<{ value: string; label: string }>>([])
  const [kecamatanList, setKecamatanList] = useState<Array<{ value: string; label: string }>>([])
  const [loadingProvinsi, setLoadingProvinsi] = useState(false)
  const [loadingKota, setLoadingKota] = useState(false)
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      leader_name: '',
      phone: '',
      email: '',
      provinsi: '',
      kota: '',
      kecamatan: '',
      password: '',
      confirmPassword: '',
      participants: Array.from({ length: 10 }, () => ({ ...defaultParticipant })),
      agreement_safety: false,
      agreement_data: false,
      agreement_refund: false,
    },
  })

  const selectedProvinsi = watch('provinsi')
  const selectedKota = watch('kota')

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

  const onSubmit = async (values: RegisterFormValues) => {
    setAuthError(null)
    const result = await signUpCommunity(values)
    if (result.error) {
      setAuthError(result.error)
    } else {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#ef4444', '#f97316', '#ffffff'],
      })
      window.location.href = '/dashboard'
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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative">
      {/* Background noise grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.4] pointer-events-none" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)' }} />

      {/* ——— NAV ——— */}
      <nav className="sports-glass sticky top-0 z-50 w-full border-b border-card-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center select-none">
            <Image
              src="/images/header.png"
              alt="TOPSELL RUN"
              width={152}
              height={43}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs font-bold text-brand-muted hover:text-foreground border border-card-border px-3 py-1.5 rounded-lg transition-colors">Masuk</Link>
            <a
              href="#register-section"
              onClick={handleScrollToRegister}
              className="text-xs font-black text-white px-4 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer shadow-md shadow-sport-purple/10"
              style={{ background: 'linear-gradient(90deg, #7c3aed, #ef4444, #f97316)' }}
            >
              Daftar
            </a>
          </div>
        </div>
      </nav>

      {/* ——— HERO ——— */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-16 pb-12 overflow-hidden z-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Event badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-card-border rounded-full backdrop-blur-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Pendaftaran Komunitas Dibuka</span>
          </div>

          {/* Main title */}
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <h1 className="sr-only">TOPSELL x Samsung Run For Changes 2026</h1>
            <p className="text-4xl sm:text-6xl font-black uppercase tracking-tight leading-none text-slate-900">
              TOPSELL x Samsung
            </p>
            <Image
              src="/images/hero.png"
              alt="Run For Changes 2026"
              width={492}
              height={216}
              className="w-full max-w-[456px] h-auto object-contain"
              priority
            />
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
            Daftarkan Komunitas <ArrowRight className="w-4 h-4" />
          </a>

          <p className="text-[10px] text-brand-muted font-bold uppercase tracking-wider mt-1">
            Rp 135.000 / peserta • Pembayaran Kolektif • QR Race Pass Resmi
          </p>
        </div>
      </section>

      {/* ——— FORM SECTION ——— */}
      <section id="register-section" className="px-4 py-8 z-10 relative max-w-3xl mx-auto scroll-mt-20">
        {isSuccess ? (
          /* ——— Success State ——— */
          <div className="sports-glass-glow rounded-2xl p-8 flex flex-col items-center text-center gap-5 border border-green-500/30 shadow-2xl relative overflow-hidden bg-white">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-green-500" />
            <div className="p-4 bg-green-50 border border-green-200 rounded-full text-green-500">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-sport-orange mb-1">Registrasi Berhasil!</p>
              <h2 className="text-xl font-black uppercase text-slate-900">Komunitas Terdaftar</h2>
              <p className="text-xs text-brand-muted mt-2 leading-relaxed">
                Akun komunitas Anda telah berhasil dibuat. Silakan lanjut ke dashboard untuk melakukan pembayaran kolektif.
              </p>
            </div>
            <Link href="/login" className="w-full">
              <Button variant="primary" className="w-full py-4 text-xs font-black" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}>
                Masuk ke Dashboard →
              </Button>
            </Link>
          </div>
        ) : (
          /* ——— Form State ——— */
          <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            {/* Header Gradient line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sport-purple via-sport-red to-sport-orange" />

            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center text-center gap-1.5 mb-2">
                <div className="p-3 rounded-xl mb-1 bg-gradient-to-br from-sport-purple via-sport-red to-sport-orange">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-black uppercase text-slate-900">Daftar Komunitas</h2>
                <p className="text-xs text-brand-muted font-medium">Buat akun untuk mendaftarkan peserta lari tim Anda</p>
              </div>

              {/* Info strip */}
              <div className="flex items-start gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                <Users className="w-4 h-4 text-sport-purple flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
                  <span className="text-slate-900 font-bold">Daftar peserta langsung di sini.</span> Isi data komunitas, input semua nama peserta lari, lalu lakukan checkout kolektif di dashboard untuk mendapatkan QR Race Pass resmi.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
                  {authError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <Input
                  label={formSettings.community.name.label}
                  placeholder={formSettings.community.name.placeholder}
                  error={errors.name?.message}
                  disabled={isSubmitting}
                  {...register('name')}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={formSettings.community.leader_name.label}
                    placeholder={formSettings.community.leader_name.placeholder}
                    error={errors.leader_name?.message}
                    disabled={isSubmitting}
                    {...register('leader_name')}
                  />
                  <Input
                    label={formSettings.community.phone.label}
                    placeholder={formSettings.community.phone.placeholder}
                    error={errors.phone?.message}
                    disabled={isSubmitting}
                    {...register('phone')}
                  />
                </div>

                <Input
                  label={formSettings.community.email.label}
                  type="email"
                  placeholder={formSettings.community.email.placeholder}
                  error={errors.email?.message}
                  disabled={isSubmitting}
                  {...register('email')}
                />

                {/* Address Section */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Select
                    label={formSettings.community.provinsi.label}
                    placeholder={loadingProvinsi ? 'Memuat provinsi...' : formSettings.community.provinsi.placeholder}
                    error={errors.provinsi?.message}
                    disabled={isSubmitting || loadingProvinsi}
                    options={provinsiList}
                    {...register('provinsi')}
                  />

                  <Select
                    label={formSettings.community.kota.label}
                    placeholder={selectedProvinsi ? (loadingKota ? 'Memuat kota...' : formSettings.community.kota.placeholder) : 'Pilih provinsi dulu'}
                    error={errors.kota?.message}
                    disabled={isSubmitting || loadingKota || !selectedProvinsi}
                    options={kotaList}
                    {...register('kota')}
                  />

                  <Select
                    label={formSettings.community.kecamatan.label}
                    placeholder={selectedKota ? (loadingKecamatan ? 'Memuat kecamatan...' : formSettings.community.kecamatan.placeholder) : 'Pilih kota dulu'}
                    error={errors.kecamatan?.message}
                    disabled={isSubmitting || loadingKecamatan || !selectedKota}
                    options={kecamatanList}
                    {...register('kecamatan')}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={formSettings.community.password.label}
                    type="password"
                    placeholder={formSettings.community.password.placeholder}
                    error={errors.password?.message}
                    disabled={isSubmitting}
                    {...register('password')}
                  />
                  <Input
                    label={formSettings.community.confirmPassword.label}
                    type="password"
                    placeholder={formSettings.community.confirmPassword.placeholder}
                    error={errors.confirmPassword?.message}
                    disabled={isSubmitting}
                    {...register('confirmPassword')}
                  />
                </div>

                {/* --- SEPARATOR & PARTICIPANTS HEADER --- */}
                <div className="border-t border-card-border/60 my-4 pt-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                    <div>
                      <h3 className="text-sm font-black uppercase text-slate-900 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-sport-purple" />
                        Daftar Peserta Lari
                      </h3>
                      <p className="text-[10px] text-brand-muted mt-0.5">Input minimal 10 peserta untuk komunitas Anda</p>
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
                        {fields.length > 10 && (
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
                        <Input
                          label={formSettings.participants.full_name.label}
                          placeholder={formSettings.participants.full_name.placeholder}
                          error={errors.participants?.[index]?.full_name?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.full_name` as const)}
                        />
                        <Input
                          label={formSettings.participants.bib_name.label}
                          placeholder={formSettings.participants.bib_name.placeholder}
                          error={errors.participants?.[index]?.bib_name?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.bib_name` as const)}
                        />
                        <Input
                          label={formSettings.participants.email.label}
                          type="email"
                          placeholder={formSettings.participants.email.placeholder}
                          error={errors.participants?.[index]?.email?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.email` as const)}
                        />
                        <Input
                          label={formSettings.participants.phone.label}
                          placeholder={formSettings.participants.phone.placeholder}
                          error={errors.participants?.[index]?.phone?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.phone` as const)}
                        />
                        <Input
                          label={formSettings.participants.date_of_birth.label}
                          type="date"
                          placeholder={formSettings.participants.date_of_birth.placeholder}
                          error={errors.participants?.[index]?.date_of_birth?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.date_of_birth` as const)}
                        />
                      </div>

                      {/* Gender & Jersey Selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Select
                          label={formSettings.participants.gender.label}
                          placeholder={formSettings.participants.gender.placeholder}
                          error={errors.participants?.[index]?.gender?.message}
                          disabled={isSubmitting}
                          options={formSettings.participants.gender.options}
                          {...register(`participants.${index}.gender` as const)}
                        />

                        <Select
                          label={formSettings.participants.tshirt_size.label}
                          placeholder={formSettings.participants.tshirt_size.placeholder}
                          error={errors.participants?.[index]?.tshirt_size?.message}
                          disabled={isSubmitting}
                          options={formSettings.participants.tshirt_size.options}
                          {...register(`participants.${index}.tshirt_size` as const)}
                        />
                        <Select
                          label={formSettings.participants.blood_type.label}
                          placeholder={formSettings.participants.blood_type.placeholder}
                          error={errors.participants?.[index]?.blood_type?.message}
                          disabled={isSubmitting}
                          options={formSettings.participants.blood_type.options}
                          {...register(`participants.${index}.blood_type` as const)}
                        />
                      </div>

                      <Input
                        label={formSettings.participants.medical_condition.label}
                        placeholder={formSettings.participants.medical_condition.placeholder}
                        error={errors.participants?.[index]?.medical_condition?.message}
                        disabled={isSubmitting}
                        {...register(`participants.${index}.medical_condition` as const)}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label={formSettings.participants.emergency_contact_name.label}
                          placeholder={formSettings.participants.emergency_contact_name.placeholder}
                          error={errors.participants?.[index]?.emergency_contact_name?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.emergency_contact_name` as const)}
                        />
                        <Input
                          label={formSettings.participants.emergency_contact_phone.label}
                          placeholder={formSettings.participants.emergency_contact_phone.placeholder}
                          error={errors.participants?.[index]?.emergency_contact_phone?.message}
                          disabled={isSubmitting}
                          {...register(`participants.${index}.emergency_contact_phone` as const)}
                        />
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
                        Saya setuju bahwa panitia tidak bertanggung jawab atas segala risiko, termasuk kecelakaan, sakit dan meninggal dunia, yang mungkin terjadi selama partisipasi saya dalam kegiatan ini.
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

                <Button
                  type="submit"
                  variant="primary"
                  className="w-full py-4 text-xs font-black mt-2 shadow-md shadow-sport-purple/10"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                  isLoading={isSubmitting}
                >
                  <Trophy className="w-4 h-4 mr-2" />Daftarkan Komunitas Sekarang
                </Button>
              </form>

              <p className="text-xs text-center text-brand-muted mt-2">
                Sudah punya akun?{' '}
                <Link href="/login" className="font-bold hover:underline text-sport-purple">Login di sini</Link>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ——— FOOTER ——— */}
      <footer className="border-t border-card-border px-4 py-8 z-10 relative bg-white mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <Image
              src="/images/header.png"
              alt="TOPSELL RUN 2026"
              width={136}
              height={38}
              className="h-[29px] w-auto object-contain"
            />
          </div>
          <p className="text-[10px] text-brand-muted font-bold text-center uppercase tracking-wider">
            © 2026 TOPSELL x SAMSUNG RUN FOR CHANGES. All rights reserved. • Mojokerto, Jawa Timur
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[10px] font-black text-brand-muted hover:text-sport-purple transition-colors uppercase tracking-wider">Login</Link>
            <a href="#register-section" onClick={handleScrollToRegister} className="text-[10px] font-black text-brand-muted hover:text-sport-purple transition-colors uppercase tracking-wider">Daftar</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
