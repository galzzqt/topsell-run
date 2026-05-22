'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/#register-section')
  }, [router])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-3">
        <svg className="w-8 h-8 animate-spin text-sport-purple" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs font-black uppercase tracking-widest text-brand-muted">Mengarahkan ke pendaftaran...</p>
      </div>
    </div>
  )
}
