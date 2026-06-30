import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import Script from 'next/script'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID

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
    <html lang="id" className={`${manrope.variable} h-full`}>
      <head>
        {/* Meta Pixel Code */}
        {metaPixelId && (
          <>
            <Script
              id="meta-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  !function(f,b,e,v,n,t,s)
                  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                  n.queue=[];t=b.createElement(e);t.async=!0;
                  t.src=v;s=b.getElementsByTagName(e)[0];
                  s.parentNode.insertBefore(t,s)}(window, document,'script',
                  'https://connect.facebook.net/en_US/fbevents.js');
                  fbq('init', '${metaPixelId}');
                  fbq('track', 'PageView');
                `,
              }}
            />
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
