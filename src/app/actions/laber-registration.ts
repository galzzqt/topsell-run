'use server'

import { after } from 'next/server'
import {
  createLaber,
  findLaberByPhone,
  isDuplicateKeyError,
} from '@/lib/db'
import {
  registerLaberSchema,
  normalizeLaberPhone,
  RegisterLaberFormValues,
} from '@/lib/validations/laber'
import { sendLaberRegistrationConfirmationWebhook } from '@/lib/ghl/webhook'
import { ingestAdminLog } from '@/lib/axiom/ingest'
import { rateLimitByIp } from '@/lib/security/rate-limit'
import { checkPackageQuota, isPackageOpen } from '@/lib/admin/settings'

const ALREADY_REGISTERED = 'Nomor WhatsApp ini sudah terdaftar untuk kegiatan Laber. Hubungi admin jika ada kendala.'

export async function registerLaber(values: RegisterLaberFormValues) {
  // Rate limit pendaftaran Laber
  const limit = await rateLimitByIp('laber-signup', 60, 5 * 60 * 1000)
  if (limit.limited) {
    return { error: 'Terlalu banyak percobaan registrasi. Coba lagi beberapa menit lagi.' }
  }

  // Validasi form data
  const validated = registerLaberSchema.safeParse(values)
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message || 'Data pendaftaran tidak valid' }
  }

  const { name, phone: rawPhone, community } = validated.data
  const phone = normalizeLaberPhone(rawPhone)

  // Paket buka/tutup, jadwal & daftar komunitas diatur admin (Kelola Paket / Kelola Periode)
  const gate = await isPackageOpen('laber')
  if (!gate.open) {
    return { error: gate.reason || 'Pendaftaran Laber sedang ditutup.' }
  }
  if (!gate.period?.categories.some((c) => c.value === community)) {
    return { error: 'Silakan pilih salah satu komunitas yang tersedia di daftar' }
  }
  const quota = await checkPackageQuota('laber', 1, community)
  if (!quota.ok) {
    return { error: quota.reason || 'Kuota komunitas ini sudah penuh.' }
  }

  // Cek nomor WhatsApp sudah terdaftar
  const existing = await findLaberByPhone(phone)
  if (existing) {
    return { error: ALREADY_REGISTERED }
  }

  let laber
  try {
    laber = await createLaber({
      name,
      phone,
      community,
    })
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { error: ALREADY_REGISTERED }
    }
    console.error('Failed to create laber registration:', error)
    return { error: 'Gagal menyimpan pendaftaran Laber. Silakan coba lagi.' }
  }

  const laberCode = laber.laber_code

  // Webhook & audit log setelah respons terkirim
  after(async () => {
    const results = await Promise.allSettled([
      sendLaberRegistrationConfirmationWebhook({
        phone,
        name,
        community,
        laberCode,
      }),
      ingestAdminLog({
        level: 'info',
        source: 'auth',
        event: 'laber_signup',
        message: `Pendaftaran Laber baru: ${name} (WA: ${phone}, Komunitas: ${community}, Kode: ${laberCode}).`,
        data: { name, phone, community, laberCode },
      }),
    ])

    results.forEach((res, index) => {
      if (res.status === 'rejected') {
        const label = index === 0 ? 'webhook' : 'log'
        console.error(`Laber ${label} failed for ${laberCode}:`, res.reason)
      }
    })
  })

  return { success: true, laberCode }
}
