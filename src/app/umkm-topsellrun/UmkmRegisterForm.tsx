'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import {
  Store, User, Phone, Mail, Briefcase, MapPin, Lock, Eye, EyeOff,
  ChevronDown, AlertCircle, CheckCircle, Loader2, Tag, ArrowRight, Info,
  ImagePlus, X, Globe
} from 'lucide-react'
import { registerUmkmSchema, type RegisterUmkmFormValues, type RegisterUmkmFormInput } from '@/lib/validations/auth'
import { signUpUmkm } from '@/app/actions/umkm-auth'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { VoucherInput } from '@/components/ui/voucher-input'
import type { AppliedVoucher } from '@/lib/types/voucher'

const UMKM_BASE_PRICE = 500_000

type OptionItem = {
  value: string
  label: string
}

const BUSINESS_FIELDS = [
  'Kuliner / Makanan & Minuman',
  'Fashion & Pakaian',
  'Kerajinan Tangan',
  'Kecantikan & Perawatan',
  'Elektronik & Gadget',
  'Olahraga & Outdoor',
  'Kesehatan & Suplemen',
  'Pertanian & Perkebunan',
  'Jasa & Layanan',
  'Lainnya',
]

export default function UmkmRegisterForm() {
  const router = useRouter()
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Location
  const [provinsiList, setProvinsiList] = useState<OptionItem[]>([])
  const [kotaList, setKotaList] = useState<OptionItem[]>([])
  const [kecamatanList, setKecamatanList] = useState<OptionItem[]>([])
  const [selectedProvinsiId, setSelectedProvinsiId] = useState('')
  const [selectedKotaId, setSelectedKotaId] = useState('')

  // Photos
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // Voucher
  const [appliedVoucher, setAppliedVoucher] = useState<AppliedVoucher | null>(null)

  const discountAmount = appliedVoucher?.finalDiscount ?? 0
  const finalPrice = Math.max(0, UMKM_BASE_PRICE - discountAmount)
  const isFree = finalPrice === 0

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterUmkmFormInput, unknown, RegisterUmkmFormValues>({
    resolver: zodResolver(registerUmkmSchema),
    defaultValues: {
      description: '',
      social_media: '',
      address: '',
      photo_urls: [],
      agreement_data: false,
      agreement_terms: false,
    },
  })

  useEffect(() => {
    fetchProvinsi().then(setProvinsiList)
  }, [])

  useEffect(() => {
    if (!selectedProvinsiId) { setKotaList([]); setKecamatanList([]); return }
    fetchKota(selectedProvinsiId).then(setKotaList)
    setKecamatanList([])
  }, [selectedProvinsiId])

  useEffect(() => {
    if (!selectedKotaId) { setKecamatanList([]); return }
    fetchKecamatan(selectedKotaId).then(setKecamatanList)
  }, [selectedKotaId])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ''
    setUploadError('')

    if (photoUrls.length + files.length > 5) {
      setUploadError('Maksimal 5 foto usaha/produk.')
      return
    }

    setIsUploadingPhoto(true)
    try {
      const uploaded: string[] = []
      for (const file of files) {
        if (file.size > 3 * 1024 * 1024) {
          setUploadError(`Foto ${file.name} melebihi batas 3MB.`)
          continue
        }
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/umkm/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (res.ok && data.url) {
          uploaded.push(data.url)
        } else {
          setUploadError(data.error || 'Gagal mengupload foto.')
        }
      }
      if (uploaded.length > 0) {
        const nextPhotos = [...photoUrls, ...uploaded]
        setPhotoUrls(nextPhotos)
        setValue('photo_urls', nextPhotos, { shouldValidate: true })
      }
    } catch {
      setUploadError('Terjadi kendala jaringan saat mengupload foto.')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = (index: number) => {
    const nextPhotos = photoUrls.filter((_, i) => i !== index)
    setPhotoUrls(nextPhotos)
    setValue('photo_urls', nextPhotos, { shouldValidate: true })
  }

  const onSubmit = async (values: RegisterUmkmFormValues) => {
    setIsSubmitting(true)
    setServerError('')

    // If appliedVoucher exists, pass its code (e.g. 'AUTO' or specific code).
    // If user explicitly removed it, pass 'NONE' to avoid re-applying auto-voucher on server.
    const voucherToSend = appliedVoucher ? appliedVoucher.code : 'NONE'
    const result = await signUpUmkm(values, voucherToSend)
    setIsSubmitting(false)

    if (result.error) {
      setServerError(result.error)
      return
    }

    setStep('success')
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4 py-12">
        <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 left-0 w-96 h-96 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-card-bg border border-card-border rounded-2xl p-8 shadow-xl text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-black uppercase text-foreground mb-2">
              Pendaftaran Berhasil!
            </h2>
            <p className="text-sm text-brand-muted mb-6 leading-relaxed">
              Akun UMKM Anda telah dibuat. Silakan periksa email Anda untuk melakukan verifikasi akun sebelum login.
            </p>
            <div className="bg-brand-gray/50 rounded-xl p-4 mb-6 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-brand-muted">Paket:</span>
                <span className="font-bold text-foreground">Tenant UMKM Topsell Run 2026</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Biaya Pendaftaran:</span>
                <span className="font-bold text-green-400">{isFree ? 'GRATIS (Rp 0)' : `Rp ${finalPrice.toLocaleString('id-ID')}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-brand-muted">Status Awal:</span>
                <span className="font-bold text-amber-400">Menunggu Approval Admin</span>
              </div>
            </div>
            <button
              onClick={() => router.push('/umkm-login')}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-sport-red to-sport-orange text-white font-black uppercase text-sm rounded-xl hover:opacity-90 transition-all shadow-lg shadow-sport-orange/20 cursor-pointer"
            >
              Masuk ke Dashboard UMKM <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-dark text-foreground py-8 px-4 sm:px-6">
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sport-red to-sport-orange mb-4 shadow-lg shadow-sport-orange/20">
            <Store className="w-8 h-8 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sport-orange mb-1">Topsell Run 2026</p>
          <h1 className="text-3xl sm:text-4xl font-black uppercase text-foreground mb-2">
            Daftar Tenant UMKM
          </h1>
          <p className="text-sm text-brand-muted">
            Jadikan produk/usaha Anda bagian dari event lari terbesar di Mojokerto
          </p>
        </div>

        {/* Price Card */}
        <div className="bg-gradient-to-r from-sport-red/10 to-sport-orange/10 border border-sport-orange/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-sport-orange mb-1">Biaya Pendaftaran Tenant</p>
              {discountAmount > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-foreground line-through opacity-40">Rp 500.000</span>
                  <span className="text-2xl font-black text-green-400">{isFree ? 'GRATIS!' : `Rp ${finalPrice.toLocaleString('id-ID')}`}</span>
                </div>
              ) : (
                <p className="text-2xl font-black text-foreground">Rp 500.000</p>
              )}
              <p className="text-[10px] text-brand-muted mt-1">*Pembayaran setelah disetujui admin</p>
            </div>
            <div className="p-3 bg-sport-orange/10 border border-sport-orange/20 rounded-xl">
              <Tag className="w-6 h-6 text-sport-orange" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Info Usaha */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange mb-5 flex items-center gap-2">
              <Store className="w-3.5 h-3.5" /> Informasi Usaha
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Nama Usaha / Brand *</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    {...register('name')}
                    placeholder="Contoh: Warung Makan Bu Sari"
                    className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                  />
                </div>
                {errors.name && <p className="text-red-400 text-[11px] mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Bidang Usaha *</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                  <select
                    {...register('business_field')}
                    className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-10 py-3 text-sm text-foreground appearance-none focus:outline-none focus:border-sport-orange/50 transition-colors"
                  >
                    <option value="">Pilih bidang usaha</option>
                    {BUSINESS_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                </div>
                {errors.business_field && <p className="text-red-400 text-[11px] mt-1">{errors.business_field.message}</p>}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">
                  Link Media Sosial Usaha * <span className="text-brand-muted/50 normal-case font-normal">(Instagram / TikTok / Website / dll)</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    {...register('social_media')}
                    placeholder="Contoh: https://instagram.com/warungmakanbusari"
                    className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                  />
                </div>
                {errors.social_media && <p className="text-red-400 text-[11px] mt-1">{errors.social_media.message}</p>}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">
                  Deskripsi Usaha / Produk *
                </label>
                <textarea
                  {...register('description')}
                  placeholder="Jelaskan secara singkat jenis produk, menu, atau konsep tenant usaha Anda..."
                  rows={3}
                  className="w-full bg-brand-gray border border-card-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors resize-none"
                />
                {errors.description && <p className="text-red-400 text-[11px] mt-1">{errors.description.message}</p>}
              </div>
            </div>
          </div>

          {/* Foto Usaha / Produk UMKM */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange flex items-center gap-2">
                <ImagePlus className="w-3.5 h-3.5" /> Foto Usaha / Produk UMKM *
              </h2>
              <span className={`text-[10px] font-black ${photoUrls.length === 0 ? 'text-red-400' : 'text-green-400'}`}>
                {photoUrls.length}/5 Foto {photoUrls.length === 0 ? '(Wajib min. 1)' : '✓'}
              </span>
            </div>
            <p className="text-xs text-brand-muted mb-4">
              Wajib mengunggah minimal 1 foto (maks. 5 foto, maks. 3MB per foto) berupa foto produk, logo, atau foto tempat/booth usaha Anda.
            </p>

            {/* Photos Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photoUrls.map((url, idx) => (
                <div key={url} className="relative group rounded-xl overflow-hidden border border-card-border bg-brand-dark/40 aspect-video">
                  <Image
                    src={url}
                    alt={`Foto UMKM ${idx + 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(idx)}
                    className="absolute top-1.5 right-1.5 p-1 bg-brand-dark/80 hover:bg-sport-red text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer shadow"
                    title="Hapus foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {photoUrls.length < 5 && (
                <label className={`border-2 border-dashed border-card-border hover:border-sport-orange/50 rounded-xl aspect-video flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-brand-gray/30 hover:bg-brand-gray/50 transition-all ${isUploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="sr-only"
                    disabled={isUploadingPhoto}
                  />
                  {isUploadingPhoto ? (
                    <>
                      <Loader2 className="w-5 h-5 text-sport-orange animate-spin" />
                      <span className="text-[10px] font-bold text-brand-muted">Mengupload...</span>
                    </>
                  ) : (
                    <>
                      <ImagePlus className="w-5 h-5 text-brand-muted group-hover:text-sport-orange transition-colors" />
                      <span className="text-[10px] font-bold text-brand-muted">+ Upload Foto</span>
                    </>
                  )}
                </label>
              )}
            </div>
            {errors.photo_urls && (
              <p className="text-red-400 text-[11px] mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.photo_urls.message}
              </p>
            )}
            {uploadError && (
              <p className="text-red-400 text-[11px] mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {uploadError}
              </p>
            )}
          </div>

          {/* Info PIC */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange mb-5 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Data Person in Charge (PIC)
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Nama PIC *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    {...register('pic_name')}
                    placeholder="Nama lengkap penanggung jawab"
                    className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                  />
                </div>
                {errors.pic_name && <p className="text-red-400 text-[11px] mt-1">{errors.pic_name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">No. WhatsApp *</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      {...register('phone')}
                      placeholder="0812xxxxxxxx"
                      type="tel"
                      className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                    />
                  </div>
                  {errors.phone && <p className="text-red-400 text-[11px] mt-1">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                    <input
                      {...register('email')}
                      placeholder="email@gmail.com"
                      type="email"
                      className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                    />
                  </div>
                  {errors.email && <p className="text-red-400 text-[11px] mt-1">{errors.email.message}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Lokasi */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange mb-5 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" /> Lokasi Usaha
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Provinsi *</label>
                <div className="relative">
                  <select
                    value={selectedProvinsiId}
                    onChange={(e) => {
                      const opt = provinsiList.find((p) => p.value === e.target.value)
                      setSelectedProvinsiId(e.target.value)
                      setValue('provinsi', opt?.value || '')
                      setValue('kota', '')
                      setValue('kecamatan', '')
                      setSelectedKotaId('')
                    }}
                    className="w-full bg-brand-gray border border-card-border rounded-xl px-4 pr-10 py-3 text-sm text-foreground appearance-none focus:outline-none focus:border-sport-orange/50 transition-colors"
                  >
                    <option value="">Pilih provinsi</option>
                    {provinsiList.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                </div>
                {errors.provinsi && <p className="text-red-400 text-[11px] mt-1">{errors.provinsi.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Kota / Kabupaten *</label>
                  <div className="relative">
                    <select
                      value={selectedKotaId}
                      disabled={!selectedProvinsiId}
                      onChange={(e) => {
                        const opt = kotaList.find((k) => k.value === e.target.value)
                        setSelectedKotaId(e.target.value)
                        setValue('kota', opt?.value || '')
                        setValue('kecamatan', '')
                      }}
                      className="w-full bg-brand-gray border border-card-border rounded-xl px-4 pr-10 py-3 text-sm text-foreground appearance-none focus:outline-none focus:border-sport-orange/50 transition-colors disabled:opacity-40"
                    >
                      <option value="">Pilih kota</option>
                      {kotaList.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                  </div>
                  {errors.kota && <p className="text-red-400 text-[11px] mt-1">{errors.kota.message}</p>}
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Kecamatan *</label>
                  <div className="relative">
                    <select
                      disabled={!selectedKotaId}
                      onChange={(e) => {
                        const opt = kecamatanList.find((k) => k.value === e.target.value)
                        setValue('kecamatan', opt?.value || '')
                      }}
                      className="w-full bg-brand-gray border border-card-border rounded-xl px-4 pr-10 py-3 text-sm text-foreground appearance-none focus:outline-none focus:border-sport-orange/50 transition-colors disabled:opacity-40"
                    >
                      <option value="">Pilih kecamatan</option>
                      {kecamatanList.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                  </div>
                  {errors.kecamatan && <p className="text-red-400 text-[11px] mt-1">{errors.kecamatan.message}</p>}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">
                  Alamat Lengkap Usaha / Domisili *
                </label>
                <textarea
                  {...register('address')}
                  placeholder="Nama jalan, nomor bangunan/toko, RT/RW, kelurahan/desa, patokan lokasi..."
                  rows={2}
                  className="w-full bg-brand-gray border border-card-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors resize-none"
                />
                {errors.address && <p className="text-red-400 text-[11px] mt-1">{errors.address.message}</p>}
              </div>
            </div>
          </div>

          {/* Voucher */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange mb-4 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" /> Voucher &amp; Promo
              <span className="text-brand-muted normal-case font-normal">(opsional)</span>
            </h2>

            <VoucherInput
              packageKey="umkm"
              basePrice={UMKM_BASE_PRICE}
              category="Tenant UMKM 500.000"
              onApply={(voucher) => setAppliedVoucher(voucher)}
              onRemove={() => setAppliedVoucher(null)}
            />

            {/* Ringkasan Biaya */}
            <div className="mt-4 p-4 rounded-xl border border-card-border bg-brand-gray/20 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-brand-muted font-bold">Biaya Pendaftaran Tenant UMKM</span>
                <span className="font-bold text-foreground">Rp 500.000</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-green-400 font-bold">
                  <span>Diskon Voucher ({appliedVoucher?.name})</span>
                  <span>-Rp {discountAmount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="border-t border-card-border/60 pt-2 flex justify-between items-center">
                <span className="text-xs font-black text-brand-muted uppercase">Total Pembayaran</span>
                <span className={`text-base font-black ${isFree ? 'text-green-400' : 'text-foreground'}`}>
                  {isFree ? 'GRATIS (Rp 0)' : `Rp ${finalPrice.toLocaleString('id-ID')}`}
                </span>
              </div>
            </div>

            {isFree && (
              <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-start gap-2 text-green-400">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-xs font-medium">
                  Selamat! Pendaftaran tenant UMKM Anda <strong>GRATIS</strong> dan tidak dikenakan biaya saat disetujui admin.
                </p>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange mb-5 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Buat Password
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-[11px] mt-1">{errors.password.message}</p>}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Konfirmasi Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                  <input
                    {...register('confirmPassword')}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ulangi password Anda"
                    className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-foreground">
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-red-400 text-[11px] mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>
          </div>

          {/* Agreements */}
          <div className="bg-card-bg border border-card-border rounded-2xl p-6 space-y-3">
            <h2 className="text-xs font-black uppercase tracking-widest text-sport-orange mb-4">Persetujuan</h2>
            {[
              { field: 'agreement_data' as const, label: 'Saya menyetujui penggunaan data pribadi dan usaha saya untuk keperluan event Topsell Run 2026.' },
              { field: 'agreement_terms' as const, label: 'Saya menyetujui syarat & ketentuan sebagai tenant UMKM Topsell Run 2026 dan memahami bahwa pendaftaran memerlukan persetujuan admin.' },
            ].map(({ field, label }) => (
              <label key={field} className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    {...register(field)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${watch(field) ? 'bg-sport-orange border-sport-orange' : 'border-card-border bg-brand-gray group-hover:border-sport-orange/50'}`}>
                    {watch(field) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  </div>
                </div>
                <span className="text-xs text-brand-muted leading-relaxed">{label}</span>
              </label>
            ))}
            {(errors.agreement_data || errors.agreement_terms) && (
              <p className="text-red-400 text-[11px] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Semua persetujuan wajib dicentang
              </p>
            )}
          </div>

          {/* Server Error */}
          {serverError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-400">{serverError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-sport-red to-sport-orange text-white font-black uppercase text-sm rounded-2xl hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sport-orange/20"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Mendaftarkan...</>
            ) : (
              <><Store className="w-4 h-4" /> Daftar Sekarang</>
            )}
          </button>

          <p className="text-center text-xs text-brand-muted">
            Sudah punya akun?{' '}
            <a href="/umkm-login" className="text-sport-orange hover:text-sport-red font-bold transition-colors">
              Masuk di sini
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
