'use client'

import React, { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Users, CheckCircle, Flame, ShieldCheck } from 'lucide-react'
import confetti from 'canvas-confetti'
import { registerLaberSchema, type RegisterLaberFormValues } from '@/lib/validations/laber'
import { registerLaber } from '@/app/actions/laber-registration'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { SiteShell, useActiveSession } from '@/components/landing/shell'

export default function LaberForm({ communities }: { communities: { value: string; label: string }[] }) {
  const [activeSession, setActiveSession] = useActiveSession()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [registeredData, setRegisteredData] = useState<{
    name: string
    community: string
    code: string
  } | null>(null)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RegisterLaberFormValues>({
    resolver: zodResolver(registerLaberSchema),
    defaultValues: {
      name: '',
      phone: '',
      community: '',
    },
  })

  const onSubmit = async (values: RegisterLaberFormValues) => {
    setSubmitError(null)

    const result = await registerLaber(values)

    if (result.error) {
      setSubmitError(result.error)
      return
    }

    // Success: trigger confetti celebration
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#ef4444', '#f97316', '#10b981'],
      })
    } catch {
      // Confetti fallback
    }

    setRegisteredData({
      name: values.name,
      community: communities.find((c) => c.value === values.community)?.label || values.community,
      code: result.laberCode || '',
    })

    reset()
    setIsSuccess(true)
  }

  return (
    <SiteShell session={activeSession} onLogout={() => setActiveSession(null)}>
      {/* Dialog Konfirmasi Pendaftaran */}
      <Dialog isOpen={isSuccess} onClose={() => setIsSuccess(false)} title="PENDAFTARAN DITERIMA">
        <div className="flex flex-col items-center text-center gap-5">
          <div className="p-5 bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600 rounded-full shadow-xl shadow-green-500/20 animate-in zoom-in-50 duration-300">
            <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight">
              Pendaftaran Laber Diterima!
            </h3>
            <p className="text-sm text-brand-muted leading-relaxed">
              Halo <strong className="text-slate-900">{registeredData?.name}</strong>, pendaftaran Anda untuk Latihan Bersama bersama{' '}
              <strong className="text-sport-purple">{registeredData?.community}</strong> telah berhasil kami terima.
            </p>
          </div>

          {registeredData?.code && (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                Kode Registrasi Laber
              </span>
              <span className="text-base font-black tracking-widest text-sport-purple font-mono">
                {registeredData.code}
              </span>
            </div>
          )}

          <div className="w-full bg-emerald-50/80 border border-emerald-100 rounded-xl p-3 text-left">
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              ℹ️ Tidak ada biaya yang dikenakan (<strong>Gratis</strong>). Informasi detail mengenai titik kumpul, jadwal, dan rute lari akan dikirimkan oleh panitia melalui nomor <strong>WhatsApp</strong> Anda.
            </p>
          </div>

          <Button
            onClick={() => setIsSuccess(false)}
            variant="primary"
            className="w-full py-3.5 text-sm font-black shadow-md shadow-sport-purple/20 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
          >
            Tutup
          </Button>
        </div>
      </Dialog>

      {/* Main Content Area */}
      <section className="px-4 pt-10 pb-28 z-10 relative max-w-xl mx-auto">
        <div className="bg-white border border-card-border rounded-2xl p-6 sm:p-8 shadow-xl relative">
          {/* Top sportive accent bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl bg-gradient-to-r from-sport-purple via-sport-red to-sport-orange" />

          <div className="flex flex-col gap-6">
            {/* Header info */}
            <div className="flex flex-col items-center text-center gap-2">


              <div className="p-3.5 rounded-2xl mb-1 bg-gradient-to-br from-sport-purple via-sport-red to-sport-orange shadow-lg shadow-sport-purple/20">
                <Flame className="w-6 h-6 text-white" />
              </div>

              <h1 className="text-2xl font-black uppercase text-slate-900 tracking-tight">
                Pendaftaran Laber
              </h1>
              <p className="text-xs text-brand-muted font-medium max-w-sm">
                Lari Bersama Komunitas Menuju Topsell Run 2026. Lengkapi data diri Anda di bawah ini untuk bergabung.
              </p>
            </div>

            {/* Info notice box */}
            <div className="flex items-start gap-3 bg-violet-50/80 border border-violet-100/90 rounded-xl px-4 py-3">
              <Users className="w-4 h-4 text-sport-purple shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                Pendaftaran ini ditujukan untuk komunitas lari menuju Topsell x Samsung Run for Changes 2026.
              </p>
            </div>

            {/* Error banner */}
            {submitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600 animate-in fade-in duration-200">
                ⚠️ {submitError}
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {/* Field: Nama */}
              <Input
                label="Nama"
                required
                placeholder="Masukkan nama lengkap Anda"
                error={errors.name?.message}
                disabled={isSubmitting}
                {...register('name')}
              />

              {/* Field: No. WhatsApp */}
              <div className="flex flex-col gap-1">
                <Input
                  label="No. Whatsapp"
                  required
                  type="tel"
                  placeholder="Contoh: 081234567890"
                  error={errors.phone?.message}
                  disabled={isSubmitting}
                  {...register('phone')}
                />
                <span className="text-[11px] text-brand-muted">
                  Pastikan nomor terhubung dengan WhatsApp aktif untuk konfirmasi dari panitia.
                </span>
              </div>

              {/* Field: Komunitas (Dropdown) */}
              <div className="relative z-20">
                <Controller
                  control={control}
                  name="community"
                  render={({ field }) => (
                    <Select
                      label="Komunitas"
                      required
                      searchable={false}
                      placeholder="-- Pilih Komunitas --"
                      error={errors.community?.message}
                      disabled={isSubmitting}
                      options={communities}
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  )}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="w-full py-4 text-sm font-black tracking-wider uppercase shadow-lg shadow-sport-purple/25 hover:shadow-xl hover:shadow-sport-purple/35 transition-all cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #ef4444 50%, #f97316 100%)' }}
                >
                  {isSubmitting ? 'Mengirim Pendaftaran...' : 'Daftar Laber Sekarang'}
                </Button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-brand-muted font-medium pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Data aman dan langsung terdaftar di sistem Topsell Run 2026
              </div>
            </form>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
