'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useCommunityStore } from '@/lib/store/useCommunityStore'
import { communityProfileSchema, CommunityProfileValues } from '@/lib/validations/community'
import { updateCommunityProfile } from '@/app/actions/communities'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface CommunityProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CommunityProfileModal({ isOpen, onClose }: CommunityProfileModalProps) {
  const { user, community, fetchCommunityData } = useCommunityStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommunityProfileValues>({
    resolver: zodResolver(communityProfileSchema),
    defaultValues: {
      phone: '',
      email: '',
      password: '',
    },
  })

  useEffect(() => {
    if (!isOpen || !community) return

    reset({
      phone: community.phone || '',
      email: community.email || '',
      password: '',
    })
  }, [community, isOpen, reset])

  const onSubmit = async (values: CommunityProfileValues) => {
    const result = await updateCommunityProfile(values)
    if (result.error) {
      alert(result.error)
      return
    }

    if ('message' in result && result.message) {
      alert(result.message)
    }

    if ('requiresVerification' in result && result.requiresVerification) {
      handleClose()
      window.location.href = result.redirectTo || '/community-login'
      return
    }

    if (user?.id) {
      await fetchCommunityData()
    }
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Edit Akun Komunitas">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 bg-sport-orange/10 border border-sport-orange/20 rounded-lg p-3">
          <KeyRound className="w-4 h-4 text-sport-orange shrink-0" />
          <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
            Komunitas hanya dapat mengubah nomor HP, email, dan password akun. Jika email diubah, akun wajib aktivasi ulang melalui email baru. Data peserta dikelola oleh admin.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="No. HP / WhatsApp Komunitas"
            placeholder="08xxxxxxxxxx"
            error={errors.phone?.message}
            disabled={isSubmitting}
            {...register('phone')}
          />
          <Input
            label="Email Komunitas"
            type="email"
            placeholder="email@komunitas.com"
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
