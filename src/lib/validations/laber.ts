import { z } from 'zod'

/**
 * Normalisasi nomor HP/WhatsApp ke format standar '08xxx'
 */
export function normalizeLaberPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}

// Regex validasi WhatsApp Indonesia (format 08xxx dengan panjang 10-14 digit)
const indonesianPhoneRegex = /^08[1-9][0-9]{7,11}$/

export const registerLaberSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama lengkap wajib diisi')
    .min(3, 'Nama lengkap minimal 3 karakter')
    .max(100, 'Nama lengkap maksimal 100 karakter'),
  phone: z
    .string()
    .trim()
    .min(1, 'Nomor WhatsApp wajib diisi')
    .refine((val) => {
      const normalized = normalizeLaberPhone(val)
      return indonesianPhoneRegex.test(normalized)
    }, {
      message: 'Nomor WhatsApp tidak valid. Gunakan format Indonesia yang aktif (contoh: 081234567890)',
    }),
  // Keanggotaan daftar komunitas dicek di server terhadap kategori periode aktif paket 'laber'.
  community: z.string().trim().min(1, 'Pilihan komunitas wajib dipilih'),
})

export type RegisterLaberFormValues = z.infer<typeof registerLaberSchema>
