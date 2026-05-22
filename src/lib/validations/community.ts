import { z } from 'zod'

const phoneRegex = /^08[1-9][0-9]{8,11}$/

export const communityProfileSchema = z.object({
  name: z.string().min(3, 'Nama komunitas minimal 3 karakter').max(50, 'Nama komunitas maksimal 50 karakter'),
  leader_name: z.string().min(3, 'Nama ketua minimal 3 karakter').max(50, 'Nama ketua maksimal 50 karakter'),
  phone: z
    .string()
    .min(1, 'Nomor HP wajib diisi')
    .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
  provinsi: z.string().min(1, 'Provinsi wajib dipilih'),
  kota: z.string().min(1, 'Kota/Kabupaten wajib dipilih'),
  kecamatan: z.string().min(1, 'Kecamatan wajib dipilih'),
})

export type CommunityProfileValues = z.infer<typeof communityProfileSchema>
