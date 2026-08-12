import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'
import { getAppSetting, upsertAppSetting } from '@/lib/db'
import {
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_EMAIL_TEMPLATE_SETTINGS,
  DEFAULT_PACKAGES_SETTINGS,
  DEFAULT_SITE_ASSETS,
  DEFAULT_WEBHOOK_SETTINGS,
  EDITABLE_ENV_FIELDS,
  type AdminEnvSnapshot,
  type AdminEditableEnvField,
  type AdminSettings,
  type EmailTemplateConfig,
  type EmailTemplateSettings,
  type PackageCategory,
  type PackageConfig,
  type PackageKey,
  type PackagePeriod,
  type PackagesSettings,
  type RegistrationFormPackageSettings,
  type RegistrationFormSettings,
  type SiteAssets,
  type WebhookPackageConfig,
  type WebhookSettings,
} from './settings-schema'

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'admin-settings.json')
const ENV_PATH = path.join(process.cwd(), '.env.local')
const FORM_SETTINGS_KEY = 'registration_form'

const PACKAGE_KEYS: PackageKey[] = ['community', 'family', 'individual', 'pacer']

function mergeInput<T extends { label: string; placeholder: string; visible: boolean; required: boolean }>(base: T, value: Partial<T> | undefined): T {
  return {
    ...base,
    ...value,
    label: typeof value?.label === 'string' ? value.label : base.label,
    placeholder: typeof value?.placeholder === 'string' ? value.placeholder : base.placeholder,
    visible: typeof value?.visible === 'boolean' ? value.visible : base.visible,
    required: typeof value?.required === 'boolean' ? value.required : base.required,
  }
}

function normalizeEnvFields(value: AdminEditableEnvField[] | undefined): AdminEditableEnvField[] {
  if (!Array.isArray(value)) return []
  const builtInKeys = new Set(EDITABLE_ENV_FIELDS.map((field) => field.key))

  return value
    .map((field) => {
      const key = typeof field.key === 'string' ? field.key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_') : ''
      const label = typeof field.label === 'string' ? field.label.trim() : ''
      return {
        key,
        label: label || key,
        description: typeof field.description === 'string' ? field.description.trim() : '',
        sensitive: Boolean(field.sensitive),
      }
    })
    .filter((field, index, fields) => field.key && !builtInKeys.has(field.key) && fields.findIndex((item) => item.key === field.key) === index)
}

