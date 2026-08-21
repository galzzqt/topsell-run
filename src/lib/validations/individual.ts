import { z } from 'zod'

const phoneRegex = /^08[1-9][0-9]{8,11}$/
const emailDomainRegex = /@(gmail\.com|yahoo\.com|yahoo\.co\.id|icloud\.com|hotmail\.com|outlook\.com)$/i

export const individualProfileSchema = z.object({
  full_name: z.string().min(3, 'Nama minimal 3 karakter').max(50, 'Nama maksimal 50 karakter'),
  community_name: z.string().max(100, 'Nama instansi/komunitas maksimal 100 karakter').optional().or(z.literal('')),
  phone: z
    .string()
    .min(1, 'Nomor HP wajib diisi')
    .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid')
    .refine((val) => emailDomainRegex.test(val), 'Email harus menggunakan domain resmi'),
  password: z.string().optional().or(z.literal('')),
}).refine((data) => !data.password || data.password.length >= 6, {
  message: 'Password minimal 6 karakter',
  path: ['password'],
})

export type IndividualProfileValues = z.infer<typeof individualProfileSchema>
