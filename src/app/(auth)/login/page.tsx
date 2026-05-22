'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Activity, Lock, ArrowLeft } from 'lucide-react'
import { loginSchema, LoginFormValues } from '@/lib/validations/auth'
import { signInCommunity } from '@/app/actions/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null)
    const result = await signInCommunity(values)
    if (result.error) {
      setAuthError(result.error)
    } else {
      router.refresh()
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-[0.4] pointer-events-none" />
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
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">Masuk Komunitas</h1>
          <p className="text-xs text-brand-muted font-medium">Login untuk mengelola peserta komunitas Anda</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-card-border rounded-xl p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sport-purple via-sport-red to-sport-orange" />
          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500">
              {authError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="Email Komunitas" type="email" placeholder="email@komunitas.com" error={errors.email?.message} disabled={isSubmitting} {...register('email')} />
            <Input label="Password" type="password" placeholder="••••••••" error={errors.password?.message} disabled={isSubmitting} {...register('password')} />
            <Button type="submit" variant="primary" className="w-full py-4 mt-1 text-xs font-black" style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }} isLoading={isSubmitting}>
              <Lock className="w-4 h-4 mr-2" />Masuk ke Dashboard
            </Button>
          </form>
        </div>

        <p className="text-xs text-center text-brand-muted">
          Belum punya akun komunitas?{' '}
          <Link href="/#register-section" className="font-bold hover:underline text-sport-purple">Daftar Sekarang</Link>
        </p>
      </div>
    </div>
  )
}