function normalizeRegistrationFormPackage(
  base: RegistrationFormPackageSettings,
  value: Partial<RegistrationFormPackageSettings> | undefined
): RegistrationFormPackageSettings {
  return {
    registrant: {
      name: mergeInput(base.registrant.name, value?.registrant?.name),
      leader_name: mergeInput(base.registrant.leader_name, value?.registrant?.leader_name),
      phone: mergeInput(base.registrant.phone, value?.registrant?.phone),
      email: mergeInput(base.registrant.email, value?.registrant?.email),
      category: {
        ...mergeInput(base.registrant.category, value?.registrant?.category),
        options: Array.isArray(value?.registrant?.category?.options) && value.registrant!.category!.options.length > 0
          ? value!.registrant!.category!.options
          : base.registrant.category.options,
      },
      provinsi: mergeInput(base.registrant.provinsi, value?.registrant?.provinsi),
      kota: mergeInput(base.registrant.kota, value?.registrant?.kota),
      kecamatan: mergeInput(base.registrant.kecamatan, value?.registrant?.kecamatan),
      password: mergeInput(base.registrant.password, value?.registrant?.password),
      confirmPassword: mergeInput(base.registrant.confirmPassword, value?.registrant?.confirmPassword),
    },
    participants: {
      full_name: mergeInput(base.participants.full_name, value?.participants?.full_name),
      bib_name: mergeInput(base.participants.bib_name, value?.participants?.bib_name),
      ktp_number: mergeInput(base.participants.ktp_number, value?.participants?.ktp_number),
      email: mergeInput(base.participants.email, value?.participants?.email),
      phone: mergeInput(base.participants.phone, value?.participants?.phone),
      date_of_birth: mergeInput(base.participants.date_of_birth, value?.participants?.date_of_birth),
      gender: {
        ...mergeInput(base.participants.gender, value?.participants?.gender),
        options: base.participants.gender.options.map((option) => ({
          ...option,
          label: value?.participants?.gender?.options?.find((item) => item.value === option.value)?.label || option.label,
        })),
      },
      tshirt_size: {
        ...mergeInput(base.participants.tshirt_size, value?.participants?.tshirt_size),
        options: Array.isArray(value?.participants?.tshirt_size?.options) && value.participants!.tshirt_size!.options.length > 0
          ? value!.participants!.tshirt_size!.options
          : base.participants.tshirt_size.options,
      },
      blood_type: {
        ...mergeInput(base.participants.blood_type, value?.participants?.blood_type),
        options: base.participants.blood_type.options.map((option) => ({
          ...option,
          label: value?.participants?.blood_type?.options?.find((item) => item.value === option.value)?.label || option.label,
        })),
      },
      medical_condition: mergeInput(base.participants.medical_condition, value?.participants?.medical_condition),
      emergency_contact_name: mergeInput(base.participants.emergency_contact_name, value?.participants?.emergency_contact_name),
      emergency_contact_phone: mergeInput(base.participants.emergency_contact_phone, value?.participants?.emergency_contact_phone),
      age: mergeInput(base.participants.age, value?.participants?.age),
      sosmed_instagram: mergeInput(base.participants.sosmed_instagram, value?.participants?.sosmed_instagram),
      sosmed_tiktok: mergeInput(base.participants.sosmed_tiktok, value?.participants?.sosmed_tiktok),
      strava_link: mergeInput(base.participants.strava_link, value?.participants?.strava_link),
      strava_username: mergeInput(base.participants.strava_username, value?.participants?.strava_username),
      bank_name: mergeInput(base.participants.bank_name, value?.participants?.bank_name),
      bank_account_number: mergeInput(base.participants.bank_account_number, value?.participants?.bank_account_number),
      bank_account_holder: mergeInput(base.participants.bank_account_holder, value?.participants?.bank_account_holder),
      has_smartwatch: {
        ...mergeInput(base.participants.has_smartwatch, value?.participants?.has_smartwatch),
        options: base.participants.has_smartwatch.options.map((option) => ({
          ...option,
          label: value?.participants?.has_smartwatch?.options?.find((item) => item.value === option.value)?.label || option.label,
        })),
      },
    },
  }
}

export function normalizeRegistrationFormSettings(value: Partial<RegistrationFormSettings> | undefined): RegistrationFormSettings {
  const base = DEFAULT_ADMIN_SETTINGS.registrationForm
  return {
    community: normalizeRegistrationFormPackage(base.community, value?.community),
    family: normalizeRegistrationFormPackage(base.family, value?.family),
    individual: normalizeRegistrationFormPackage(base.individual, value?.individual),
    pacer: normalizeRegistrationFormPackage(base.pacer, value?.pacer),
  }
}

function normalizePackageCategory(cat: Partial<PackageCategory> | undefined): PackageCategory {
  return {
    value: typeof cat?.value === 'string' ? cat.value.trim() : '',
    label: typeof cat?.label === 'string' ? cat.label.trim() : '',
    price: Number.isFinite(Number(cat?.price)) ? Math.max(0, Math.round(Number(cat!.price))) : 0,
    quota: Number.isFinite(Number(cat?.quota)) ? Math.max(0, Math.round(Number(cat!.quota))) : 0,
  }
}

