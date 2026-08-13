'use client'

import React, { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Activity, LogOut, User, CreditCard,
  Trophy, Clock, CheckCircle, AlertCircle,
  TrendingUp, ExternalLink, Receipt, Settings, Plus,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { useIndividualStore } from '@/lib/store/useIndividualStore'
import { getIndividualSessionAction } from '@/app/actions/individual-dashboard'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { trackMetaPixelPurchase } from '@/lib/utils/meta-pixel'
import { signOutIndividual } from '@/app/actions/individual-auth'
import { createIndividualPayment, simulateIndividualPaymentSuccess, syncXenditIndividualPaymentStatus } from '@/app/actions/individual-payments'
import { IndividualParticipant, IndividualPayment, TOPSELL_RUN_EVENT, priceForCategory } from '@/lib/types'
import { usePackagesSettings, resolveCategoryLabel } from '@/lib/hooks/usePackagesSettings'
import type { Family, FamilyParticipant, FamilyPayment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ParticipantDetailModal } from '@/components/dashboard/ParticipantDetailModal'
import { EReceiptModal } from '@/components/dashboard/EReceiptModal'
import { IndividualProfileModal } from '@/components/dashboard/IndividualProfileModal'
import { ReRegisterModal } from '@/components/dashboard/ReRegisterModal'
import { Dialog } from '@/components/ui/dialog'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

type CheckoutPayload = {
  paymentId: string
  registrationId: string
  checkoutUrl: string | null
  xenditSessionId: string | null
  isDemoMode: boolean
  amount: number
  reference: string
  participantCount: number
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, individual, participants, registrations, payments, isLoading, setUser, fetchIndividualData, getStats, clearStore } = useIndividualStore()
  const packages = usePackagesSettings()

  const [selectedParticipant, setSelectedParticipant] = useState<IndividualParticipant | null>(null)
  const [receiptData, setReceiptData] = useState<{ payment: IndividualPayment; participants: IndividualParticipant[] } | null>(null)
  const [checkoutPayload, setCheckoutPayload] = useState<CheckoutPayload | null>(null)
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false)
  const [paymentSimLoading, setPaymentSimLoading] = useState(false)
  const [paymentSyncLoading, setPaymentSyncLoading] = useState(false)
  const [paymentSyncMessage, setPaymentSyncMessage] = useState('')
  const [hasOpenedCheckout, setHasOpenedCheckout] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid' | 'expired'>('all')
  const [hasCelebratedPayment, setHasCelebratedPayment] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isReRegisterModalOpen, setIsReRegisterModalOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const session = await getIndividualSessionAction()
      if (session.user) {
        setUser(session.user)
        await fetchIndividualData()
        try {
          const { payments } = useIndividualStore.getState()
          const pending = payments.filter((p) => p.status === 'pending' && p.payment_reference)
          if (pending.length > 0) {
            await Promise.all(pending.map((p) => syncXenditIndividualPaymentStatus(p.payment_reference)))
            await fetchIndividualData(true)
          }
        } catch (err) {
          console.error('Failed to auto-sync payments:', err)
        }
      } else {
        router.push('/login')
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const interval = setInterval(() => fetchIndividualData(true), 15000)
    return () => clearInterval(interval)
  }, [fetchIndividualData, user?.id])

  useEffect(() => {
    if (!user?.id || hasCelebratedPayment) return
    const paymentResult = searchParams.get('payment')
    const paymentRef = searchParams.get('ref')
    if (!paymentResult) return
    if (paymentResult !== 'success') {
      router.replace('/individu-dashboard')
      return
    }

    let cancelled = false
    let attempts = 0
    const poll = async () => {
      attempts += 1
      if (paymentRef) await syncXenditIndividualPaymentStatus(paymentRef)
      await fetchIndividualData(true)
      const { payments } = useIndividualStore.getState()
      const hasPaid = paymentRef
        ? payments.some((p) => p.status === 'paid' && p.payment_reference === paymentRef)
        : payments.some((p) => p.status === 'paid')
      if (!cancelled && hasPaid && !hasCelebratedPayment) {
        confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 }, colors: ['#ff2a44', '#ff6a00', '#ffffff'] })
        setHasCelebratedPayment(true)
        router.replace('/individu-dashboard')
      }
      if (!cancelled && attempts >= 12) router.replace('/individu-dashboard')
    }
    const intervalId = setInterval(poll, 2000)
    poll()
    return () => { cancelled = true; clearInterval(intervalId) }
  }, [fetchIndividualData, hasCelebratedPayment, router, searchParams, user?.id])

  const stats = getStats()

  const handleLogout = async () => {
    await signOutIndividual()
    clearStore()
    router.push('/login')
  }

  const handleCheckout = async () => {
    setIsCheckoutLoading(true)
    try {
      const res = await createIndividualPayment()
      if (!res.success) return alert(res.error)
      setPaymentSyncMessage('')
      setHasOpenedCheckout(false)
      setCheckoutPayload(res)
    } finally {
      setIsCheckoutLoading(false)
    }
  }

  const handleSimulatePayment = async () => {
    if (!checkoutPayload) return
    setPaymentSimLoading(true)
    try {
      const res = await simulateIndividualPaymentSuccess(checkoutPayload.paymentId)
      if (res.error) return alert(res.error)
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 }, colors: ['#ff2a44', '#ff6a00', '#ffffff'] })
      trackMetaPixelPurchase(checkoutPayload.amount, 'IDR', {
        content_ids: [checkoutPayload.reference],
        content_type: 'product',
        num_items: checkoutPayload.participantCount,
      })
      if (user?.id) await fetchIndividualData()
      setCheckoutPayload(null)
      setHasOpenedCheckout(false)
      setPaymentSyncMessage('')
    } finally {
      setPaymentSimLoading(false)
    }
  }

  const refreshPaymentStatus = useCallback(async (silent = false) => {
    if (!checkoutPayload || checkoutPayload.isDemoMode || !user?.id) return false
    if (!silent) { setPaymentSyncLoading(true); setPaymentSyncMessage('') }
    try {
      const res = await syncXenditIndividualPaymentStatus(checkoutPayload.reference)
      if (res.error) { if (!silent) setPaymentSyncMessage(res.error); return false }
      await fetchIndividualData(true)
      const { payments } = useIndividualStore.getState()
      const hasPaid = payments.some((p) => p.payment_reference === checkoutPayload.reference && p.status === 'paid')
      if (hasPaid) {
        if (!hasCelebratedPayment) {
          confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 }, colors: ['#ff2a44', '#ff6a00', '#ffffff'] })
          trackMetaPixelPurchase(checkoutPayload.amount, 'IDR', {
            content_ids: [checkoutPayload.reference], content_type: 'product', num_items: checkoutPayload.participantCount,
          })
          setHasCelebratedPayment(true)
        }
        setCheckoutPayload(null)
        setHasOpenedCheckout(false)
        setPaymentSyncMessage('')
        return true
      }
      if (!silent) setPaymentSyncMessage(`Status Xendit: ${res.status || 'belum terbayar'}. Coba cek lagi setelah pembayaran selesai.`)
      return false
    } finally {
      if (!silent) setPaymentSyncLoading(false)
    }
  }, [checkoutPayload, fetchIndividualData, hasCelebratedPayment, user?.id])

  useEffect(() => {
    if (!checkoutPayload || checkoutPayload.isDemoMode || !hasOpenedCheckout) return
    let cancelled = false
    const intervalId = setInterval(async () => { if (!cancelled) await refreshPaymentStatus(true) }, 5000)
    return () => { cancelled = true; clearInterval(intervalId) }
  }, [checkoutPayload, hasOpenedCheckout, refreshPaymentStatus])

  const handleOpenXenditCheckout = () => {
    if (!checkoutPayload?.checkoutUrl) return
    setHasOpenedCheckout(true)
    setPaymentSyncMessage('Menunggu pembayaran selesai. Status akan dicek otomatis setiap beberapa detik.')
    window.open(checkoutPayload.checkoutUrl, '_blank', 'noopener,noreferrer')
  }

  const filteredParticipants =
    activeTab === 'pending' ? participants.filter((p) => p.payment_status === 'pending')
    : activeTab === 'paid' ? participants.filter((p) => p.payment_status === 'paid')
    : activeTab === 'expired' ? participants.filter((p) => p.payment_status === 'expired' || p.payment_status === 'failed')
    : participants

  const pendingParticipants = participants.filter((p) => p.payment_status === 'pending')
  // Biaya per peserta: pakai registrasi pending kalau ada (checkout aktif), lalu registrasi
  // paid terakhir (harga yang benar-benar sudah dibayar), baru fallback ke map hardcoded.
  const activeReg = registrations.find((r) => r.status === 'pending') || registrations.find((r) => r.status === 'paid')
  const unitPrice = activeReg && activeReg.total_participants > 0
    ? Math.round(activeReg.total_amount / activeReg.total_participants)
    : priceForCategory(individual?.category)
  const checkoutTotal = pendingParticipants.length * unitPrice
  const categoryLabel = resolveCategoryLabel(packages, 'individual', individual?.category, unitPrice) || TOPSELL_RUN_EVENT.category

  if (isLoading) return <DashboardSkeleton />

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col text-foreground">
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none" />

      <header className="sports-glass sticky top-0 z-30 w-full border-b border-card-border px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-sport-red to-sport-orange rounded-lg">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">TOPSELL RUN 2026</p>
              <p className="text-xs font-black uppercase tracking-wide text-foreground hidden sm:block">
                {individual?.name || 'Dashboard Peserta Individu'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReRegisterModalOpen(true)}
              className="text-xs font-bold border-sport-orange/30 text-sport-orange hover:bg-sport-orange/10"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Daftar Kembali / Periode Baru
            </Button>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="p-2 bg-brand-gray border border-card-border text-brand-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={handleLogout} className="p-2 bg-brand-gray border border-card-border text-brand-muted hover:text-sport-red rounded-lg transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex flex-col gap-6 relative z-10">
        {/* STATS TILES */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Status Peserta', value: stats.paidParticipants > 0 ? 'Lunas' : 'Pending', icon: <User className="w-4 h-4 text-brand-muted" />, color: 'bg-brand-gray border-card-border' },
            { label: 'Sudah Lunas', value: stats.paidParticipants, icon: <Trophy className="w-4 h-4 text-green-400" />, color: 'bg-green-500/5 border-green-500/20', valueClass: 'text-green-400' },
            { label: 'Belum Bayar', value: stats.pendingParticipants, icon: <Clock className="w-4 h-4 text-amber-400" />, color: 'bg-amber-500/5 border-amber-500/20', valueClass: 'text-amber-400' },
            { label: 'Total Terbayar', value: formatCurrency(stats.totalAmountPaid), icon: <TrendingUp className="w-4 h-4 text-sport-orange" />, color: 'bg-sport-orange/5 border-sport-orange/20', valueClass: 'text-sport-orange text-base' },
          ].map((s, i) => (
            <div key={i} className={`bg-card-bg border ${s.color} rounded-xl p-4 flex items-center justify-between gap-3`}>
              <div>
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-1">{s.label}</p>
                <p className={`text-xl font-black ${s.valueClass || 'text-foreground'}`}>{s.value}</p>
              </div>
              <div className={`p-2.5 rounded-lg border ${s.color}`}>{s.icon}</div>
            </div>
          ))}
        </div>

        {/* RE-REGISTER ALERT BANNER (If all expired / no paid or pending) */}
        {stats.pendingParticipants === 0 && stats.paidParticipants === 0 && (
          <div className="bg-card-bg border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-500/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-300 uppercase">Status Pendaftaran Expired / Ingin Daftar Periode Baru</p>
                <p className="text-[11px] text-brand-muted mt-0.5">
                  Tagihan sebelumnya telah kadaluarsa atau Anda ingin mendaftar di periode/kategori baru.
                </p>
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={() => setIsReRegisterModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Daftar Kembali Sekarang
            </Button>
          </div>
        )}

        {/* EVENT INFO STRIP */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-linear-to-br from-sport-red to-sport-orange rounded-lg shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Event Aktif</p>
              <p className="text-sm font-black uppercase text-foreground">{TOPSELL_RUN_EVENT.name}</p>
              <p className="text-[10px] text-brand-muted font-medium">
                {TOPSELL_RUN_EVENT.location} • 18 Oktober 2026 • {categoryLabel}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Biaya</p>
            <p className="text-base font-black text-foreground">{formatCurrency(unitPrice)}</p>
          </div>
        </div>

        {/* PAYMENT */}
        <div className="bg-card-bg border border-card-border rounded-xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sport-orange/10 border border-sport-orange/20 rounded-lg shrink-0">
              <CreditCard className="w-4 h-4 text-sport-orange" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Pembayaran Individu</p>
              <p className="text-sm font-black uppercase text-foreground">Selesaikan pembayaran Anda</p>
              <p className="text-[10px] text-brand-muted font-medium mt-1">
                {pendingParticipants.length > 0
                  ? 'Lakukan pembayaran via Xendit VA / QRIS untuk mengaktifkan QR Race Pass.'
                  : 'Pembayaran Anda sudah lunas.'}
              </p>
            </div>
          </div>
          <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 sm:items-center lg:items-end xl:items-center">
            <div className="text-left sm:text-right">
              <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider">Total Tagihan</p>
              <p className="text-xl font-black text-foreground">{formatCurrency(checkoutTotal)}</p>
            </div>
            <Button
              variant="primary"
              className="w-full sm:w-auto px-8 py-3.5 text-xs font-black"
              isLoading={isCheckoutLoading}
              onClick={handleCheckout}
              disabled={pendingParticipants.length === 0 && !payments.some(p => p.status === 'pending')}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              {payments.some(p => p.status === 'pending') ? 'Lanjutkan Pembayaran' : 'Bayar Sekarang'}
            </Button>
          </div>
        </div>

        {/* PARTICIPANT TABLE */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="px-4 sm:px-6 py-4 border-b border-card-border flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-2">
              {(['all', 'pending', 'paid', 'expired'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === tab ? 'bg-sport-orange/15 border border-sport-orange text-sport-orange' : 'text-brand-muted hover:text-foreground'
                  }`}
                >
                  {tab === 'all' ? `Semua (${participants.length})`
                    : tab === 'pending' ? `Pending (${stats.pendingParticipants})`
                    : tab === 'paid' ? `Lunas (${stats.paidParticipants})`
                    : `Kadaluarsa (${participants.filter((p) => p.payment_status === 'expired' || p.payment_status === 'failed').length})`}
                </button>
              ))}
            </div>
          </div>

          {filteredParticipants.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-4">
              <div className="p-4 bg-brand-gray border border-card-border rounded-full">
                <User className="w-8 h-8 text-brand-muted" />
              </div>
              <h4 className="text-sm font-bold text-foreground uppercase">Belum ada data peserta</h4>
            </div>
          )}

          {filteredParticipants.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-card-border bg-brand-dark/20">
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted">Peserta / BIB</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted hidden md:table-cell">Gender</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Jersey</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Status</th>
                    <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-wider text-brand-muted text-center">Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((p) => {
                    const isParticipantTesting = p.payment_status === 'testing' || payments.some((pay) => pay.registration_id === p.registration_id && pay.status === 'testing')
                    const statusKey = isParticipantTesting ? 'testing' : p.payment_status

                    return (
                      <tr key={p.id} className="border-b border-card-border hover:bg-brand-gray/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-bold text-foreground">{p.full_name}</p>
                          <p className="text-[10px] text-brand-muted">{p.email}</p>
                          <p className="text-[10px] font-bold text-sport-orange uppercase">BIB: {p.bib_name}</p>
                        </td>
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-[10px] font-bold text-brand-muted">{p.gender === 'male' ? '♂ L' : '♀ P'}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="text-xs font-black bg-brand-dark border border-card-border px-2 py-0.5 rounded text-foreground">{p.tshirt_size}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <Badge variant={statusKey === 'testing' ? 'warning' : statusKey === 'paid' ? 'success' : statusKey === 'failed' ? 'danger' : statusKey === 'expired' ? 'neutral' : 'warning'}>
                            {statusKey.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {statusKey === 'paid' || statusKey === 'testing' ? (
                            <button
                              onClick={() => setSelectedParticipant(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-sport-orange/10 hover:bg-sport-orange/20 border border-sport-orange/25 text-sport-orange rounded text-[9px] font-black uppercase cursor-pointer active:scale-95 transition-all"
                            >
                              <User className="w-3 h-3" />Detail
                            </button>
                          ) : (
                            <span className="text-[9px] text-brand-muted font-bold uppercase">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAYMENT HISTORY */}
        {payments.length > 0 && (
          <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-card-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg shrink-0">
                  <CreditCard className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Riwayat Pembayaran</p>
                  <p className="text-sm font-black uppercase text-foreground">Transaksi Anda</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-card-border">
              {payments.map((payment) => {
                const paymentParticipants = participants.filter(p => p.registration_id === payment.registration_id)
                return (
                  <div key={payment.id} className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-brand-gray/10">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={payment.status === 'paid' ? 'success' : payment.status === 'failed' ? 'danger' : payment.status === 'expired' ? 'neutral' : 'warning'}>
                          {payment.status.toUpperCase()}
                        </Badge>
                        <p className="text-[10px] font-black text-brand-muted uppercase">Ref: {payment.payment_reference}</p>
                      </div>
                      <p className="text-[10px] text-brand-muted">{formatDate(payment.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-black text-sport-orange">{formatCurrency(payment.amount)}</p>
                      {payment.status === 'paid' && (
                        <Button variant="outline" size="sm" className="text-[10px]" onClick={() => setReceiptData({ payment, participants: paymentParticipants })}>
                          <Receipt className="w-3 h-3 mr-1.5" />E-Receipt
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      <ParticipantDetailModal
        participant={selectedParticipant as unknown as FamilyParticipant | null}
        isOpen={!!selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
      />

      {receiptData && individual && (
        <EReceiptModal
          isOpen={true}
          onClose={() => setReceiptData(null)}
          payment={receiptData.payment as unknown as FamilyPayment}
          participants={receiptData.participants as unknown as FamilyParticipant[]}
          payer={{ ...individual, family_code: individual.individual_code } as unknown as Family}
          type="individual"
        />
      )}

      <IndividualProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <ReRegisterModal
        isOpen={isReRegisterModalOpen}
        onClose={() => setIsReRegisterModalOpen(false)}
        packageKey="individual"
        userProfile={individual}
        existingParticipants={participants}
        onSuccess={() => fetchIndividualData(true)}
      />

      {/* PAYMENT DIALOG */}
      <Dialog
        isOpen={!!checkoutPayload}
        onClose={() => { setCheckoutPayload(null); setHasOpenedCheckout(false); setPaymentSyncMessage('') }}
        title="Pembayaran Individu"
        className="max-w-md"
      >
        {checkoutPayload && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-3 bg-sport-orange/10 border border-sport-orange/20 rounded-lg p-4">
              <AlertCircle className="w-4 h-4 text-sport-orange shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-foreground uppercase">{checkoutPayload.isDemoMode ? 'Demo Mode Aktif' : 'Xendit Checkout'}</p>
                <p className="text-[10px] text-brand-muted mt-1 leading-relaxed">
                  {checkoutPayload.isDemoMode
                    ? 'XENDIT_SECRET_KEY belum diisi. Gunakan simulasi di bawah untuk menguji alur pembayaran.'
                    : 'Lanjutkan ke halaman Xendit untuk membayar menggunakan Virtual Account atau QRIS.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-y border-card-border py-4">
              {[
                { label: 'Referensi', value: checkoutPayload.reference },
                { label: 'Nama', value: individual?.name },
                { label: 'Kategori', value: categoryLabel },
                { label: 'Metode', value: 'Xendit VA / QRIS' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between items-center text-xs">
                  <span className="font-bold text-brand-muted uppercase">{r.label}</span>
                  <span className="font-bold text-foreground">{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center text-sm pt-2 border-t border-card-border/50">
                <span className="font-black text-foreground uppercase">Total Tagihan</span>
                <span className="font-black text-sport-orange">{formatCurrency(checkoutPayload.amount)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {checkoutPayload.isDemoMode ? (
                <Button variant="primary" className="w-full py-4 font-black text-xs" isLoading={paymentSimLoading} onClick={handleSimulatePayment}>
                  <CheckCircle className="w-4 h-4 mr-2" />Simulasikan Pembayaran Lunas
                </Button>
              ) : (
                <>
                  <Button variant="primary" className="w-full py-4 font-black text-xs" onClick={handleOpenXenditCheckout} disabled={!checkoutPayload.checkoutUrl}>
                    <ExternalLink className="w-4 h-4 mr-2" />Bayar VA / QRIS via Xendit
                  </Button>
                  <Button variant="ghost" className="w-full text-xs" isLoading={paymentSyncLoading} onClick={() => refreshPaymentStatus(false)}>
                    <CheckCircle className="w-4 h-4 mr-2" />Cek Status Pembayaran
                  </Button>
                  {paymentSyncMessage && <p className="text-[10px] text-brand-muted leading-relaxed text-center">{paymentSyncMessage}</p>}
                </>
              )}
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => { setCheckoutPayload(null); setHasOpenedCheckout(false); setPaymentSyncMessage('') }}
                disabled={paymentSimLoading || paymentSyncLoading}
              >
                Batal
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

export default function IndividuDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      <DashboardContent />
    </Suspense>
  )
}
