import { z } from 'zod'

const phoneRegex = /^08[1-9][0-9]{8,11}$/
const emailDomainRegex = /@(gmail\.com|yahoo\.com|yahoo\.co\.id|icloud\.com|hotmail\.com|outlook\.com)$/i
const emailSchema = z
  .string()
  .min(1, 'Email wajib diisi')
  .email('Format email tidak valid')
  .refine((val) => emailDomainRegex.test(val), 'Email harus menggunakan domain resmi (Gmail, Yahoo, iCloud, Hotmail, atau Outlook)')
const dateOfBirthSchema = z
  .string()
  .min(1, 'Tanggal lahir wajib diisi')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir tidak valid')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00`)
    const today = new Date()
    return !Number.isNaN(date.getTime()) && date < today
  }, 'Tanggal lahir tidak valid')

export const loginSchema = z.object({
  phone: z
    .string()
    .min(1, 'Nomor WhatsApp atau Email wajib diisi')
    .refine((val) => {
      const trimmed = val.trim()
      if (trimmed.includes('@')) {
        return z.string().email().safeParse(trimmed).success
      }
      return phoneRegex.test(trimmed)
    }, {
      message: 'Harap masukkan nomor WhatsApp yang valid (berawalan 08) atau email yang valid',
    }),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

export const participantItemSchema = z.object({
  full_name: z.string().min(3, 'Nama lengkap minimal 3 karakter').max(50, 'Nama lengkap maksimal 50 karakter'),
  bib_name: z.string().min(2, 'Nama BIB minimal 2 karakter').max(20, 'Nama BIB maksimal 20 karakter'),
  email: emailSchema,
  phone: z
    .string()
    .min(1, 'Nomor HP wajib diisi')
    .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
  date_of_birth: dateOfBirthSchema,
  gender: z.enum(['male', 'female'], { message: 'Jenis kelamin wajib dipilih' }),
  tshirt_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'], { message: 'Ukuran jersey wajib dipilih' }),
  blood_type: z.enum(['A', 'B', 'AB', 'O'], { message: 'Golongan darah wajib dipilih' }),
  medical_condition: z.string().max(120, 'Penyakit bawaan maksimal 120 karakter').optional().or(z.literal('')),
  emergency_contact_name: z.string().min(3, 'Nama kontak darurat minimal 3 karakter').max(50, 'Nama kontak darurat maksimal 50 karakter'),
  emergency_contact_phone: z
    .string()
    .min(1, 'Nomor kontak darurat wajib diisi')
    .regex(phoneRegex, 'Nomor kontak darurat harus berawalan 08 dan minimal 11 digit'),
})

export const registerSchema = z
  .object({
    name: z.string().min(3, 'Nama komunitas minimal 3 karakter').max(50, 'Nama komunitas maksimal 50 karakter'),
    leader_name: z.string().min(3, 'Nama ketua minimal 3 karakter').max(50, 'Nama ketua maksimal 50 karakter'),
    phone: z
      .string()
      .min(1, 'Nomor HP wajib diisi')
      .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
    email: emailSchema,
    category: z.literal('6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', { message: 'Kategori wajib dipilih' }),
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
    participants: z.array(participantItemSchema).min(3, 'Minimal 3 peserta harus didaftarkan'),
    agreement_safety: z.boolean().refine(val => val === true, 'Persetujuan risiko wajib dicentang'),
    agreement_data: z.boolean().refine(val => val === true, 'Persetujuan data wajib dicentang'),
    agreement_refund: z.boolean().refine(val => val === true, 'Persetujuan pembatalan/S&K wajib dicentang'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })
  .refine((data) => {
    // Check for duplicate participants within the same registration (same email OR same phone)
    const emailPhonePairs = new Set<string>()
    for (const participant of data.participants) {
      const pair = `${participant.email.toLowerCase()}|${participant.phone}`
      if (emailPhonePairs.has(pair)) {
        return false
      }
      emailPhonePairs.add(pair)
    }
    return true
  }, {
    message: 'Ada peserta dengan email atau nomor HP yang sama. Setiap peserta harus memiliki email dan nomor HP yang unik.',
    path: ['participants'],
  })

export const registerFamilySchema = z
  .object({
    name: z.string().min(3, 'Nama keluarga minimal 3 karakter').max(50, 'Nama keluarga maksimal 50 karakter'),
    leader_name: z.string().min(3, 'Nama perwakilan keluarga minimal 3 karakter').max(50, 'Nama perwakilan keluarga maksimal 50 karakter'),
    phone: z
      .string()
      .min(1, 'Nomor HP wajib diisi')
      .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
    email: emailSchema,
    category: z.literal('6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', { message: 'Kategori wajib dipilih' }),
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
    participants: z.array(participantItemSchema).min(3, 'Minimal 3 peserta harus didaftarkan'),
    agreement_safety: z.boolean().refine(val => val === true, 'Persetujuan risiko wajib dicentang'),
    agreement_data: z.boolean().refine(val => val === true, 'Persetujuan data wajib dicentang'),
    agreement_refund: z.boolean().refine(val => val === true, 'Persetujuan pembatalan/S&K wajib dicentang'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })
  .refine((data) => {
    // Check for duplicate participants within the same registration (same email OR same phone)
    const emailPhonePairs = new Set<string>()
    for (const participant of data.participants) {
      const pair = `${participant.email.toLowerCase()}|${participant.phone}`
      if (emailPhonePairs.has(pair)) {
        return false
      }
      emailPhonePairs.add(pair)
    }
    return true
  }, {
    message: 'Ada peserta dengan email atau nomor HP yang sama. Setiap peserta harus memiliki email dan nomor HP yang unik.',
    path: ['participants'],
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type RegisterFamilyFormValues = z.infer<typeof registerFamilySchema>
export type ParticipantItemValues = z.infer<typeof participantItemSchema>
