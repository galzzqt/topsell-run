import { z } from 'zod'

const phoneRegex = /^08[1-9][0-9]{8,11}$/
const ktpNumberSchema = z
  .string()
  .min(1, 'Nomor KTP wajib diisi')
  .regex(/^\d{16}$/, 'Nomor KTP harus 16 digit angka')
const emailDomainRegex = /@(gmail\.com|yahoo\.com|yahoo\.co\.id|icloud\.com|hotmail\.com|outlook\.com)$/i
const emailSchema = z
  .string()
  .min(1, 'Email wajib diisi')
  .email('Format email tidak valid')
  .refine((val) => emailDomainRegex.test(val), 'Email harus menggunakan domain resmi (Gmail, Yahoo, iCloud, Hotmail, atau Outlook)')
const dateOfBirthSchema = z
  .string()
  .min(1, 'Tanggal lahir wajib diisi')
  .regex(/^\d{2}\/\d{2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir tidak valid (gunakan DD/MM/YYYY)')
  .refine((value) => {
    // Support both DD/MM/YYYY and YYYY-MM-DD formats
    let date: Date
    if (value.includes('/')) {
      // DD/MM/YYYY format
      const [day, month, year] = value.split('/')
      date = new Date(`${year}-${month}-${day}T00:00:00`)
    } else {
      // YYYY-MM-DD format (ISO)
      date = new Date(`${value}T00:00:00`)
    }
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
  ktp_number: ktpNumberSchema,
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
    const emails = new Set<string>()
    const phones = new Set<string>()
    for (const participant of data.participants) {
      const email = participant.email.trim().toLowerCase()
      const phone = participant.phone.trim()
      if (emails.has(email) || phones.has(phone)) {
        return false
      }
      emails.add(email)
      phones.add(phone)
    }
    return true
  }, {
    message: 'Ada peserta dengan email atau nomor HP yang sama. Setiap peserta harus memiliki email dan nomor HP yang unik.',
    path: ['participants'],
  })

// Kategori Bro & Sist / Komunitas tetap flat 135.000; individu punya 2 kategori berharga beda.
const familyCategorySchema = z.literal('6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', { message: 'Kategori wajib dipilih' })
// Kategori individu dikelola admin (Kelola Paket), jadi terima string apa pun yang terisi.
const individualCategorySchema = z.string().min(1, 'Kategori wajib dipilih')

// Bro & Sist butuh minimal 3 peserta, pendaftaran individu cukup 1.
const makeFamilySchema = <C extends z.ZodTypeAny>(minParticipants: number, categorySchema: C) => z
  .object({
    name: z.string().min(3, 'Nama grup minimal 3 karakter').max(50, 'Nama grup maksimal 50 karakter'),
    leader_name: z.string().min(3, 'Nama perwakilan minimal 3 karakter').max(50, 'Nama perwakilan maksimal 50 karakter'),
    phone: z
      .string()
      .min(1, 'Nomor HP wajib diisi')
      .regex(phoneRegex, 'Nomor HP harus berawalan 08 dan minimal 11 digit'),
    email: emailSchema,
    category: categorySchema,
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
    participants: z.array(participantItemSchema).min(minParticipants, `Minimal ${minParticipants} peserta harus didaftarkan`),
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
    const emails = new Set<string>()
    const phones = new Set<string>()
    for (const participant of data.participants) {
      const email = participant.email.trim().toLowerCase()
      const phone = participant.phone.trim()
      if (emails.has(email) || phones.has(phone)) {
        return false
      }
      emails.add(email)
      phones.add(phone)
    }
    return true
  }, {
    message: 'Ada peserta dengan email atau nomor HP yang sama. Setiap peserta harus memiliki email dan nomor HP yang unik.',
    path: ['participants'],
  })

export const registerFamilySchema = makeFamilySchema(3, familyCategorySchema)
export const registerSoloSchema = makeFamilySchema(1, individualCategorySchema)

// Form pendaftaran individu: data grup & data peserta digabung jadi satu level.
export const registerIndividualSchema = participantItemSchema
  .extend({
    category: individualCategorySchema,
    provinsi: z.string().min(1, 'Provinsi wajib dipilih'),
    kota: z.string().min(1, 'Kota/Kabupaten wajib dipilih'),
    kecamatan: z.string().min(1, 'Kecamatan wajib dipilih'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
    agreement_safety: z.boolean().refine(val => val === true, 'Persetujuan risiko wajib dicentang'),
    agreement_data: z.boolean().refine(val => val === true, 'Persetujuan data wajib dicentang'),
    agreement_refund: z.boolean().refine(val => val === true, 'Persetujuan pembatalan/S&K wajib dicentang'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })

// Kategori pacer dikelola admin (Kelola Paket), sama seperti individu.
const pacerCategorySchema = z.string().min(1, 'Kategori wajib dipilih')

// Form pendaftaran pacer: field individu + field khusus pacer (sosmed, strava, rekening, smartwatch, usia, foto).
export const registerPacerSchema = participantItemSchema
  .extend({
    category: pacerCategorySchema,
    provinsi: z.string().min(1, 'Provinsi wajib dipilih'),
    kota: z.string().min(1, 'Kota/Kabupaten wajib dipilih'),
    kecamatan: z.string().min(1, 'Kecamatan wajib dipilih'),
    age: z.coerce.number({ message: 'Usia wajib diisi' }).int('Usia harus bilangan bulat').min(10, 'Usia tidak valid').max(100, 'Usia tidak valid'),
    sosmed_instagram: z.string().min(1, 'Link Instagram wajib diisi').url('Link Instagram tidak valid (contoh: https://instagram.com/username)'),
    sosmed_tiktok: z.string().url('Link TikTok tidak valid (contoh: https://tiktok.com/@username)').optional().or(z.literal('')),
    strava_link: z.string().min(1, 'Link Strava wajib diisi').url('Link Strava tidak valid (contoh: https://strava.com/athletes/username)'),
    strava_username: z.string().min(1, 'Username Strava wajib diisi').max(50, 'Maksimal 50 karakter'),
    bank_name: z.string().min(1, 'Nama bank wajib diisi').max(50, 'Maksimal 50 karakter'),
    bank_account_number: z.string().min(1, 'Nomor rekening wajib diisi').max(30, 'Maksimal 30 karakter'),
    bank_account_holder: z.string().min(1, 'Nama pemilik rekening wajib diisi').max(50, 'Maksimal 50 karakter'),
    has_smartwatch: z.enum(['yes', 'no'], { message: 'Wajib dipilih' }),
    media_urls: z.array(z.string().url()).min(1, 'Minimal 1 foto portofolio wajib diupload').max(5, 'Maksimal 5 foto'),
    pb_media_urls: z.array(z.string().url()).min(1, 'Minimal 1 foto Personal Best (PB) wajib diupload').max(5, 'Maksimal 5 foto'),
    password: z.string().min(6, 'Password minimal 6 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
    agreement_safety: z.boolean().refine((val) => val === true, 'Persetujuan risiko wajib dicentang'),
    agreement_data: z.boolean().refine((val) => val === true, 'Persetujuan data wajib dicentang'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type RegisterFamilyFormValues = z.infer<typeof registerFamilySchema>
export type RegisterSoloFormValues = z.infer<typeof registerSoloSchema>
export type RegisterIndividualFormValues = z.infer<typeof registerIndividualSchema>
export type RegisterPacerFormValues = z.infer<typeof registerPacerSchema>
// Input type (pre-coerce/pre-default) — dipakai sebagai generic useForm karena `age` (coerce)
// dan `media_urls` (default) membuat input/output schema berbeda secara struktural.
export type RegisterPacerFormInput = z.input<typeof registerPacerSchema>
export type ParticipantItemValues = z.infer<typeof participantItemSchema>
