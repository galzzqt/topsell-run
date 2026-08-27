'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, KeyRound, Mail, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '@/lib/validations/auth'
import { requestPasswordReset } from '@/app/actions/password-reset'

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setSuccessMessage(null)
    setErrorMessage(null)

    const result = await requestPasswordReset(values.identifier)

    if (result.error) {
      setErrorMessage(result.error)
    } else {
      setSuccessMessage(result.message || 'Link reset password telah dikirim ke email Anda.')
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
          href="/login"
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
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">Lupa Password</h1>
          <p className="text-xs text-brand-muted mt-0.5">
            Masukkan Nomor WhatsApp atau Email terdaftar untuk menerima link reset password.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-card-border rounded-xl p-6 flex flex-col gap-4 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sport-purple via-sport-red to-sport-orange" />

          {successMessage ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-900 mb-1">Permintaan Terkirim!</h3>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">{successMessage}</p>
                </div>
              </div>

              <div className="bg-brand-gray/20 border border-card-border rounded-lg p-3 text-[11px] text-brand-muted flex flex-col gap-1.5">
                <p className="font-bold text-foreground">💡 Petunjuk:</p>
                <ul className="list-disc list-inside space-y-1 text-[10px]">
                  <li>Buka kotak masuk email Anda dan klik tombol <strong>&ldquo;Reset Password Saya&rdquo;</strong>.</li>
                  <li>Jika tidak ada di inbox, periksa folder <strong>Spam / Promosi</strong>.</li>
                  <li>Link berlaku selama <strong>24 jam</strong>.</li>
                </ul>
              </div>

              <Link
                href="/login"
                className="w-full py-3 rounded-lg text-xs font-bold uppercase text-center bg-slate-900 text-white hover:bg-slate-800 transition-colors"
              >
                Kembali ke Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-500 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Input
                label="Nomor WhatsApp / Email"
                placeholder="08xxxxxxxxxx atau email@example.com"
                error={errors.identifier?.message}
                disabled={isSubmitting}
                {...register('identifier')}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-4 mt-1 text-xs font-black"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                isLoading={isSubmitting}
              >
                <Mail className="w-4 h-4 mr-2" /> Kirim Link Reset Password
              </Button>
            </form>
          )}
        </div>

        {/* WhatsApp CS Button */}
        <div className="bg-card-bg/60 border border-card-border rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-foreground text-[11px]">Mengalami Kesulitan?</p>
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

        <p className="text-xs text-center text-brand-muted">
          Ingat password Anda?{' '}
          <Link href="/login" className="font-bold hover:underline text-sport-purple">
            Masuk Sekarang
          </Link>
        </p>
      </div>
    </div>
  )
}