function normalizePackagePeriod(period: Partial<PackagePeriod> | undefined, index: number): PackagePeriod | null {
  if (!period) return null
  const categories = Array.isArray(period.categories)
    ? period.categories.map(normalizePackageCategory).filter((cat) => cat.value && cat.label)
    : []

  return {
    key: typeof period.key === 'string' && period.key.trim() ? period.key.trim() : `periode-${index + 1}`,
    label: typeof period.label === 'string' && period.label.trim() ? period.label.trim() : `Periode ${index + 1}`,
    registrationStart: typeof period.registrationStart === 'string' ? period.registrationStart : '',
    registrationEnd: typeof period.registrationEnd === 'string' ? period.registrationEnd : '',
    paymentStart: typeof period.paymentStart === 'string' ? period.paymentStart : '',
    paymentEnd: typeof period.paymentEnd === 'string' ? period.paymentEnd : '',
    eventDate: typeof period.eventDate === 'string' ? period.eventDate : '',
    categories,
  }
}

// Bentuk lama (sebelum fitur periode): periodStart/periodEnd/categories flat di level paket.
type LegacyPackageConfigInput = Partial<PackageConfig> & {
  periodStart?: string
  periodEnd?: string
  categories?: PackageCategory[]
}

function normalizePackageConfig(base: PackageConfig, value: LegacyPackageConfigInput | undefined): PackageConfig {
  let periodsInput = Array.isArray(value?.periods) ? value!.periods : undefined

  // Migrasi mundur: data lama tanpa `periods` dibungkus jadi satu periode "Periode 1",
  // supaya relasi participants/payments yang sudah ada tetap konsisten (lihat lib/types period_key).
  if (!periodsInput && (typeof value?.periodStart === 'string' || Array.isArray(value?.categories))) {
    periodsInput = [
      {
        key: 'periode-1',
        label: 'Periode 1',
        registrationStart: typeof value?.periodStart === 'string' ? value.periodStart : '',
        registrationEnd: typeof value?.periodEnd === 'string' ? value.periodEnd : '',
        paymentStart: '',
        paymentEnd: '',
        eventDate: '',
        categories: Array.isArray(value?.categories) ? value.categories : [],
      },
    ]
  }

  const periods = (periodsInput && periodsInput.length > 0 ? periodsInput : base.periods)
    .map((period, index) => normalizePackagePeriod(period, index))
    .filter((period): period is PackagePeriod => period !== null)

  return {
    label: typeof value?.label === 'string' && value.label.trim() ? value.label.trim() : base.label,
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : base.enabled,
    sizeChartImage: typeof value?.sizeChartImage === 'string' ? value.sizeChartImage : base.sizeChartImage,
    periods: periods.length > 0 ? periods : base.periods,
  }
}

function normalizePackagesSettings(value: Partial<PackagesSettings> | undefined): PackagesSettings {
  return {
    community: normalizePackageConfig(DEFAULT_PACKAGES_SETTINGS.community, value?.community),
    family: normalizePackageConfig(DEFAULT_PACKAGES_SETTINGS.family, value?.family),
    individual: normalizePackageConfig(DEFAULT_PACKAGES_SETTINGS.individual, value?.individual),
    pacer: normalizePackageConfig(DEFAULT_PACKAGES_SETTINGS.pacer, value?.pacer),
  }
}

function normalizeEmailTemplate(base: EmailTemplateConfig, value: Partial<EmailTemplateConfig> | undefined): EmailTemplateConfig {
  return {
    subject: typeof value?.subject === 'string' && value.subject.trim() ? value.subject : base.subject,
    greeting: typeof value?.greeting === 'string' && value.greeting.trim() ? value.greeting : base.greeting,
    bodyIntro: typeof value?.bodyIntro === 'string' && value.bodyIntro.trim() ? value.bodyIntro : base.bodyIntro,
    bodyOutro: typeof value?.bodyOutro === 'string' && value.bodyOutro.trim() ? value.bodyOutro : base.bodyOutro,
  }
}

