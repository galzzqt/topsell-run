'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, LogOut, User, Trophy, AlertCircle, Settings, Plus } from 'lucide-react'
import { useInvitationStore } from '@/lib/store/useInvitationStore'
import { getInvitationSessionAction } from '@/app/actions/invitation-dashboard'
import { signOutInvitation } from '@/app/actions/invitation-auth'
import { InvitationParticipant, TOPSELL_RUN_EVENT } from '@/lib/types'
import { usePackagesSettings, resolveCategoryLabel } from '@/lib/hooks/usePackagesSettings'
import type { FamilyParticipant } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ParticipantDetailModal } from '@/components/dashboard/ParticipantDetailModal'
import { InvitationProfileModal } from '@/components/dashboard/InvitationProfileModal'
import { ReRegisterModal } from '@/components/dashboard/ReRegisterModal'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

function DashboardContent() {
  const router = useRouter()
  const { user, invitation, participants, registrations, payments, isLoading, setUser, fetchInvitationData, getStats, clearStore } = useInvitationStore()
  const packages = usePackagesSettings()

  const [selectedParticipant, setSelectedParticipant] = useState<InvitationParticipant | null>(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isReRegisterModalOpen, setIsReRegisterModalOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const session = await getInvitationSessionAction()
      if (session.user) {
        setUser(session.user)
        await fetchInvitationData()
      } else {
        router.push('/login')
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const interval = setInterval(() => fetchInvitationData(true), 15000)
    return () => clearInterval(interval)
  }, [fetchInvitationData, user?.id])

  const stats = getStats()

  const handleLogout = async () => {
    await signOutInvitation()
    clearStore()
    router.push('/login')
  }

  // Invitation tidak berbayar: harga tidak ditampilkan, label kategori saja.
  const activeReg = registrations.find((r) => r.status === 'paid') || registrations.find((r) => r.status === 'pending')
  const unitPrice = activeReg && activeReg.total_participants > 0 ? Math.round(activeReg.total_amount / activeReg.total_participants) : 0
  const categoryLabel = resolveCategoryLabel(packages, 'invitation', invitation?.category, unitPrice) || TOPSELL_RUN_EVENT.category

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
                {invitation?.name || 'Dashboard Peserta Invitation'}
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
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Status Peserta', value: stats.paidParticipants > 0 ? 'Aktif' : 'Pending', icon: <User className="w-4 h-4 text-brand-muted" />, color: 'bg-brand-gray border-card-border' },
            { label: 'Peserta Aktif', value: stats.paidParticipants, icon: <Trophy className="w-4 h-4 text-green-400" />, color: 'bg-green-500/5 border-green-500/20', valueClass: 'text-green-400' },
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
                  Pendaftaran sebelumnya telah kadaluarsa atau Anda ingin mendaftar di periode/kategori baru.
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
        </div>

        {/* PARTICIPANT TABLE */}
        <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg flex flex-col">
          {participants.length === 0 && (
            <div className="py-16 flex flex-col items-center gap-4">
              <div className="p-4 bg-brand-gray border border-card-border rounded-full">
                <User className="w-8 h-8 text-brand-muted" />
              </div>
              <h4 className="text-sm font-bold text-foreground uppercase">Belum ada data peserta</h4>
            </div>
          )}

          {participants.length > 0 && (
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
                  {participants.map((p) => {
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
                            {statusKey === 'paid' ? 'AKTIF' : statusKey.toUpperCase()}
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

      </main>

      {/* MODALS */}
      <ParticipantDetailModal
        participant={selectedParticipant as unknown as FamilyParticipant | null}
        isOpen={!!selectedParticipant}
        onClose={() => setSelectedParticipant(null)}
      />

      <InvitationProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      <ReRegisterModal
        isOpen={isReRegisterModalOpen}
        onClose={() => setIsReRegisterModalOpen(false)}
        packageKey="invitation"
        userProfile={invitation}
        existingParticipants={participants}
        onSuccess={() => fetchInvitationData(true)}
      />

    </div>
  )
}

export default function InvitationDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-brand-dark" />}>
      <DashboardContent />
    </Suspense>
  )
}
