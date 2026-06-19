import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'TOPSELL RUN 2026 — Registrasi Komunitas Lari',
  description: 'Daftarkan komunitas lari Anda untuk TOPSELL RUN 2026. Kategori 6K, 18 Oktober 2026 di Sunrise Mall Mojokerto. Pembayaran kolektif, QR Race Pass, dan racepack eksklusif.',
  keywords: 'topsell run, topsell run 2026, registrasi lari komunitas, 6k run mojokerto, mojokerto run, event lari oktober 2026',
  icons: {
    icon: '/images/hero.png',
    shortcut: '/images/hero.png',
    apple: '/images/hero.png', 
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
