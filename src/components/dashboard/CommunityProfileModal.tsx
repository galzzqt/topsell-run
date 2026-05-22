'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2 } from 'lucide-react'
import { useAppStore } from '@/lib/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import { fetchProvinsi, fetchKota, fetchKecamatan } from '@/lib/utils/location'
import { communityProfileSchema, CommunityProfileValues } from '@/lib/validations/community'
import { updateCommunityProfile } from '@/app/actions/communities'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface CommunityProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

interface LocationOption {
  value: string
  label: string
}

export function CommunityProfileModal({ isOpen, onClose }: CommunityProfileModalProps) {
  const supabase = createClient()
  const { user, community, fetchCommunityData } = useAppStore()

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
  } = useForm<CommunityProfileValues>({
    resolver: zodResolver(communityProfileSchema),
    defaultValues: {
      name: '',
      leader_name: '',
      phone: '',
      provinsi: '',
      kota: '',
      kecamatan: '',
    },
  })

  const selectedProvinsi = watch('provinsi')
  const selectedKota = watch('kota')

  useEffect(() => {
    const loadProvinsi = async () => {
      setLoadingProvinsi(true)
      try {
        const data = await fetchProvinsi()
        setProvinsiList(data)
      } finally {
        setLoadingProvinsi(false)
      }
    }

    if (isOpen) loadProvinsi()
  }, [isOpen])

  useEffect(() => {
    const loadKota = async () => {
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
      } finally {
        setLoadingKota(false)
      }
    }

    loadKota()
  }, [selectedProvinsi, setValue])

  useEffect(() => {
    const loadKecamatan = async () => {
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
      } finally {
        setLoadingKecamatan(false)
      }
    }

    loadKecamatan()
  }, [selectedKota, setValue])

  useEffect(() => {
    if (!isOpen) return
    if (!community) return

    reset({
      name: community.name || '',
      leader_name: community.leader_name || '',
      phone: community.phone || '',
      provinsi: community.provinsi || '',
      kota: community.kota || '',
      kecamatan: community.kecamatan || '',
    })
  }, [community, isOpen, reset])

  const onSubmit = async (values: CommunityProfileValues) => {
    const result = await updateCommunityProfile(values)
    if (result.error) {
      alert(result.error)
      return
    }

    if (user?.id) {
      await fetchCommunityData(supabase, user.id)
    }
    onClose()
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  return (
    <Dialog isOpen={isOpen} onClose={handleClose} title="Edit Profil Komunitas">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3 bg-sport-orange/10 border border-sport-orange/20 rounded-lg p-3">
          <Building2 className="w-4 h-4 text-sport-orange flex-shrink-0" />
          <p className="text-[10px] text-brand-muted leading-relaxed font-medium">
            Perbarui data komunitas dan alamat. Alamat ini digunakan untuk administrasi dan pengelompokan wilayah.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nama Komunitas"
              placeholder="Nama komunitas"
              error={errors.name?.message}
              disabled={isSubmitting}
              {...register('name')}
            />
            <Input
              label="Nama Ketua"
              placeholder="Nama ketua"
              error={errors.leader_name?.message}
              disabled={isSubmitting}
              {...register('leader_name')}
            />
          </div>

          <Input
            label="No. HP / WhatsApp"
            placeholder="08xxxxxxxxxx"
            error={errors.phone?.message}
            disabled={isSubmitting}
            {...register('phone')}
          />

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