function normalizeEmailTemplateSettings(value: Partial<EmailTemplateSettings> | undefined): EmailTemplateSettings {
  const base = DEFAULT_EMAIL_TEMPLATE_SETTINGS
  return {
    community: normalizeEmailTemplate(base.community, value?.community),
    family: normalizeEmailTemplate(base.family, value?.family),
    individual: normalizeEmailTemplate(base.individual, value?.individual),
    pacer: normalizeEmailTemplate(base.pacer, value?.pacer),
  }
}

function normalizeWebhookPackage(base: WebhookPackageConfig, value: Partial<WebhookPackageConfig> | undefined): WebhookPackageConfig {
  return {
    registration: {
      url: typeof value?.registration?.url === 'string' ? value.registration.url : base.registration.url,
      token: typeof value?.registration?.token === 'string' ? value.registration.token : base.registration.token,
    },
    payment: {
      url: typeof value?.payment?.url === 'string' ? value.payment.url : base.payment.url,
      token: typeof value?.payment?.token === 'string' ? value.payment.token : base.payment.token,
    },
  }
}

function normalizeWebhookSettings(value: Partial<WebhookSettings> | undefined): WebhookSettings {
  const base = DEFAULT_WEBHOOK_SETTINGS
  return {
    community: normalizeWebhookPackage(base.community, value?.community),
    family: normalizeWebhookPackage(base.family, value?.family),
    individual: normalizeWebhookPackage(base.individual, value?.individual),
    pacer: normalizeWebhookPackage(base.pacer, value?.pacer),
  }
}

function normalizeSiteAssets(value: Partial<SiteAssets> | undefined): SiteAssets {
  return {
    heroImage: typeof value?.heroImage === 'string' ? value.heroImage : DEFAULT_SITE_ASSETS.heroImage,
    logoImage: typeof value?.logoImage === 'string' ? value.logoImage : DEFAULT_SITE_ASSETS.logoImage,
  }
}

function normalizeAdminSettings(value: Partial<AdminSettings> | undefined): AdminSettings {
  return {
    registrationForm: normalizeRegistrationFormSettings(value?.registrationForm),
    emailTemplates: normalizeEmailTemplateSettings(value?.emailTemplates),
    webhookSettings: normalizeWebhookSettings(value?.webhookSettings),
    packages: normalizePackagesSettings(value?.packages),
    siteAssets: normalizeSiteAssets(value?.siteAssets),
    envFields: normalizeEnvFields(value?.envFields),
  }
}

/** Validasi jendela pendaftaran antar periode dalam satu paket tidak boleh bentrok. Return pesan error atau null jika aman. */
export function validatePackagePeriods(packages: PackagesSettings): string | null {
  for (const pkg of PACKAGE_KEYS) {
    const periods = packages[pkg].periods
    for (let i = 0; i < periods.length; i += 1) {
      for (let j = i + 1; j < periods.length; j += 1) {
        const a = periods[i]
        const b = periods[j]
        const aStart = a.registrationStart || '0000-00-00T00:00'
        const aEnd = a.registrationEnd || '9999-99-99T99:99'
        const bStart = b.registrationStart || '0000-00-00T00:00'
        const bEnd = b.registrationEnd || '9999-99-99T99:99'
        if (aStart <= bEnd && bStart <= aEnd) {
          return `Periode "${a.label}" dan "${b.label}" pada ${packages[pkg].label} bentrok jadwal pendaftarannya.`
        }
      }
    }
  }
  return null
}

// ——— Package helpers (server-side price & open-state resolution) ———

export async function getPackagesSettings(): Promise<PackagesSettings> {
  const settings = await readAdminSettings()
  return settings.packages
}

/** Cari periode yang memiliki kategori dengan value tertentu di sebuah paket. */
export async function resolvePeriodForCategory(pkg: PackageKey, category: string | null | undefined): Promise<PackagePeriod | null> {
  if (!category) return null
  const packages = await getPackagesSettings()
  const config = packages[pkg]
  return config?.periods.find((period) => period.categories.some((c) => c.value === category)) || null
}

