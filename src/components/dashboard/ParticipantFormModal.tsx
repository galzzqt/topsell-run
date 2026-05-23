'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil } from 'lucide-react'
import { participantEditSchema, ParticipantFormValues } from '@/lib/validations/participant'
import { updateParticipant } from '@/app/actions/participants'
import { useAppStore } from '@/lib/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { Participant } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface ParticipantFormModalProps {
  isOpen: boolean
  onClose: () => void
  editParticipant?: Participant | null
}

export function ParticipantFormModal({ isOpen, onClose, editParticipant }: ParticipantFormModalProps) {
  const supabase = createClient()
  const { user, fetchCommunityData } = useAppStore()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantFormValues>({
    resolver: zodResolver(participantEditSchema),
    defaultValues: {
      full_name: '',
      bib_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: 'male',
      tshirt_size: 'M',
      blood_type: 'A',
      medical_condition: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      provinsi: '',
      kota: '',
      kecamatan: '',
    },
  })

  useEffect(() => {
    if (!editParticipant) {
      reset()
      return
    }

    setValue('full_name', editParticipant.full_name)
    setValue('bib_name', editParticipant.bib_name)
    setValue('email', editParticipant.email)
    setValue('phone', editParticipant.phone)
    setValue('date_of_birth', editParticipant.date_of_birth || '')
    setValue('gender', editParticipant.gender)
    setValue('tshirt_size', editParticipant.tshirt_size)
    setValue('blood_type', editParticipant.blood_type || 'A')
    setValue('medical_condition', editParticipant.medical_condition || '')
    setValue('emergency_contact_name', editParticipant.emergency_contact_name || '')
    setValue('emergency_contact_phone', editParticipant.emergency_contact_phone || '')
  }, [editParticipant, isOpen, reset, setValue])

  const onSubmit = async (values: ParticipantFormValues) => {
    if (!editParticipant) {
      alert('Pilih peserta yang ingin diedit.')
      return
    }

    const result = await updateParticipant(editParticipant.id, values)
    if (result.error) {
      alert(result.error)
      return
    }

    if (user?.id) {
      await fetchCommunityData(supabase, user.id)
    }

    reset()
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Edit Data Peserta">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 bg-sport-orange/10 border border-sport-orange/20 rounded-lg p-3">
          <Pencil className="w-4 h-4 text-sport-orange flex-shrink-0" />
          <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
            Edit data peserta yang masih berstatus pending. Jumlah peserta tidak dapat ditambah atau dikurangi dari dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nama Lengkap Peserta"
            placeholder="Nama sesuai identitas"
            error={errors.full_name?.message}
            disabled={isSubmitting}
            {...register('full_name')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Nama BIB"
              placeholder="Nama yang dicetak di BIB"
              error={errors.bib_name?.message}
              disabled={isSubmitting}
              {...register('bib_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="peserta@email.com"
              error={errors.email?.message}
              disabled={isSubmitting}
              {...register('email')}
            />
            <Input
              label="No. HP / WhatsApp"
              placeholder="08xxxxxxxxxx"
              error={errors.phone?.message}
              disabled={isSubmitting}
              {...register('phone')}
            />
            <Input
              label="Tanggal Lahir"
              type="date"
              error={errors.date_of_birth?.message}
              disabled={isSubmitting}
              {...register('date_of_birth')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Jenis Kelamin"
              error={errors.gender?.message}
              disabled={isSubmitting}
              options={[
                { value: 'male', label: 'Laki-laki' },
                { value: 'female', label: 'Perempuan' },
              ]}
              {...register('gender')}
            />
            <Select
              label="Ukuran Jersey"
              error={errors.tshirt_size?.message}
              disabled={isSubmitting}
              options={[
                { value: 'XS', label: 'XS' },
                { value: 'S', label: 'S' },
                { value: 'M', label: 'M' },
                { value: 'L', label: 'L' },
                { value: 'XL', label: 'XL' },
                { value: 'XXL', label: 'XXL' },
                { value: '3XL', label: '3XL' },
                { value: '4XL', label: '4XL' },
                { value: '5XL', label: '5XL' },
              ]}
              {...register('tshirt_size')}
            />
            <Select
              label="Gol. Darah"
              error={errors.blood_type?.message}
              disabled={isSubmitting}
              options={[
                { value: 'A', label: 'A' },
                { value: 'B', label: 'B' },
                { value: 'AB', label: 'AB' },
                { value: 'O', label: 'O' },
              ]}
              {...register('blood_type')}
            />
          </div>

          <Input
            label="Penyakit Bawaan"
            placeholder="Isi jika ada"
            error={errors.medical_condition?.message}
            disabled={isSubmitting}
            {...register('medical_condition')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nama Kontak Darurat"
              placeholder="Nama keluarga/kerabat"
              error={errors.emergency_contact_name?.message}
              disabled={isSubmitting}
              {...register('emergency_contact_name')}
            />
            <Input
              label="No. Kontak Darurat"
              placeholder="08xxxxxxxxxx"
              error={errors.emergency_contact_phone?.message}
              disabled={isSubmitting}
              {...register('emergency_contact_phone')}
            />
          </div>

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
