'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Activity, LogOut, User, Settings,
  Clock, CheckCircle, XCircle, AtSign, Music2, Link as LinkIcon, Watch, Banknote,
} from 'lucide-react'
import { usePacerStore } from '@/lib/store/usePacerStore'
import { getPacerSessionAction } from '@/app/actions/pacer-dashboard'
import { signOutPacer } from '@/app/actions/pacer-auth'
import { TOPSELL_RUN_EVENT } from '@/lib/types'
import { PacerProfileModal } from '@/components/dashboard/PacerProfileModal'
import { DashboardSkeleton } from '@/components/ui/Skeleton'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu Review',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export default function PacerDashboardPage() {
  const router = useRouter()
  const { pacer, participant, isLoading, setUser, fetchPacerData, clearStore } = usePacerStore()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  useEffect(() => {
    const init = async () => {
      const session = await getPacerSessionAction()
      if (session.user) {
        setUser(session.user)
        await fetchPacerData()
      } else {
        router.push('/login')
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await signOutPacer()
    clearStore()
    router.push('/login')
  }

  if (isLoading) return <DashboardSkeleton />

  const status = pacer?.status || 'pending'

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
                {pacer?.name || 'Dashboard Pacer'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
        {/* STATUS CARD */}
        <div
          className={`bg-card-bg border rounded-xl p-5 flex items-center gap-4 ${
            status === 'approved' ? 'border-green-500/20' : status === 'rejected' ? 'border-sport-red/20' : 'border-amber-500/20'
          }`}
        >
          <div
            className={`p-3 rounded-lg border shrink-0 ${
              status === 'approved'
                ? 'bg-green-500/10 border-green-500/20'
                : status === 'rejected'
                ? 'bg-sport-red/10 border-sport-red/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }`}
          >
            {status === 'approved' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : status === 'rejected' ? (
              <XCircle className="w-5 h-5 text-sport-red" />
            ) : (
              <Clock className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Status Pendaftaran Pacer</p>
            <p
              className={`text-lg font-black uppercase ${
                status === 'approved' ? 'text-green-400' : status === 'rejected' ? 'text-sport-red' : 'text-amber-400'
              }`}
            >
              {STATUS_LABEL[status] || status}
            </p>
            {status === 'rejected' && pacer?.status_note && (
              <p className="text-[10px] text-brand-muted mt-1">Catatan: {pacer.status_note}</p>
            )}
            {status === 'pending' && (
              <p className="text-[10px] text-brand-muted mt-1">Pendaftaran Anda sedang direview oleh panitia.</p>
            )}
          </div>
        </div>

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
                {TOPSELL_RUN_EVENT.location} • 18 Oktober 2026 • Kategori {pacer?.category || '-'}
              </p>
            </div>
          </div>
        </div>

        {/* BIODATA */}
        {participant && (
          <div className="bg-card-bg border border-card-border rounded-xl overflow-hidden shadow-lg flex flex-col">
            <div className="px-4 sm:px-6 py-4 border-b border-card-border flex items-center gap-3">
              <div className="p-2 bg-sport-orange/10 border border-sport-orange/20 rounded-lg shrink-0">
                <User className="w-4 h-4 text-sport-orange" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-sport-orange">Biodata</p>
                <p className="text-sm font-black uppercase text-foreground">{participant.full_name}</p>
              </div>
            </div>
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Nama BIB</span>{participant.bib_name}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Usia</span>{participant.age ?? '-'} tahun</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Ukuran Jersey</span>{participant.tshirt_size}</div>
              <div><span className="text-brand-muted font-bold uppercase text-[9px] block mb-0.5">Golongan Darah</span>{participant.blood_type || '-'}</div>
              <div className="flex items-center gap-1.5"><AtSign className="w-3 h-3 text-brand-muted" /><span className="text-brand-muted font-bold uppercase text-[9px]">Instagram:</span>{participant.sosmed_instagram || '-'}</div>
              <div className="flex items-center gap-1.5"><Music2 className="w-3 h-3 text-brand-muted" /><span className="text-brand-muted font-bold uppercase text-[9px]">TikTok:</span>{participant.sosmed_tiktok || '-'}</div>
              <div className="flex items-center gap-1.5"><LinkIcon className="w-3 h-3 text-brand-muted" /><span className="text-brand-muted font-bold uppercase text-[9px]">Strava:</span>{participant.strava_username || '-'}</div>
              <div className="flex items-center gap-1.5"><Watch className="w-3 h-3 text-brand-muted" /><span className="text-brand-muted font-bold uppercase text-[9px]">Smartwatch:</span>{participant.has_smartwatch === 'yes' ? 'Ya' : 'Tidak'}</div>
              <div className="flex items-center gap-1.5 sm:col-span-2"><Banknote className="w-3 h-3 text-brand-muted" /><span className="text-brand-muted font-bold uppercase text-[9px]">Rekening:</span>{participant.bank_name} — {participant.bank_account_number} a.n. {participant.bank_account_holder}</div>
            </div>

            {participant.media_urls.length > 0 && (
              <div className="px-4 sm:px-6 pb-6">
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-2">Foto Portofolio</p>
                <div className="flex flex-wrap gap-3">
                  {participant.media_urls.map((url) => (
                    <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-card-border">
                      <Image src={url} alt="Foto pacer" fill unoptimized className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {participant.pb_media_urls.length > 0 && (
              <div className="px-4 sm:px-6 pb-6">
                <p className="text-[9px] font-bold text-brand-muted uppercase tracking-wider mb-2">Bukti Personal Best (PB)</p>
                <div className="flex flex-wrap gap-3">
                  {participant.pb_media_urls.map((url) => (
                    <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border border-card-border">
                      <Image src={url} alt="Foto PB pacer" fill unoptimized className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <PacerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  )
}
