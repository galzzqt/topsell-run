'use client'

import Link from 'next/link'
import { Clock, ArrowLeft } from 'lucide-react'
import { SiteShell, useActiveSession } from './shell'

/** Ditampilkan menggantikan form pendaftaran saat paket sedang tidak buka (enabled=false atau di luar jendela periode). */
export function ClosedNotice({ reason }: { reason?: string }) {
  const [activeSession, setActiveSession] = useActiveSession()

  return (
    <SiteShell session={activeSession} onLogout={() => setActiveSession(null)}>
      <section className="px-4 py-20 sm:py-28 flex flex-col items-center text-center gap-5 max-w-lg mx-auto">
        <div className="p-4 rounded-full bg-amber-100">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <h1 className="text-xl font-black uppercase text-slate-900">Pendaftaran Ditutup</h1>
        <p className="text-sm text-brand-muted leading-relaxed">
          {reason || 'Maaf, pendaftaran untuk paket ini sedang tidak dibuka. Silakan cek kembali nanti atau hubungi panitia untuk informasi lebih lanjut.'}
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-black text-white px-5 py-2.5 rounded-lg shadow-sm active:scale-95 transition-all"
          style={{ background: 'linear-gradient(90deg, #7c3aed, #ef4444, #f97316)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>
      </section>
    </SiteShell>
  )
}
