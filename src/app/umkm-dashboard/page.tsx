'use client'

import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  Store, LogOut, Clock, CheckCircle, XCircle, CreditCard,
  User, Phone, Mail, MapPin, Briefcase, Tag, AlertCircle,
  Loader2, RefreshCw, ExternalLink, Settings, Activity, Globe, ImagePlus,
} from 'lucide-react'
import { getUmkmSessionAction, fetchUmkmDashboardDataAction } from '@/app/actions/umkm-dashboard'
import { createUmkmPayment, pollUmkmPaymentStatus } from '@/app/actions/umkm-payments'
import { signOutUmkm } from '@/app/actions/umkm-auth'
import type { UmkmRegistration, UmkmPayment } from '@/lib/types'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Persetujuan Admin',
  approved: 'Disetujui — Silakan Bayar',
  rejected: 'Ditolak',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount)
}

function PaymentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    paid: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
    expired: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  }
  const labels: Record<string, string> = {
    pending: 'Menunggu Pembayaran',
    paid: 'Lunas ✓',
    failed: 'Gagal',
    expired: 'Kadaluarsa',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  )
}

function UmkmDashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [umkm, setUmkm] = useState<UmkmRegistration | null>(null)
  const [payment, setPayment] = useState<UmkmPayment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPaymentLoading, setIsPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')

  const loadData = useCallback(async () => {
    const result = await fetchUmkmDashboardDataAction()
    if ('error' in result) { router.push('/umkm-login'); return }
    setUmkm(result.umkm)
    setPayment(result.payment ?? null)
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    const init = async () => {
      const session = await getUmkmSessionAction()
      if (!session.user) { router.push('/umkm-login'); return }
      await loadData()
    }
    init()
  }, [router, loadData])

  useEffect(() => {
    const paymentResult = searchParams.get('payment')
    if (paymentResult === 'success') {
      setPaymentSuccess('Pembayaran berhasil! Terima kasih.')
      loadData()
    } else if (paymentResult === 'cancelled') {
      setPaymentError('Pembayaran dibatalkan. Klik tombol bayar untuk melanjutkan.')
    }
  }, [searchParams, loadData])

  useEffect(() => {
    if (payment && payment.status === 'pending') {
      const interval = setInterval(() => {
        loadData()
      }, 4000)
      return () => clearInterval(interval)
    }
  }, [payment?.status, loadData])

  const handlePayment = async () => {
    setIsPaymentLoading(true)
    setPaymentError('')
    const result = await createUmkmPayment()
    setIsPaymentLoading(false)

    if (result.error) { setPaymentError(result.error); return }
    if ('free' in result && result.free) {
      setPaymentSuccess('Pembayaran gratis (voucher penuh) berhasil! Selamat datang sebagai tenant UMKM.')
      await loadData()
      return
    }
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    const pollResult = await pollUmkmPaymentStatus()
    if (pollResult.payment) setPayment(pollResult.payment)
    await loadData()
  }

  const handleLogout = async () => {
    await signOutUmkm()
    router.push('/umkm-login')
  }

  if (isLoading) return <DashboardSkeleton />

  const isFree = (umkm?.payment_amount ?? 500000) <= 0
  const isPaid = payment?.status === 'paid' || umkm?.payment_status === 'paid' || isFree
  const status = umkm?.status || 'pending'
  const canPay = status === 'approved' && !isPaid && !isFree

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col text-foreground">
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sports-glass sticky top-0 z-30 w-full border-b border-card-border px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-sport-red to-sport-orange rounded-lg">
              <Store className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">TOPSELL RUN 2026</p>
              <p className="text-xs font-black uppercase tracking-wide text-foreground hidden sm:block">
                {umkm?.name || 'Dashboard UMKM'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className="p-2 bg-brand-gray border border-card-border text-brand-muted hover:text-foreground rounded-lg transition-colors cursor-pointer">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="p-2 bg-brand-gray border border-card-border text-brand-muted hover:text-sport-red rounded-lg transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full flex flex-col gap-5 relative z-10">

        {/* Payment success/error messages */}
        {paymentSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <p className="text-sm text-green-400 font-bold">{paymentSuccess}</p>
          </div>
        )}
        {paymentError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{paymentError}</p>
          </div>
        )}

        {/* STATUS CARD */}
        <div className={`bg-card-bg border rounded-2xl p-6 ${
          status === 'approved' ? 'border-green-500/20' :
          status === 'rejected' ? 'border-red-500/20' :
          'border-amber-500/20'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl border shrink-0 ${
                status === 'approved' ? 'bg-green-500/10 border-green-500/20' :
                status === 'rejected' ? 'bg-red-500/10 border-red-500/20' :
                'bg-amber-500/10 border-amber-500/20'
              }`}>
                {status === 'approved' ? (
                  <CheckCircle className="w-6 h-6 text-green-400" />
                ) : status === 'rejected' ? (
                  <XCircle className="w-6 h-6 text-red-400" />
                ) : (
                  <Clock className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Status Pendaftaran</p>
                  {isFree && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/25 text-green-400">
                      Lunas (Gratis)
                    </span>
                  )}
                  {!isFree && isPaid && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/25 text-green-400">
                      Lunas
                    </span>
                  )}
                </div>

                <p className={`text-xl font-black uppercase ${
                  status === 'approved' ? 'text-green-400' :
                  status === 'rejected' ? 'text-red-400' :
                  'text-amber-400'
                }`}>
                  {status === 'approved' ? 'Disetujui & Aktif ✓' :
                   status === 'rejected' ? 'Pendaftaran Ditolak' :
                   'Menunggu Persetujuan Admin'}
                </p>

                {/* Deskripsi status */}
                {status === 'pending' && isFree && (
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Pendaftaran tenant UMKM Anda menggunakan voucher <strong>GRATIS (Rp 0)</strong> dan berstatus <strong>Lunas</strong>. Pendaftaran saat ini sedang menunggu proses approval dari Admin sebelum resmi aktif.
                  </p>
                )}
                {status === 'pending' && !isFree && (
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Pendaftaran Anda sedang direview oleh admin. Tombol pembayaran akan aktif setelah pendaftaran Anda disetujui.
                  </p>
                )}
                {status === 'approved' && isFree && (
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Selamat! Pendaftaran tenant UMKM Anda telah disetujui oleh Admin. Usaha Anda resmi terdaftar sebagai tenant di event Topsell Run 2026.
                  </p>
                )}
                {status === 'approved' && !isFree && !isPaid && (
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Pendaftaran Anda telah disetujui oleh Admin! Silakan selesaikan pembayaran untuk mengaktifkan akun pendaftaran Anda.
                  </p>
                )}
                {status === 'approved' && !isFree && isPaid && (
                  <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                    Pembayaran Anda telah diterima dan pendaftaran tenant UMKM telah resmi aktif di Topsell Run 2026.
                  </p>
                )}
                {status === 'rejected' && (
                  <p className="text-xs text-red-400 mt-1">
                    {umkm?.status_note ? `Catatan penolakan: ${umkm.status_note}` : 'Pendaftaran tidak memenuhi kriteria event.'}
                  </p>
                )}
              </div>
            </div>

            {/* Sisi Kanan: Nominal & Tombol Pembayaran / Status Badge */}
            <div className="sm:shrink-0 text-left sm:text-right flex flex-col sm:items-end justify-center pt-2 sm:pt-0 border-t sm:border-t-0 border-card-border/60">
              <p className="text-[9px] font-black uppercase tracking-widest text-brand-muted mb-0.5">Biaya Pendaftaran</p>
              {isFree ? (
                <div>
                  <p className="text-2xl font-black text-green-400">GRATIS</p>
                  {umkm?.voucher_code && (
                    <p className="text-[10px] text-green-400 flex items-center sm:justify-end gap-1 mt-0.5 font-bold">
                      <Tag className="w-3 h-3" /> Voucher: {umkm.voucher_code}
                    </p>
                  )}
                  <div className="mt-2.5">
                    {status === 'approved' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/25 text-green-400 rounded-xl text-xs font-black uppercase">
                        <CheckCircle className="w-3.5 h-3.5" /> Lunas &amp; Disetujui
                      </span>
                    ) : status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/25 text-red-400 rounded-xl text-xs font-black uppercase">
                        <XCircle className="w-3.5 h-3.5" /> Ditolak
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded-xl text-xs font-black uppercase">
                        <Clock className="w-3.5 h-3.5" /> Menunggu Approval
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  {(umkm?.voucher_discount ?? 0) > 0 && (
                    <p className="text-xs text-brand-muted line-through">Rp 500.000</p>
                  )}
                  <p className="text-2xl font-black text-foreground">{formatRupiah(umkm?.payment_amount ?? 500000)}</p>
                  {umkm?.voucher_code && (
                    <p className="text-[10px] text-green-400 flex items-center sm:justify-end gap-1 mt-0.5 font-bold">
                      <Tag className="w-3 h-3" /> Voucher: {umkm.voucher_code}
                    </p>
                  )}

                  <div className="mt-2.5">
                    {canPay ? (
                      <button
                        onClick={handlePayment}
                        disabled={isPaymentLoading}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sport-red to-sport-orange text-white font-black uppercase text-xs rounded-xl hover:opacity-90 disabled:opacity-60 transition-all shadow-lg shadow-sport-orange/20 whitespace-nowrap cursor-pointer"
                      >
                        {isPaymentLoading ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</>
                        ) : (
                          <><CreditCard className="w-4 h-4" /> Bayar Sekarang</>
                        )}
                      </button>
                    ) : isPaid ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/25 text-green-400 rounded-xl text-xs font-black uppercase">
                        <CheckCircle className="w-3.5 h-3.5" /> Pembayaran Lunas
                      </span>
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-4 py-2 bg-brand-gray border border-card-border text-brand-muted text-xs font-black uppercase rounded-xl cursor-not-allowed opacity-60"
                      >
                        <Clock className="w-3.5 h-3.5" /> Menunggu Approval
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Info (if paid) */}
        {isPaid && payment && (
          <div className="bg-card-bg border border-green-500/20 rounded-2xl p-6">
            <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange mb-4 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5" /> Detail Pembayaran
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Status</p>
                <PaymentStatusBadge status={payment.status} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Nominal</p>
                <p className="text-sm font-black text-foreground">{payment.amount === 0 ? 'GRATIS' : formatRupiah(payment.amount)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Metode</p>
                <p className="text-sm font-bold text-foreground capitalize">{payment.payment_method || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Tanggal</p>
                <p className="text-sm font-bold text-foreground">
                  {payment.paid_at ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(payment.paid_at)) : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending payment with checkout URL */}
        {payment && payment.status === 'pending' && payment.checkout_url && !isPaid && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black text-amber-400 mb-1">Ada invoice pembayaran yang belum selesai</p>
              <p className="text-xs text-brand-muted">Ref: {payment.payment_reference}</p>
            </div>
            <a
              href={payment.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-black font-black uppercase text-xs rounded-lg hover:bg-amber-400 transition-colors whitespace-nowrap"
            >
              Lanjutkan Bayar <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Profil UMKM */}
        {umkm && (
          <div className="bg-card-bg border border-card-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-card-border flex items-center gap-3">
              <div className="p-2 bg-sport-orange/10 border border-sport-orange/20 rounded-lg">
                <Store className="w-4 h-4 text-sport-orange" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Profil Usaha</p>
                <p className="text-sm font-black uppercase text-foreground">{umkm.name}</p>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-xs">
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Person in Charge</p>
                  <p className="text-foreground font-bold">{umkm.pic_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Briefcase className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Bidang Usaha</p>
                  <p className="text-foreground font-bold">{umkm.business_field}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">No. WhatsApp</p>
                  <p className="text-foreground font-bold">{umkm.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Email</p>
                  <p className="text-foreground font-bold">{umkm.email}</p>
                </div>
              </div>
              {umkm.social_media && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <Globe className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Media Sosial</p>
                    <a
                      href={umkm.social_media.startsWith('http') ? umkm.social_media : `https://${umkm.social_media}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sport-orange hover:text-sport-red font-bold flex items-center gap-1 transition-colors"
                    >
                      {umkm.social_media} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
              {umkm.provinsi && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Lokasi &amp; Alamat</p>
                    <p className="text-foreground font-bold">{[umkm.kecamatan, umkm.kota, umkm.provinsi].filter(Boolean).join(', ')}</p>
                    {umkm.address && (
                      <p className="text-xs text-brand-muted mt-1 leading-relaxed">{umkm.address}</p>
                    )}
                  </div>
                </div>
              )}
              {umkm.description && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <Activity className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Deskripsi</p>
                    <p className="text-foreground leading-relaxed">{umkm.description}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-brand-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-[9px] font-black uppercase text-brand-muted mb-0.5">Kode UMKM</p>
                  <p className="text-sport-orange font-black">{umkm.umkm_code}</p>
                </div>
              </div>

              {/* Photo Gallery */}
              {Array.isArray(umkm.photo_urls) && umkm.photo_urls.length > 0 && (
                <div className="sm:col-span-2 pt-3 border-t border-card-border/60">
                  <p className="text-[9px] font-black uppercase text-sport-orange mb-2 flex items-center gap-1.5">
                    <ImagePlus className="w-3 h-3" /> Foto Usaha / Produk ({umkm.photo_urls.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {umkm.photo_urls.map((url, idx) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative rounded-xl overflow-hidden border border-card-border bg-brand-dark/40 aspect-video group block"
                      >
                        <Image
                          src={url}
                          alt={`Foto UMKM ${idx + 1}`}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ExternalLink className="w-4 h-4 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Info Event */}
        <div className="bg-card-bg border border-card-border rounded-2xl p-5 flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-sport-red to-sport-orange rounded-xl shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Event</p>
            <p className="text-sm font-black uppercase text-foreground">TOPSELL RUN 2026</p>
            <p className="text-[10px] text-brand-muted">Sunrise Mall, Mojokerto • 18 Oktober 2026</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function UmkmDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <UmkmDashboardContent />
    </Suspense>
  )
}
