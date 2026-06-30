'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Activity, Lock, ArrowLeft, Mail } from 'lucide-react'
import { loginSchema, LoginFormValues } from '@/lib/validations/auth'
import { signInFamily } from '@/app/actions/family-auth'
import { resendVerificationEmail } from '@/app/actions/email-verification'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [familyIdForResend, setFamilyIdForResend] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null)
    setNeedsVerification(false)
    setResendMessage(null)
    
    const result = await signInFamily(values)
    
    if (result.error) {
      setAuthError(result.error)
      
      if ('needsVerification' in result && result.needsVerification) {
        setNeedsVerification(true)
        setFamilyIdForResend(result.familyId || null)
      }
    } else {
      router.refresh()
      router.push('/dashboard')
    }
  }

  const handleResendVerification = async () => {
    if (!familyIdForResend) return
    
    setIsResending(true)
    setResendMessage(null)
    
    const result = await resendVerificationEmail(familyIdForResend)
    setIsResending(false)
    
    if (result.error) {
      setResendMessage(result.error)
    } else {
      setResendMessage('Email verifikasi telah dikirim ulang. Silakan cek inbox Anda.')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-[0.4] pointer-events-none" />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }} />

      <div className="w-full max-w-sm flex flex-col gap-6 relative z-10">

        {/* Back to home */}
        <Link href="/" className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted hover:text-foreground transition-colors uppercase tracking-wider w-fit">
          <ArrowLeft className="w-3 h-3" />Kembali ke Home
        </Link>

        {/* Brand */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="p-3 rounded-xl mb-1" style={{ background: 'linear-gradient(135deg, #7c3aed, #ef4444, #f97316)' }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sport-purple">TOPSELL RUN 2026</p>
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">Masuk Bro & Sist Package</h1>
          <p className="text-xs text-brand-muted font-medium">Login untuk mengelola peserta Bro & Sist Package Anda</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-card-border rounded-xl p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-sport-purple via-sport-red to-sport-orange" />
          
          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
              {authError}
            </div>
          )}
          
          {needsVerification && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-900 mb-1">
                    Email Belum Diverifikasi
                  </p>
                  <p className="text-[10px] text-amber-800 leading-relaxed">
                    Silakan cek email Anda dan klik link aktivasi. Jika tidak menerima email, kirim ulang di bawah ini.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={handleResendVerification}
                variant="secondary"
                className="w-full py-2.5 text-xs"
                isLoading={isResending}
                disabled={isResending}
              >
                <Mail className="w-4 h-4 mr-2" />
                Kirim Ulang Email Verifikasi
              </Button>
              {resendMessage && (
                <p className={`text-[10px] text-center ${resendMessage.includes('berhasil') || resendMessage.includes('dikirim') ? 'text-green-600' : 'text-red-600'}`}>
                  {resendMessage}
                </p>
              )}
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="Nomor WhatsApp / Email Perwakilan" placeholder="08xxxxxxxxxx atau email@example.com" error={errors.phone?.message} disabled={isSubmitting} {...register('phone')} />
            <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message} disabled={isSubmitting} {...register('password')} />
            <Button type="submit" variant="primary" className="w-full py-4 mt-1 text-xs font-black" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }} isLoading={isSubmitting}>
              <Lock className="w-4 h-4 mr-2" />Masuk ke Dashboard
            </Button>
          </form>
        </div>

        <p className="text-xs text-center text-brand-muted">
          Belum punya akun Bro & Sist Package?{' '}
          <Link href="/#register-section" className="font-bold hover:underline text-sport-purple">Daftar Sekarang</Link>
        </p>
      </div>
    </div>
  )
}
