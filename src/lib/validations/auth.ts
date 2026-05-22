import { z } from 'zod'

const phoneRegex = /^08[1-9][0-9]{8,11}$/
const emailDomainRegex = /@(gmail\.com|yahoo\.com|yahoo\.co\.id|icloud\.com|hotmail\.com|outlook\.com)$/i

export const loginSchema = z.object({
  email: z.string().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

export const participantItemSchema = z.object({
  full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(50, 'Nama lengkap maksimal 50 karakter'),
  bib_name: z.string().min(2, 'Nama BIB minimal 2 karakter').max(20, 'Nama BIB maksimal 20 karakter'),
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid')
    .refine((val) => emailDomainRegex.test(val), 'Email harus menggunakan domain resmi (Gmail, Yahoo, iCloud, Hotmail, atau Outlook)'),
  phone: z
    .string()
    .min(1, 'Nomor HP wajib diisi')
    .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
  gender: z.enum(['male', 'female'], { message: 'Jenis kelamin wajib dipilih' }),
  tshirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'], { message: 'Ukuran jersey wajib dipilih' }),
  blood_type: z.enum(['A', 'B', 'AB', 'O'], { message: 'Golongan darah wajib dipilih' }),
  medical_condition: z.string().max(120, 'Penyakit bawaan maksimal 120 karakter').optional().or(z.literal('')),
})

export const registerSchema = z
  .object({
    name: z.string().min(3, 'Nama komunitas minimal 3 karakter').max(50, 'Nama komunitas maksimal 50 karakter'),
    leader_name: z.string().min(3, 'Nama ketua minimal 3 karakter').max(50, 'Nama ketua maksimal 50 karakter'),
    phone: z
      .string()
      .min(1, 'Nomor HP wajib diisi')
      .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
    email: z
      .string()
      .min(1, 'Email wajib diisi')
      .email('Format email tidak valid')
      .refine((val) => emailDomainRegex.test(val), 'Email harus menggunakan domain resmi (Gmail, Yahoo, iCloud, Hotmail, atau Outlook)'),
    provinsi: z
      .string()
      .min(1, 'Provinsi wajib dipilih'),
    kota: z
      .string()
      .min(1, 'Kota/Kabupaten wajib dipilih'),
    kecamatan: z
      .string()
      .min(1, 'Kecamatan wajib dipilih'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
    participants: z.array(participantItemSchema).min(10, 'Minimal 10 peserta harus didaftarkan'),
    agreement_safety: z.boolean().refine(val => val === true, 'Persetujuan risiko wajib dicentang'),
    agreement_data: z.boolean().refine(val => val === true, 'Persetujuan data wajib dicentang'),
    agreement_refund: z.boolean().refine(val => val === true, 'Persetujuan pembatalan/S&K wajib dicentang'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type ParticipantItemValues = z.infer<typeof participantItemSchema>
