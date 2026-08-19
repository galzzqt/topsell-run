'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, ArrowRight, User, Users, Building2, Store } from 'lucide-react'
import { EventCountdown, SiteShell, useActiveSession } from '@/components/landing/shell'
import { useSiteAssets } from '@/lib/hooks/usePackagesSettings'
import type { PackageKey } from '@/lib/admin/settings-schema'

const PACKAGES: Array<{
  key: PackageKey
  href: string
  icon: typeof User
  title: string
  description: string
}> = [
  {
    key: 'individual',
    href: '/individu',
    icon: User,
    title: 'Individu',
    description: 'Daftar untuk diri sendiri — 1 peserta.',
  },
  {
    key: 'family',
    href: '/bro-and-sist',
    icon: Users,
    title: 'Bro & Sist Package',
    description: 'Daftar bersama saudara — minimal 3 peserta.',
  },
  {
    key: 'community',
    href: '/community-package',
    icon: Building2,
    title: 'Community Package',
    description: 'Daftar bersama komunitas lari Anda.',
  },
  {
    key: 'umkm',
    href: '/registrasi-tenant-umkm',
    icon: Store,
    title: 'Tenant UMKM',
    description: 'Daftarkan usaha Anda sebagai tenant event.',
  },
]

export default function LandingPage() {
  const [activeSession, setActiveSession] = useActiveSession()
  const [soldOut, setSoldOut] = useState<Partial<Record<PackageKey, boolean>>>({})
  const siteAssets = useSiteAssets()

  // Paket yang di-"Tutup" admin di Kelola Paket tampil sold out di sini.
  useEffect(() => {
    fetch('/api/settings/packages')
      .then((r) => (r.ok ? r.json() : null))
      .then((packages) => {
        if (!packages) return
        setSoldOut({
          individual: packages.individual?.enabled === false,
          family: packages.family?.enabled === false,
          community: packages.community?.enabled === false,
          umkm: packages.umkm?.enabled === false,
        })
      })
      .catch(() => undefined)
  }, [])

  return (
    <SiteShell session={activeSession} onLogout={() => setActiveSession(null)}>
      {/* ——— HERO ——— */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-16 pb-12 overflow-hidden z-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Event badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 border border-card-border rounded-full backdrop-blur-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted">Pendaftaran Dibuka</span>
          </div>

          {/* Main title */}
          <div className="flex flex-col items-center gap-4 sm:gap-5">
            <h1 className="sr-only">TOPSELL x Samsung Run For Changes 2026</h1>
            <p className="text-2xl sm:text-4xl font-black uppercase tracking-tight leading-none text-slate-900">
              TOPSELL x Samsung
            </p>
            <Image
              src={siteAssets?.heroImage || '/images/hero.png'}
              alt="Run For Changes 2026"
              width={492}
              height={216}
              unoptimized={Boolean(siteAssets?.heroImage)}
              className="w-full max-w-[280px] sm:max-w-[456px] h-auto object-contain"
              priority
            />
          </div>

          {/* Meta info */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-brand-muted">
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-sport-orange" />18 Oktober 2026</span>
            <span className="text-brand-muted/30">|</span>
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sport-orange" />Sunrise Mall, Kota Mojokerto</span>
          </div>

          {/* Countdown */}
          <EventCountdown />
        </div>
      </section>

      {/* ——— CTA PENDAFTARAN ——— */}
      <section id="daftar" className="px-4 pb-12 z-10 relative max-w-5xl mx-auto scroll-mt-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PACKAGES.map(({ key, href, icon: Icon, title, description }) => {
            const isSoldOut = Boolean(soldOut[key])

            const cardContent = (
              <>
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isSoldOut ? 'bg-slate-300' : 'bg-linear-to-r from-sport-purple via-sport-red to-sport-orange'}`} />
                <div className={`p-3 rounded-xl w-fit ${isSoldOut ? 'bg-slate-300' : 'bg-linear-to-br from-sport-purple via-sport-red to-sport-orange'}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h2 className={`text-base font-black uppercase ${isSoldOut ? 'text-slate-400' : 'text-slate-900'}`}>{title}</h2>
                <p className={`text-xs leading-relaxed ${isSoldOut ? 'text-slate-400' : 'text-brand-muted'}`}>{description}</p>
                {isSoldOut ? (
                  <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400">
                    Sold Out
                  </span>
                ) : (
                  <span className="mt-auto pt-2 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-sport-purple">
                    Daftar <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                )}
              </>
            )

            if (isSoldOut) {
              return (
                <div
                  key={key}
                  aria-disabled="true"
                  className="bg-slate-100 border border-slate-200 rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden cursor-not-allowed"
                >
                  {cardContent}
                </div>
              )
            }

            // Sudah login → arahkan ke dashboard user; belum login → halaman pendaftaran.
            const target = activeSession ? activeSession.dashboardUrl : href

            return (
              <Link
                key={key}
                href={target}
                className="group bg-white border border-card-border rounded-2xl p-6 shadow-lg hover:border-sport-purple/50 hover:shadow-xl transition-all flex flex-col gap-3 relative overflow-hidden"
              >
                {cardContent}
              </Link>
            )
          })}
        </div>
      </section>
    </SiteShell>
  )
}
