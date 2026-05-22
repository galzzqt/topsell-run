import { z } from 'zod'

const phoneRegex = /^08[1-9][0-9]{8,11}$/
const emailDomainRegex = /@(gmail\.com|yahoo\.com|yahoo\.co\.id|icloud\.com|hotmail\.com|outlook\.com)$/i

export const participantSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Nama lengkap minimal 3 karakter')
    .max(80, 'Nama lengkap maksimal 80 karakter'),
  bib_name: z
    .string()
    .min(2, 'Nama BIB minimal 2 karakter')
    .max(20, 'Nama BIB maksimal 20 karakter'),
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
  medical_condition: z
    .string()
    .max(120, 'Penyakit bawaan maksimal 120 karakter')
    .optional()
    .or(z.literal('')),
  provinsi: z
    .string()
    .min(1, 'Provinsi wajib dipilih'),
  kota: z
    .string()
    .min(1, 'Kota/Kabupaten wajib dipilih'),
  kecamatan: z
    .string()
    .min(1, 'Kecamatan wajib dipilih'),
})

export const participantFormSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Nama lengkap minimal 3 karakter')
    .max(80, 'Nama lengkap maksimal 80 karakter'),
  bib_name: z
    .string()
    .min(2, 'Nama BIB minimal 2 karakter')
    .max(20, 'Nama BIB maksimal 20 karakter'),
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
  medical_condition: z
    .string()
    .max(120, 'Penyakit bawaan maksimal 120 karakter')
    .optional()
    .or(z.literal('')),
  provinsi: z.string().optional().or(z.literal('')),
  kota: z.string().optional().or(z.literal('')),
  kecamatan: z.string().optional().or(z.literal('')),
})

export const participantEditSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Nama lengkap minimal 3 karakter')
    .max(80, 'Nama lengkap maksimal 80 karakter'),
  bib_name: z
    .string()
    .min(2, 'Nama BIB minimal 2 karakter')
    .max(20, 'Nama BIB maksimal 20 karakter'),
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
  medical_condition: z
    .string()
    .max(120, 'Penyakit bawaan maksimal 120 karakter')
    .optional()
    .or(z.literal('')),
})

export type ParticipantFormValues = z.infer<typeof participantFormSchema>
