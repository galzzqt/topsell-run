'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { participantSchema, participantEditSchema, ParticipantFormValues } from '@/lib/validations/participant'
import { addParticipant, updateParticipant } from '@/app/actions/participants'
import { useAppStore } from '@/lib/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { Participant } from '@/lib/types'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface ParticipantFormModalProps {
  isOpen: boolean
  onClose: () => void
  editParticipant?: Participant | null // if provided = edit mode
}

interface LocationOption {
  value: string
  label: string
}

export function ParticipantFormModal({ isOpen, onClose, editParticipant }: ParticipantFormModalProps) {
  const supabase = createClient()
  const { user, fetchCommunityData } = useAppStore()
  const isEditMode = !!editParticipant

  // Location states
  const [provinsiList, setProvinsiList] = useState<LocationOption[]>([])
  const [kotaList, setKotaList] = useState<LocationOption[]>([])
  const [kecamatanList, setKecamatanList] = useState<LocationOption[]>([])
  const [loadingProvinsi, setLoadingProvinsi] = useState(false)
  const [loadingKota, setLoadingKota] = useState(false)
  const [loadingKecamatan, setLoadingKecamatan] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ParticipantFormValues>({
    resolver: zodResolver(isEditMode ? participantEditSchema : participantSchema),
    defaultValues: {
      full_name: '',
      bib_name: '',
      email: '',
      phone: '',
      gender: 'male',
      tshirt_size: 'M',
      blood_type: 'A',
      medical_condition: '',
      provinsi: '',
      kota: '',
      kecamatan: '',
    },
  })

  const selectedProvinsi = watch('provinsi')
  const selectedKota = watch('kota')

  // Load provinces on mount
  useEffect(() => {
    const loadProvinsi = async () => {
      setLoadingProvinsi(true)
      try {
        const data = await fetchProvinsi()
        setProvinsiList(data)
      } catch (error) {
        console.error('Error loading provinsi:', error)
      } finally {
        setLoadingProvinsi(false)
      }
    }

    if (isOpen) {
      if (isEditMode) return
      loadProvinsi()
    }
  }, [isEditMode, isOpen])

  // Load kota when provinsi changes
  useEffect(() => {
    const loadKota = async () => {
      if (isEditMode) return
      if (!selectedProvinsi) {
        setKotaList([])
        setKecamatanList([])
        setValue('kota', '')
        setValue('kecamatan', '')
        return
      }

      setLoadingKota(true)
      try {
        const data = await fetchKota(selectedProvinsi)
        setKotaList(data)
        setKecamatanList([])
        setValue('kota', '')
        setValue('kecamatan', '')
      } catch (error) {
        console.error('Error loading kota:', error)
      } finally {
        setLoadingKota(false)
      }
    }

    loadKota()
  }, [isEditMode, selectedProvinsi, setValue])

  // Load kecamatan when kota changes
  useEffect(() => {
    const loadKecamatan = async () => {
      if (isEditMode) return
      if (!selectedKota) {
        setKecamatanList([])
        setValue('kecamatan', '')
        return
      }

      setLoadingKecamatan(true)
      try {
        const data = await fetchKecamatan(selectedKota)
        setKecamatanList(data)
        setValue('kecamatan', '')
      } catch (error) {
        console.error('Error loading kecamatan:', error)
      } finally {
        setLoadingKecamatan(false)
      }
    }

    loadKecamatan()
  }, [isEditMode, selectedKota, setValue])

  // Populate fields when editing
  useEffect(() => {
    if (isEditMode && editParticipant) {
      setValue('full_name', editParticipant.full_name)
      setValue('bib_name', editParticipant.bib_name)
      setValue('email', editParticipant.email)
      setValue('phone', editParticipant.phone)
      setValue('gender', editParticipant.gender)
      setValue('tshirt_size', editParticipant.tshirt_size)
      setValue('blood_type', editParticipant.blood_type || 'A')
      setValue('medical_condition', editParticipant.medical_condition || '')
    } else {
      reset()
    }
  }, [editParticipant, isEditMode, isOpen, setValue, reset])

  const onSubmit = async (values: ParticipantFormValues) => {
    let result
    if (isEditMode && editParticipant) {
      result = await updateParticipant(editParticipant.id, values)
    } else {
      result = await addParticipant(values)
    }

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
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditMode ? 'Edit Data Peserta' : 'Tambah Peserta Baru'}
    >
      <div className="flex flex-col gap-5">
        {/* Header Info */}
        <div className="flex items-center gap-3 bg-sport-orange/10 border border-sport-orange/20 rounded-lg p-3">
          <UserPlus className="w-4 h-4 text-sport-orange flex-shrink-0" />
          <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
            Peserta akan didaftarkan untuk{' '}
            <span className="text-sport-orange font-bold">TOPSELL RUN 2026 — Kategori 6K</span>.
            Nomor BIB dan QR Pass akan digenerate otomatis setelah pembayaran lunas.
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Jenis Kelamin"
              error={errors.gender?.message}
              disabled={isSubmitting}
              options={[
                { value: 'male', label: '♂ Laki-laki' },
                { value: 'female', label: '♀ Perempuan' }
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
                { value: '5XL', label: '5XL' }
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
                { value: 'O', label: 'O' }
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

          {!isEditMode && (
            <div className="border-t border-card-border pt-4">
              <h3 className="text-sm font-semibold text-brand-default mb-3">Alamat</h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Provinsi"
                  placeholder={loadingProvinsi ? 'Memuat provinsi...' : 'Pilih provinsi'}
                  error={errors.provinsi?.message}
                  disabled={isSubmitting || loadingProvinsi}
                  options={provinsiList}
                  {...register('provinsi')}
                />

                <Select
                  label="Kota / Kabupaten"
                  placeholder={selectedProvinsi ? (loadingKota ? 'Memuat kota...' : 'Pilih kota/kabupaten') : 'Pilih provinsi dulu'}
                  error={errors.kota?.message}
                  disabled={isSubmitting || loadingKota || !selectedProvinsi}
                  options={kotaList}
                  {...register('kota')}
                />

                <Select
                  label="Kecamatan"
                  placeholder={selectedKota ? (loadingKecamatan ? 'Memuat kecamatan...' : 'Pilih kecamatan') : 'Pilih kota dulu'}
                  error={errors.kecamatan?.message}
                  disabled={isSubmitting || loadingKecamatan || !selectedKota}
                  options={kecamatanList}
                  {...register('kecamatan')}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-card-border">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              isLoading={isSubmitting}
            >
              {isEditMode ? 'Simpan Perubahan' : 'Tambah Peserta'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