/**
 * Harga per peserta untuk kategori paket, dari pengaturan admin.
 * Fallback ke priceForCategory (map hardcoded) jika kategori tak ditemukan.
 */
export async function resolvePackagePrice(pkg: PackageKey, category: string | null | undefined): Promise<number> {
  const { priceForCategory } = await import('@/lib/types')
  const period = await resolvePeriodForCategory(pkg, category)
  const match = period?.categories.find((c) => c.value === category)
  return match ? match.price : priceForCategory(category)
}

const PACKAGE_PARTICIPANT_COLLECTION: Record<PackageKey, string> = {
  community: 'participants',
  family: 'family_participants',
  individual: 'individual_participants',
  pacer: 'pacer_participants',
}

const PACKAGE_REGISTRATION_COLLECTION: Record<PackageKey, string> = {
  community: 'registrations',
  family: 'family_registrations',
  individual: 'individual_registrations',
  // Pacer tidak punya koleksi registrasi/payment terpisah — owner record-nya sekaligus "registrasi".
  pacer: 'pacer_registrations',
}

// Kategori disimpan di record owner (community/family/individual/pacer), bukan di peserta.
const PACKAGE_OWNER_COLLECTION: Record<PackageKey, string> = {
  community: 'communities',
  family: 'families',
  individual: 'individuals',
  pacer: 'pacer_registrations',
}

const PACKAGE_OWNER_ID_FIELD: Record<PackageKey, string> = {
  community: 'community_id',
  family: 'family_id',
  individual: 'individual_id',
  pacer: 'pacer_id',
}

/** Jumlah peserta aktif (pending/paid) untuk sebuah kategori dalam paket (join ke record owner). */
async function countPackageParticipantsByCategory(pkg: PackageKey, category: string): Promise<number> {
  const { getDb } = await import('@/lib/mongodb/client')
  const db = await getDb()

  // Pacer tidak punya payment_status di peserta (tidak ada alur bayar) — hitung langsung
  // di level akun (pacer_registrations), exclude yang sudah 'rejected' supaya tidak makan kuota.
  if (pkg === 'pacer') {
    return db.collection('pacer_registrations').countDocuments({ category, status: { $in: ['pending', 'approved'] } })
  }

  const ownerIds = await db
    .collection(PACKAGE_OWNER_COLLECTION[pkg])
    .find({ category })
    .project({ id: 1 })
    .toArray()
  if (ownerIds.length === 0) return 0

  return db.collection(PACKAGE_PARTICIPANT_COLLECTION[pkg]).countDocuments({
    payment_status: { $in: ['pending', 'paid'] },
    [PACKAGE_OWNER_ID_FIELD[pkg]]: { $in: ownerIds.map((o) => o.id) },
  })
}

// Batas waktu kuota "ditahan" untuk registrasi yang belum dibayar sebelum otomatis
// dilepas kembali. ponytail: konstanta tetap, jadikan setting admin kalau perlu diubah per paket.
const PENDING_HOLD_HOURS = 24

/**
 * Registrasi pending yang sudah lewat batas waktu tahan dianggap kadaluarsa: status
 * registrasi + payment + semua pesertanya diubah ke 'expired', sehingga kuota yang
 * sempat ditahan otomatis dikembalikan (checkPackageQuota hanya menghitung pending+paid).
 * Dipanggil lazily sebelum menghitung kuota — tidak perlu cron terpisah.
 */
