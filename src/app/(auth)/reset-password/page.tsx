'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resetPasswordSchema, type ResetPasswordFormValues } from '@/lib/validations/auth'
import { verifyResetPasswordToken, completePasswordReset } from '@/app/actions/password-reset'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [isVerifying, setIsVerifying] = useState(true)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [userInfo, setUserInfo] = useState<{
    name?: string
    email?: string
    packageType?: string
    loginUrl?: string
  } | null>(null)

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [loginRedirectUrl, setLoginRedirectUrl] = useState<string>('/login')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  })

  useEffect(() => {
    let isMounted = true

    async function checkToken() {
      if (!token) {
        if (isMounted) {
          setTokenError('Token reset password tidak ditemukan pada URL.')
          setIsVerifying(false)
        }
        return
      }

      setIsVerifying(true)
      const res = await verifyResetPasswordToken(token)

      if (isMounted) {
        if (!res.valid) {
          setTokenError(res.error || 'Token reset password tidak valid atau sudah kedaluwarsa.')
        } else {
          setUserInfo({
            name: res.name,
            email: res.email,
            packageType: res.packageType,
            loginUrl: res.loginUrl || '/login',
          })
          if (res.loginUrl) setLoginRedirectUrl(res.loginUrl)
        }
        setIsVerifying(false)
      }
    }

    checkToken()

    return () => {
      isMounted = false
    }
  }, [token])

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setSubmitError(null)

    const result = await completePasswordReset(token, values.password)

    if (result.error) {
      setSubmitError(result.error)
    } else {
      setIsSuccess(true)
      setSuccessMessage(result.message || 'Password Anda berhasil diubah!')
      if (result.loginUrl) setLoginRedirectUrl(result.loginUrl)
    }
  }

  const waLink = 'https://wa.me/6282119227871?text=Halo%20Admin%20Topsell%20Run%2C%20saya%20membutuhkan%20bantuan%20reset%20password%20akun%20saya.'

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Grid bg */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-size-[4rem_4rem] opacity-[0.4] pointer-events-none" />
      {/* Glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-sm flex flex-col gap-6 relative z-10">
        {/* Back to login */}
        <Link
          href={loginRedirectUrl}
          className="flex items-center gap-1.5 text-[10px] font-bold text-brand-muted hover:text-foreground transition-colors uppercase tracking-wider w-fit"
        >
          <ArrowLeft className="w-3 h-3" /> Kembali ke Login
        </Link>

        {/* Brand Header */}
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="p-3 rounded-xl mb-1" style={{ background: 'linear-gradient(135deg, #7c3aed, #ef4444, #f97316)' }}>
            <KeyRound className="w-5 h-5 text-white" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-sport-purple">TOPSELL RUN 2026</p>
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">Buat Password Baru</h1>
          {userInfo?.name && (
            <p className="text-xs text-brand-muted mt-0.5">
              Untuk akun <strong>{userInfo.name}</strong> ({userInfo.email})
            </p>
          )}
        </div>

        {/* Card */}
        <div className="bg-white border border-card-border rounded-xl p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sport-purple via-sport-red to-sport-orange" />

          {isVerifying ? (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="w-6 h-6 text-sport-orange animate-spin" />
              <p className="text-xs font-bold text-brand-muted">Memverifikasi tautan reset password...</p>
            </div>
          ) : tokenError ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-red-900 mb-1">Tautan Tidak Valid</h3>
                  <p className="text-[11px] text-red-700 leading-relaxed">{tokenError}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href="/forgot-password"
                  className="w-full py-3 rounded-lg text-xs font-bold uppercase text-center bg-sport-orange text-white hover:bg-sport-orange/90 transition-colors"
                >
                  Minta Link Reset Baru
                </Link>
                <Link
                  href="/login"
                  className="w-full py-2.5 rounded-lg text-xs font-bold uppercase text-center border border-card-border text-brand-muted hover:text-foreground transition-colors"
                >
                  Kembali ke Login
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-900 mb-1">Password Berhasil Diubah!</h3>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">{successMessage}</p>
                </div>
              </div>

              <Link
                href={loginRedirectUrl}
                className="w-full py-3.5 rounded-lg text-xs font-black uppercase text-center text-white shadow-md transition-transform active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
              >
                Masuk ke Akun Sekarang
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Password Baru */}
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Password Baru <span className="text-sport-orange ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimal 6 karakter"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground placeholder:text-brand-muted/70 focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30 pr-10"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-foreground cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-sport-red font-medium">{errors.password.message}</span>}
              </div>

              {/* Konfirmasi Password */}
              <div className="w-full flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-muted">
                  Konfirmasi Password Baru <span className="text-sport-orange ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Ulangi password baru"
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-brand-gray/40 border border-card-border rounded-lg text-sm text-foreground placeholder:text-brand-muted/70 focus:outline-none focus:border-sport-orange focus:ring-1 focus:ring-sport-orange/30 pr-10"
                    {...register('confirmPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-foreground cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="text-xs text-sport-red font-medium">{errors.confirmPassword.message}</span>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full py-4 mt-2 text-xs font-black"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                isLoading={isSubmitting}
              >
                <Lock className="w-4 h-4 mr-2" /> Simpan Password Baru
              </Button>
            </form>
          )}
        </div>

        {/* WhatsApp CS Button */}
        <div className="bg-card-bg/60 border border-card-border rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-foreground text-[11px]">Butuh Bantuan CS?</p>
            <p className="text-[10px] text-brand-muted">Hubungi Customer Service kami via WhatsApp</p>
          </div>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-[10px] font-bold uppercase hover:bg-[#20bd5a] transition-colors shrink-0"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat CS
          </a>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <Loader2 className="w-8 h-8 text-sport-orange animate-spin mb-2" />
          <p className="text-xs font-bold text-brand-muted">Memuat halaman reset password...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
