'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Store, Phone, Lock, Eye, EyeOff, AlertCircle, Loader2, ArrowRight, Mail } from 'lucide-react'
import { loginSchema, type LoginFormValues } from '@/lib/validations/auth'
import { signInUmkm } from '@/app/actions/umkm-auth'

export default function UmkmLoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true)
    setServerError('')
    const result = await signInUmkm(values)
    setIsSubmitting(false)

    if (result.error) {
      setServerError(result.error)
      return
    }

    router.push('/umkm-dashboard')
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center px-4 py-12">
      <div className="fixed top-0 right-0 w-96 h-96 bg-sport-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-96 h-96 bg-sport-red/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-sport-red to-sport-orange mb-4 shadow-lg shadow-sport-orange/20">
            <Store className="w-8 h-8 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sport-orange mb-1">Topsell Run 2026</p>
          <h1 className="text-3xl font-black uppercase text-foreground mb-2">Login UMKM</h1>
          <p className="text-sm text-brand-muted">Masuk ke dashboard tenant UMKM Anda</p>
        </div>

        <div className="bg-card-bg border border-card-border rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">
                No. WhatsApp atau Email
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  {...register('phone')}
                  placeholder="0812xxxxxxxx atau email@gmail.com"
                  className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                />
              </div>
              {errors.phone && <p className="text-red-400 text-[11px] mt-1">{errors.phone.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-brand-muted block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password Anda"
                  className="w-full bg-brand-gray border border-card-border rounded-xl pl-10 pr-12 py-3 text-sm text-foreground placeholder:text-brand-muted/50 focus:outline-none focus:border-sport-orange/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-[11px] mt-1">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-400">{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-sport-red to-sport-orange text-white font-black uppercase text-sm rounded-xl hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-lg shadow-sport-orange/20"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Masuk...</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> Masuk ke Dashboard</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-card-border text-center">
            <p className="text-xs text-brand-muted">
              Belum punya akun?{' '}
              <a href="/registrasi-tenant-umkm" className="text-sport-orange hover:text-sport-red font-bold transition-colors">
                Daftar di sini
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