async function releaseExpiredPendingRegistrations(pkg: PackageKey) {
  // Status 'pending' di pacer_registrations berarti "menunggu approval admin", bukan
  // "checkout belum dibayar" — tidak boleh di-auto-expire oleh mekanisme hold payment ini.
  if (pkg === 'pacer') return

  const { getDb } = await import('@/lib/mongodb/client')
  const db = await getDb()
  const cutoff = new Date(Date.now() - PENDING_HOLD_HOURS * 60 * 60 * 1000).toISOString()

  const staleRegistrations = await db
    .collection(PACKAGE_REGISTRATION_COLLECTION[pkg])
    .find({ status: 'pending', created_at: { $lt: cutoff } })
    .project({ id: 1 })
    .toArray()

  if (staleRegistrations.length === 0) return

  const dbFns = await import('@/lib/db')

  for (const registration of staleRegistrations) {
    const registrationId = registration.id as string

    switch (pkg) {
      case 'community': {
        const payment = await dbFns.findPendingPaymentByRegistrationIds([registrationId])
        if (payment) await dbFns.markPaymentExpired(payment.id)
        break
      }
      case 'family': {
        const payment = await dbFns.findPendingFamilyPaymentByRegistrationIds([registrationId])
        if (payment) await dbFns.markFamilyPaymentExpired(payment.id)
        break
      }
      case 'individual': {
        const payment = await dbFns.findPendingIndividualPaymentByRegistrationIds([registrationId])
        if (payment) await dbFns.markIndividualPaymentExpired(payment.id)
        break
      }
    }
  }
}

/** Cek apakah kuota kategori masih tersedia untuk menambah `adding` peserta (0 = tak terbatas). */
export async function checkPackageQuota(pkg: PackageKey, adding: number, category?: string | null): Promise<{ ok: boolean; reason?: string }> {
  await releaseExpiredPendingRegistrations(pkg)

  const period = category ? await resolvePeriodForCategory(pkg, category) : null
  const categoryConfig = period?.categories.find((c) => c.value === category)
  if (categoryConfig && categoryConfig.quota > 0) {
    const usedInCategory = await countPackageParticipantsByCategory(pkg, category!)
    if (usedInCategory + adding > categoryConfig.quota) {
      const remaining = Math.max(0, categoryConfig.quota - usedInCategory)
      return {
        ok: false,
        reason: remaining === 0
          ? `Kuota kategori ${categoryConfig.label} sudah penuh (${usedInCategory}/${categoryConfig.quota}).`
          : `Sisa kuota kategori ${categoryConfig.label} tinggal ${remaining} peserta (butuh ${adding}).`,
      }
    }
  }

  return { ok: true }
}

/** Cek apakah pendaftaran paket sedang dibuka: enabled + ada periode yang jendela pendaftarannya mencakup saat ini. */
export async function isPackageOpen(pkg: PackageKey): Promise<{ open: boolean; reason?: string }> {
  const packages = await getPackagesSettings()
  const config = packages[pkg]
  if (!config?.enabled) return { open: false, reason: 'Pendaftaran paket ini sedang ditutup.' }

  // Gunakan ISO datetime (YYYY-MM-DDTHH:mm) agar perbandingan string mencakup jam.
  const now = new Date().toISOString().slice(0, 16)
  const activePeriod = config.periods.find((period) => {
    if (period.registrationStart && now < period.registrationStart) return false
    if (period.registrationEnd && now > period.registrationEnd) return false
    return true
  })

  if (!activePeriod) return { open: false, reason: 'Belum ada periode pendaftaran yang buka saat ini.' }
  return { open: true }
}

/** Cek apakah jendela pembayaran periode (dari kategori terpilih) sedang buka. Tanpa batas jika kosong. */
export async function checkPaymentWindow(pkg: PackageKey, category: string | null | undefined): Promise<{ ok: boolean; reason?: string }> {
  const period = await resolvePeriodForCategory(pkg, category)
  if (!period) return { ok: true }

  // Gunakan ISO datetime (YYYY-MM-DDTHH:mm) agar perbandingan string mencakup jam.
  const now = new Date().toISOString().slice(0, 16)
  if (period.paymentStart && now < period.paymentStart) {
    return { ok: false, reason: `Pembayaran untuk ${period.label} dibuka mulai ${period.paymentStart.replace('T', ' pukul ')}.` }
  }
  if (period.paymentEnd && now > period.paymentEnd) {
    return { ok: false, reason: `Pembayaran untuk ${period.label} sudah ditutup sejak ${period.paymentEnd.replace('T', ' pukul ')}.` }
  }
  return { ok: true }
}

