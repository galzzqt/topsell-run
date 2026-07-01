'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'
import { verifyEmailToken, resendVerificationEmail } from '@/app/actions/email-verification'
import { Button } from '@/components/ui/button'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  // Initialize state based on token presence
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    token ? 'loading' : 'error'
  )
  const [message, setMessage] = useState(
    token ? '' : 'Token verifikasi tidak ditemukan.'
  )
  const [familyName, setFamilyName] = useState('')
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (!token) return

    const verify = async () => {
      const result = await verifyEmailToken(token)
      
      if (result.error) {
        setStatus('error')
        setMessage(result.error)
      } else if (result.success) {
        setStatus('success')
        setFamilyName(result.familyName || '')
        setMessage('Email berhasil diverifikasi!')
        
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard')
        }, 3000)
      }
    }

    verify()
  }, [token, router])

  const handleResend = async () => {
    if (!token) return
    
    setIsResending(true)
    const result = await resendVerificationEmail(token)
    setIsResending(false)

    if (result.error) {
      alert(result.error)
    } else {
      alert('Email verifikasi baru telah dikirim. Silakan cek inbox Anda.')
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4 py-12">
      {/* Ambient glows */}
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-card-bg border border-card-border rounded-2xl p-8 shadow-xl">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sport-red to-sport-orange mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black uppercase text-foreground mb-2">
              Verifikasi Email
            </h1>
            <p className="text-xs text-brand-muted uppercase tracking-wider">
              TOPSELL RUN 2026
            </p>
          </div>

          {/* Status Content */}
          <div className="flex flex-col items-center gap-6">
            {status === 'loading' && (
              <>
                <Loader2 className="w-12 h-12 text-sport-orange animate-spin" />
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground mb-2">
                    Memverifikasi email Anda...
                  </p>
                  <p className="text-xs text-brand-muted">
                    Mohon tunggu sebentar
                  </p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-foreground mb-2">
                    Berhasil Diverifikasi!
                  </p>
                  {familyName && (
                    <p className="text-sm font-bold text-sport-orange mb-3">
                      {familyName}
                    </p>
                  )}
                  <p className="text-xs text-brand-muted mb-4">
                    {message}
                  </p>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <p className="text-xs text-green-400 font-medium">
                      Anda akan diarahkan ke dashboard dalam beberapa detik...
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="primary"
                  className="w-full"
                >
                  Buka Dashboard Sekarang
                </Button>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-foreground mb-2">
                    Verifikasi Gagal
                  </p>
                  <p className="text-xs text-brand-muted mb-6">
                    {message}
                  </p>
                  
                  {message.includes('kedaluwarsa') && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                      <p className="text-xs text-yellow-400 font-medium mb-3">
                        Link verifikasi sudah tidak berlaku. Kirim ulang email verifikasi?
                      </p>
                      <Button
                        onClick={handleResend}
                        variant="secondary"
                        className="w-full"
                        isLoading={isResending}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Kirim Ulang Email
                      </Button>
                    </div>
                  )}

                  <p className="text-xs text-brand-muted mt-4">
                    Butuh bantuan? Hubungi{' '}
                    <a
                      href="https://wa.me/6285892599688?text=Halo%20Admin%20Topsell%20Run%2C%20saya%20mengalami%20kesulitan%20verifikasi%20email%20dengan%20token%20saya."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sport-orange hover:text-sport-red font-bold transition-colors hover:underline"
                    >
                      WhatsApp CS
                    </a>
                  </p>
                </div>
                <Button
                  onClick={() => router.push('/login')}
                  variant="ghost"
                  className="w-full"
                >
                  Kembali ke Login
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-brand-muted">
            Bro & Sist Package • TOPSELL RUN 2026
          </p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-sport-orange animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
