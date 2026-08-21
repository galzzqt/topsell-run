'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useIndividualStore } from '@/lib/store/useIndividualStore'
import { individualProfileSchema, IndividualProfileValues } from '@/lib/validations/individual'
import { updateIndividualProfile } from '@/app/actions/individual-profile'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface IndividualProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function IndividualProfileModal({ isOpen, onClose }: IndividualProfileModalProps) {
  const { user, individual, fetchIndividualData } = useIndividualStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IndividualProfileValues>({
    resolver: zodResolver(individualProfileSchema),
    defaultValues: {
      full_name: '',
      community_name: '',
      phone: '',
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    if (!isOpen || !individual) return

    reset({
      full_name: individual.name || '',
      community_name: individual.community_name || '',
      phone: individual.phone || '',
      email: individual.email || '',
      password: '',
    })
  }, [individual, isOpen, reset])

  const onSubmit = async (values: IndividualProfileValues) => {
    const result = await updateIndividualProfile(values)
    if (result.error) {
      alert(result.error)
      return
    }

    if ('message' in result && result.message) {
      alert(result.message)
    }

    if ('requiresVerification' in result && result.requiresVerification) {
      handleClose()
      window.location.href = result.redirectTo || '/login'
      return
    }

    if (user?.id) {
      await fetchIndividualData()
    }
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Edit Profil Peserta">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 bg-sport-orange/10 border border-sport-orange/20 rounded-lg p-3">
          <KeyRound className="w-4 h-4 text-sport-orange shrink-0" />
          <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
            Anda dapat mengubah nama, instansi/komunitas, nomor HP, email, dan password akun. Jika email diubah, akun wajib aktivasi ulang melalui email baru.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nama Lengkap"
            placeholder="Nama sesuai KTP"
            error={errors.full_name?.message}
            disabled={isSubmitting}
            {...register('full_name')}
          />
          <Input
            label="Instansi / Komunitas (Opsional)"
            placeholder="Contoh: PT ABC / Komunitas Lari"
            error={errors.community_name?.message}
            disabled={isSubmitting}
            {...register('community_name')}
          />
          <Input
            label="No. HP / WhatsApp"
            placeholder="08xxxxxxxxxx"
            error={errors.phone?.message}
            disabled={isSubmitting}
            {...register('phone')}
          />
          <Input
            label="Email"
            type="email"
            placeholder="email@example.com"
            error={errors.email?.message}
            disabled={isSubmitting}
            {...register('email')}
          />
          <Input
            label="Password Baru"
            type="password"
            placeholder="Kosongkan jika tidak ingin mengubah password"
            error={errors.password?.message}
            disabled={isSubmitting}
            {...register('password')}
          />

          <div className="flex gap-3 pt-2 border-t border-card-border">
            <Button type="button" variant="ghost" className="flex-1" onClick={handleClose} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" variant="primary" className="flex-1" isLoading={isSubmitting}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