export async function readAdminSettings(): Promise<AdminSettings> {
  try {
    const value = await getAppSetting<Partial<AdminSettings>>(FORM_SETTINGS_KEY)
    if (value) {
      return normalizeAdminSettings(value)
    }
  } catch {
    // Fall back to local JSON for development or before migration is applied.
  }

  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AdminSettings>
    return normalizeAdminSettings(parsed)
  } catch {
    return DEFAULT_ADMIN_SETTINGS
  }
}

export async function writeAdminSettings(settings: AdminSettings) {
  const normalizedSettings = normalizeAdminSettings(settings)

  const overlapError = validatePackagePeriods(normalizedSettings.packages)
  if (overlapError) {
    throw new Error(overlapError)
  }

  try {
    await upsertAppSetting(FORM_SETTINGS_KEY, normalizedSettings)
    return
  } catch (error) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      throw new Error(`Gagal menyimpan pengaturan form ke database: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true })
  await fs.writeFile(
    SETTINGS_PATH,
    `${JSON.stringify(normalizedSettings, null, 2)}\n`,
    'utf8'
  )
}

function parseEnv(raw: string) {
  const values = new Map<string, string>()
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2] || ''
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    values.set(match[1], value)
  }
  return values
}

export async function readEditableEnvSnapshot(): Promise<AdminEnvSnapshot[]> {
  let raw = ''
  try {
    raw = await fs.readFile(ENV_PATH, 'utf8')
  } catch {
    raw = ''
  }

  const values = parseEnv(raw)
  const settings = await readAdminSettings()
  const envFields = [...EDITABLE_ENV_FIELDS, ...settings.envFields]

  return envFields.map((field) => {
    const currentValue = values.get(field.key) || process.env[field.key] || ''
    return {
      ...field,
      hasValue: currentValue.length > 0,
      currentValue: field.sensitive ? '' : currentValue,
    }
  })
}

function serializeEnvValue(value: string) {
  const normalized = value.replace(/\r?\n/g, '').trim()
  if (!normalized) return ''
  if (/[\s#"'`]/.test(normalized)) {
    return JSON.stringify(normalized)
  }
  return normalized
}

export async function updateEditableEnvValues(values: Record<string, string>) {
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    throw new Error('Environment di Vercel tidak bisa disimpan dari runtime aplikasi. Ubah env dari Vercel Dashboard lalu redeploy.')
  }

  const settings = await readAdminSettings()
  const allowedKeys = new Set([
    ...[...EDITABLE_ENV_FIELDS, ...settings.envFields].map((field) => field.key),
    'AXIOM_TOKEN',
    'AXIOM_DATASET',
    'AXIOM_ORG_ID',
  ])
  const updates = Object.entries(values)
    .filter(([key, value]) => allowedKeys.has(key) && value.trim().length > 0)
    .map(([key, value]) => [key, serializeEnvValue(value)] as const)

  if (updates.length === 0) {
    return { updatedKeys: [] as string[] }
  }

  let raw = ''
  try {
    raw = await fs.readFile(ENV_PATH, 'utf8')
  } catch {
    raw = ''
  }

  const lines = raw.split(/\r?\n/)
  for (const [key, value] of updates) {
    const index = lines.findIndex((line) => new RegExp(`^\\s*${key}=`).test(line))
    const nextLine = `${key}=${value}`
    if (index >= 0) {
      lines[index] = nextLine
    } else {
      lines.push(nextLine)
    }
  }

  await fs.writeFile(ENV_PATH, `${lines.join('\n').replace(/\n*$/, '')}\n`, 'utf8')
  return { updatedKeys: updates.map(([key]) => key) }
}
