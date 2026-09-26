'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react'
import { getActiveSessionAction, type ActiveSession } from '@/app/actions/session-check'
import { signOutFamily } from '@/app/actions/family-auth'
import { signOutCommunity } from '@/app/actions/auth'
import { signOutIndividual } from '@/app/actions/individual-auth'
import { signOutUmkm } from '@/app/actions/umkm-auth'
import { useSiteAssets } from '@/lib/hooks/usePackagesSettings'

export function useActiveSession() {
  const [session, setSession] = useState<ActiveSession | undefined>(undefined)
  useEffect(() => {
    getActiveSessionAction().then(setSession).catch(() => setSession(null))
  }, [])
  return [session, setSession] as const
}

// ——— Interactive Countdown Component ———
export function EventCountdown() {
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
              <span className="text-2xl sm:text-3xl font-black tabular-nums bg-linear-to-r from-sport-purple via-sport-red to-sport-orange bg-clip-text text-transparent">
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

// ——— Nav User Widget Component ———
function NavUserWidget({ session, onLogout }: { session: ActiveSession | undefined; onLogout: () => void }) {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  if (session === undefined) {
    return <div className="h-8 w-32 bg-slate-100 rounded-lg animate-pulse" />
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-xs font-bold text-brand-muted hover:text-foreground border border-card-border px-3 py-1.5 rounded-lg transition-colors">
          Masuk
        </Link>
        <Link
          href="/#daftar"
          className="text-xs font-black text-white px-4 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer shadow-md shadow-sport-purple/10"
          style={{ background: 'linear-gradient(90deg, #7c3aed, #ef4444, #f97316)' }}
        >
          Daftar
        </Link>
      </div>
    )
  }

  const initial = session.name.charAt(0).toUpperCase()
  const label = session.type === 'community' ? 'Komunitas' : session.type === 'individual' ? 'Individu' : session.type === 'umkm' ? 'Tenant UMKM' : 'Bro & Sist'

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      if (session.type === 'family') {
        await signOutFamily()
      } else if (session.type === 'individual') {
        await signOutIndividual()
      } else if (session.type === 'umkm') {
        await signOutUmkm()
      } else {
        await signOutCommunity()
      }
      setOpen(false)
      onLogout()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-card-border rounded-lg hover:border-sport-purple/40 transition-all text-xs font-bold text-slate-700 cursor-pointer"
      >
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #ef4444)' }}>
          {initial}
        </span>
        <span className="max-w-[120px] truncate hidden sm:block">{session.name}</span>
        <ChevronDown className={`w-3 h-3 text-brand-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white border border-card-border rounded-xl shadow-lg py-1 z-50">
          <div className="px-3 py-2 border-b border-card-border">
            <p className="text-[9px] font-black uppercase tracking-wider text-sport-orange">{label}</p>
            <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{session.name}</p>
          </div>
          <Link
            href={session.dashboardUrl}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-sport-purple" />
            Dashboard
          </Link>
          <div className="border-t border-card-border mx-1 my-1" />
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {loggingOut ? 'Keluar...' : 'Logout'}
          </button>
        </div>
      )}
    </div>
  )
}

// ——— Page chrome shared by landing & registration pages ———
export function SiteShell({
  session,
  onLogout,
  children,
}: {
  session: ActiveSession | undefined
  onLogout: () => void
  children: React.ReactNode
}) {
  const siteAssets = useSiteAssets()
  const logoSrc = siteAssets?.logoImage || '/images/header.png'

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative">
      {/* Background noise grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-[0.4] pointer-events-none" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.2) 0%, transparent 70%)' }} />

      {/* ——— NAV ——— */}
      <nav className="sports-glass sticky top-0 z-50 w-full border-b border-card-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center select-none">
            <Image
              src={logoSrc}
              alt="TOPSELL RUN"
              width={152}
              height={43}
              unoptimized={Boolean(siteAssets?.logoImage)}
              className="h-6 sm:h-8 w-auto object-contain"
              priority
            />
          </Link>
          <NavUserWidget session={session} onLogout={onLogout} />
        </div>
      </nav>

      {children}

      {/* ——— FOOTER ——— */}
      <footer className="border-t border-card-border px-4 py-8 z-10 relative bg-white mt-12">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <Image
              src={logoSrc}
              alt="TOPSELL RUN 2026"
              width={136}
              height={38}
              unoptimized={Boolean(siteAssets?.logoImage)}
              className="h-[29px] w-auto object-contain"
            />
          </div>
          <p className="text-[10px] text-brand-muted font-bold text-center uppercase tracking-wider">
            © 2026 TOPSELL x SAMSUNG RUN FOR CHANGES. All rights reserved. • Mojokerto, Jawa Timur
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-[10px] font-black text-brand-muted hover:text-sport-purple transition-colors uppercase tracking-wider">Login</Link>
            <Link href="/#daftar" className="text-[10px] font-black text-brand-muted hover:text-sport-purple transition-colors uppercase tracking-wider">Daftar</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
