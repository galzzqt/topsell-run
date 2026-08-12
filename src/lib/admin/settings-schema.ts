export type FormInputConfig = {
  label: string
  placeholder: string
  visible: boolean
  required: boolean
}

export type FormSelectOptionConfig = {
  value: string
  label: string
}

export type FormSelectConfig = FormInputConfig & {
  options: FormSelectOptionConfig[]
}

export type PackageKey = 'community' | 'family' | 'individual' | 'pacer'

export type EmailTemplateConfig = {
  subject: string
  greeting: string
  bodyIntro: string
  bodyOutro: string
}

export type EmailTemplateSettings = Record<PackageKey, EmailTemplateConfig>

export type WebhookPackageConfig = {
  registration: {
    url: string
    token: string
  }
  payment: {
    url: string
    token: string
  }
}

export type WebhookSettings = Record<PackageKey, WebhookPackageConfig>

export type RegistrationFormGroupSettings = {
  name: FormInputConfig
  leader_name: FormInputConfig
  phone: FormInputConfig
  email: FormInputConfig
  category: FormSelectConfig
  provinsi: FormInputConfig
  kota: FormInputConfig
  kecamatan: FormInputConfig
  password: FormInputConfig
  confirmPassword: FormInputConfig
}

export type RegistrationFormParticipantSettings = {
  full_name: FormInputConfig
  bib_name: FormInputConfig
  ktp_number: FormInputConfig
  email: FormInputConfig
  phone: FormInputConfig
  date_of_birth: FormInputConfig
  gender: FormSelectConfig
  tshirt_size: FormSelectConfig
  blood_type: FormSelectConfig
  medical_condition: FormInputConfig
  emergency_contact_name: FormInputConfig
  emergency_contact_phone: FormInputConfig
  // Field khusus paket Pacer (inert/tersembunyi utk paket lain, lihat DEFAULT_PARTICIPANT_GROUP).
  age: FormInputConfig
  sosmed_instagram: FormInputConfig
  sosmed_tiktok: FormInputConfig
  strava_link: FormInputConfig
  strava_username: FormInputConfig
  bank_name: FormInputConfig
  bank_account_number: FormInputConfig
  bank_account_holder: FormInputConfig
  has_smartwatch: FormSelectConfig
}

export type RegistrationFormPackageSettings = {
  // Field level pendaftar/ketua/perwakilan (nama komunitas/keluarga/individu, kontak, kategori, dst).
  registrant: RegistrationFormGroupSettings
  participants: RegistrationFormParticipantSettings
}

export type RegistrationFormSettings = Record<PackageKey, RegistrationFormPackageSettings>

export type AdminEditableEnvField = {
  key: string
  label: string
  description: string
  sensitive: boolean
}

export type AdminEnvSnapshot = AdminEditableEnvField & {
  hasValue: boolean
  currentValue: string
}

export type PackageCategory = {
  value: string
  label: string
  price: number
  // Kuota khusus kategori ini; 0 = tak terbatas.
  quota: number
}

export type PackagePeriod = {
  // Slug stabil, dipakai sebagai relasi (period_key) di participants/payments.
  key: string
  label: string
  // ISO datetime string 'YYYY-MM-DDTHH:mm'; kosong = tanpa batas.
  registrationStart: string
  registrationEnd: string
  paymentStart: string
  paymentEnd: string
  // Tanggal/waktu pelaksanaan event; informasional.
  eventDate: string
  categories: PackageCategory[]
}

export type PackageConfig = {
  label: string
  enabled: boolean
  // URL Cloudinary gambar size chart; '' = pakai gambar default bawaan.
  // Opsi dropdown ukuran jersey sudah diatur per paket lewat registrationForm.<key>.participants.tshirt_size.options.
  sizeChartImage: string
  periods: PackagePeriod[]
}

export type PackagesSettings = Record<PackageKey, PackageConfig>

export type SiteAssets = {
  // URL Cloudinary gambar hero landing page; '' = pakai gambar default bawaan.
  heroImage: string
  // URL Cloudinary logo, dipakai di header (nav) & footer; '' = pakai logo default bawaan.
  logoImage: string
}

export type AdminSettings = {
  registrationForm: RegistrationFormSettings
  emailTemplates: EmailTemplateSettings
  webhookSettings: WebhookSettings
  packages: PackagesSettings
  siteAssets: SiteAssets
  envFields: AdminEditableEnvField[]
}

const DEFAULT_REGISTRANT_GROUP: RegistrationFormGroupSettings = {
  name: { label: 'Nama Komunitas Lari', placeholder: 'Contoh: Topsell Runners, Malang Striders', visible: true, required: true },
  leader_name: { label: 'Nama Ketua / PIC', placeholder: 'Nama lengkap perwakilan', visible: true, required: true },
  phone: { label: 'No. WhatsApp Ketua', placeholder: '08xxxxxxxxxx', visible: true, required: true },
  email: { label: 'Email Komunitas', placeholder: 'email@komunitas.com', visible: true, required: true },
  category: {
    label: 'Kategori',
    placeholder: 'Pilih kategori',
    visible: true,
    required: true,
    options: [
      { value: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', label: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000' },
    ],
  },
  provinsi: { label: 'Provinsi', placeholder: 'Pilih provinsi komunitas', visible: true, required: true },
  kota: { label: 'Kota / Kabupaten', placeholder: 'Pilih kota/kabupaten', visible: true, required: true },
  kecamatan: { label: 'Kecamatan', placeholder: 'Pilih kecamatan', visible: true, required: true },
  password: { label: 'Password', placeholder: 'Min. 6 karakter', visible: true, required: true },
  confirmPassword: { label: 'Konfirmasi Password', placeholder: 'Ulangi password', visible: true, required: true },
}

const DEFAULT_PARTICIPANT_GROUP: RegistrationFormParticipantSettings = {
  full_name: { label: 'Nama Lengkap', placeholder: 'Nama lengkap peserta', visible: true, required: true },
  bib_name: { label: 'Nama BIB', placeholder: 'Nama di BIB', visible: true, required: true },
  ktp_number: { label: 'No. KTP', placeholder: 'Nomor KTP 16 digit', visible: true, required: true },
  email: { label: 'Email', placeholder: 'email@peserta.com', visible: true, required: true },
  phone: { label: 'No. WhatsApp', placeholder: '08xxxxxxxxxx', visible: true, required: true },
  date_of_birth: { label: 'Tanggal Lahir', placeholder: 'DD/MM/YYYY', visible: true, required: true },
  gender: {
    label: 'Jenis Kelamin',
    placeholder: '',
    visible: true,
    required: true,
    options: [
      { value: 'male', label: 'Laki-laki' },
      { value: 'female', label: 'Perempuan' },
    ],
  },
  tshirt_size: {
    label: 'Ukuran Jersey',
    placeholder: '',
    visible: true,
    required: true,
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'].map((size) => ({ value: size, label: size })),
  },
  blood_type: {
    label: 'Gol. Darah',
    placeholder: '',
    visible: true,
    required: true,
    options: ['A', 'B', 'AB', 'O'].map((type) => ({ value: type, label: type })),
  },
  medical_condition: { label: 'Penyakit Bawaan', placeholder: 'Isi jika ada, contoh: asma', visible: true, required: false },
  emergency_contact_name: { label: 'Nama Kontak Darurat', placeholder: 'Nama kontak darurat', visible: true, required: true },
  emergency_contact_phone: { label: 'No. Kontak Darurat', placeholder: '08xxxxxxxxxx', visible: true, required: true },
  // Field khusus Pacer — disembunyikan (visible:false) di paket lain karena form mereka tidak merender field ini.
  age: { label: 'Usia', placeholder: 'Usia (tahun)', visible: false, required: true },
  sosmed_instagram: { label: 'Instagram', placeholder: '@username', visible: false, required: true },
  sosmed_tiktok: { label: 'TikTok', placeholder: '@username', visible: false, required: false },
  strava_link: { label: 'Link Akun Strava', placeholder: 'https://strava.com/athletes/...', visible: false, required: true },
  strava_username: { label: 'Username Strava', placeholder: 'Username Strava', visible: false, required: true },
  bank_name: { label: 'Nama Bank', placeholder: 'Contoh: BCA', visible: false, required: true },
  bank_account_number: { label: 'No. Rekening', placeholder: 'Nomor rekening', visible: false, required: true },
  bank_account_holder: { label: 'Nama Pemilik Rekening', placeholder: 'Nama Pemilik Rekening', visible: false, required: true },
  has_smartwatch: {
    label: 'Punya Smartwatch?',
    placeholder: '',
    visible: false,
    required: true,
    options: [
      { value: 'yes', label: 'Ya' },
      { value: 'no', label: 'Tidak' },
    ],
  },
}

export const DEFAULT_REGISTRATION_FORM_SETTINGS: RegistrationFormSettings = {
  community: { registrant: DEFAULT_REGISTRANT_GROUP, participants: DEFAULT_PARTICIPANT_GROUP },
  family: { registrant: DEFAULT_REGISTRANT_GROUP, participants: DEFAULT_PARTICIPANT_GROUP },
  individual: {
    registrant: {
      ...DEFAULT_REGISTRANT_GROUP,
      name: { label: 'Nama Lengkap', placeholder: 'Nama lengkap Anda', visible: true, required: true },
      leader_name: { label: 'Nama Lengkap', placeholder: 'Nama lengkap Anda', visible: true, required: true },
      phone: { label: 'No. WhatsApp', placeholder: '08xxxxxxxxxx', visible: true, required: true },
      email: { label: 'Email', placeholder: 'email@anda.com', visible: true, required: true },
      category: {
        label: 'Kategori',
        placeholder: 'Pilih kategori',
        visible: true,
        required: true,
        options: [
          { value: '3K 99.000', label: '3K — Rp 99.000' },
          { value: '6K 149.000', label: '6K — Rp 149.000' },
        ],
      },
    },
    participants: {
      ...DEFAULT_PARTICIPANT_GROUP,
      tshirt_size: {
        label: 'Ukuran Jersey',
        placeholder: '',
        visible: true,
        required: true,
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => ({ value: size, label: size })),
      },
    },
  },
  pacer: {
    registrant: {
      ...DEFAULT_REGISTRANT_GROUP,
      name: { label: 'Nama Lengkap', placeholder: 'Nama lengkap Anda', visible: true, required: true },
      leader_name: { label: 'Nama Lengkap', placeholder: 'Nama lengkap Anda', visible: true, required: true },
      phone: { label: 'No. WhatsApp', placeholder: '08xxxxxxxxxx', visible: true, required: true },
      email: { label: 'Email', placeholder: 'email@anda.com', visible: true, required: true },
      category: {
        label: 'Kategori',
        placeholder: 'Pilih kategori',
        visible: true,
        required: true,
        options: [
          { value: '3K', label: '3K' },
          { value: '6K', label: '6K' },
        ],
      },
    },
    participants: {
      ...DEFAULT_PARTICIPANT_GROUP,
      tshirt_size: {
        label: 'Ukuran Jersey',
        placeholder: '',
        visible: true,
        required: true,
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => ({ value: size, label: size })),
      },
      age: { label: 'Usia', placeholder: 'Usia (tahun)', visible: true, required: true },
      sosmed_instagram: { label: 'Link Instagram', placeholder: 'https://instagram.com/username', visible: true, required: true },
      sosmed_tiktok: { label: 'Link TikTok', placeholder: 'https://tiktok.com/@username', visible: true, required: false },
      strava_link: { label: 'Link Akun Strava', placeholder: 'https://strava.com/athletes/...', visible: true, required: true },
      strava_username: { label: 'Username Strava', placeholder: 'Username Strava', visible: true, required: true },
      bank_name: { label: 'Nama Bank', placeholder: 'Contoh: BCA', visible: true, required: true },
      bank_account_number: { label: 'No. Rekening', placeholder: 'Nomor rekening', visible: true, required: true },
      bank_account_holder: { label: 'Nama Pemilik Rekening', placeholder: 'Nama Pemilik Rekening', visible: true, required: true },
      has_smartwatch: {
        label: 'Punya Smartwatch?',
        placeholder: '',
        visible: true,
        required: true,
        options: [
          { value: 'yes', label: 'Ya' },
          { value: 'no', label: 'Tidak' },
        ],
      },
    },
  },
}

const DEFAULT_RACEPACK_EMAIL: EmailTemplateConfig = {
  subject: 'Konfirmasi Pembayaran TOPSELL RUN 2026 - {communityName}',
  greeting: 'Halo {leaderName},',
  bodyIntro: 'Pembayaran komunitas {communityName} untuk TOPSELL RUN 2026 sudah kami terima. Kode QR untuk pengambilan racepack akan dikirimkan maksimal H-5 sebelum tanggal pengambilan racepack.',
  bodyOutro: 'Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️',
}

export const DEFAULT_EMAIL_TEMPLATE_SETTINGS: EmailTemplateSettings = {
  community: { ...DEFAULT_RACEPACK_EMAIL },
  family: {
    ...DEFAULT_RACEPACK_EMAIL,
    subject: 'Konfirmasi Pembayaran TOPSELL RUN 2026 - {familyName}',
    bodyIntro: 'Pembayaran Bro & Sist Package untuk TOPSELL RUN 2026 sudah kami terima. Kode QR untuk pengambilan racepack akan dikirimkan maksimal H-5 sebelum tanggal pengambilan racepack.',
  },
  individual: {
    subject: 'Pembayaran Diterima - TOPSELL RUN 2026 ({individualCode})',
    greeting: 'Halo {individualName},',
    bodyIntro: 'Pembayaran individu untuk TOPSELL RUN 2026 sudah kami terima. Kode QR untuk pengambilan racepack akan dikirimkan maksimal H-5 sebelum tanggal pengambilan racepack.',
    bodyOutro: 'Terima kasih sudah mendaftar! Sampai jumpa di start line. Semangat berlari! 🏃‍♂️',
  },
  // Pacer tidak punya alur pembayaran/racepack email — entry ini inert, tidak pernah dipicu.
  pacer: { ...DEFAULT_RACEPACK_EMAIL },
}

const EMPTY_WEBHOOK_PACKAGE: WebhookPackageConfig = {
  registration: { url: '', token: '' },
  payment: { url: '', token: '' },
}

export const DEFAULT_WEBHOOK_SETTINGS: WebhookSettings = {
  community: { ...EMPTY_WEBHOOK_PACKAGE },
  family: { ...EMPTY_WEBHOOK_PACKAGE },
  individual: { ...EMPTY_WEBHOOK_PACKAGE },
  // Pacer tidak punya alur pembayaran — entry ini inert, tidak pernah dipicu.
  pacer: { ...EMPTY_WEBHOOK_PACKAGE },
}

export const DEFAULT_PACKAGES_SETTINGS: PackagesSettings = {
  community: {
    label: 'Community Package',
    enabled: true,
    sizeChartImage: '',
    periods: [
      {
        key: 'periode-1',
        label: 'Periode 1',
        registrationStart: '',
        registrationEnd: '',
        paymentStart: '',
        paymentEnd: '',
        eventDate: '',
        categories: [
          { value: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', label: '6K — Rp 135.000', price: 135000, quota: 0 },
        ],
      },
    ],
  },
  family: {
    label: 'Bro & Sist Package',
    enabled: true,
    sizeChartImage: '',
    periods: [
      {
        key: 'periode-1',
        label: 'Periode 1',
        registrationStart: '',
        registrationEnd: '',
        paymentStart: '',
        paymentEnd: '',
        eventDate: '',
        categories: [
          { value: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', label: '6K — Rp 135.000', price: 135000, quota: 0 },
        ],
      },
    ],
  },
  individual: {
    label: 'Individu',
    enabled: true,
    sizeChartImage: '',
    periods: [
      {
        key: 'periode-1',
        label: 'Periode 1',
        registrationStart: '',
        registrationEnd: '',
        paymentStart: '',
        paymentEnd: '',
        eventDate: '',
        categories: [
          { value: '3K 99.000', label: '3K — Rp 99.000', price: 99000, quota: 0 },
          { value: '6K 149.000', label: '6K — Rp 149.000', price: 149000, quota: 0 },
        ],
      },
    ],
  },
  pacer: {
    label: 'Pacer',
    enabled: true,
    sizeChartImage: '',
    periods: [
      {
        key: 'periode-1',
        label: 'Periode 1',
        registrationStart: '',
        registrationEnd: '',
        paymentStart: '',
        paymentEnd: '',
        eventDate: '',
        // Tidak ada pembayaran — price selalu 0, tidak pernah dibaca.
        categories: [
          { value: '3K', label: '3K', price: 0, quota: 0 },
          { value: '6K', label: '6K', price: 0, quota: 0 },
        ],
      },
    ],
  },
}

export const DEFAULT_SITE_ASSETS: SiteAssets = {
  heroImage: '',
  logoImage: '',
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  registrationForm: DEFAULT_REGISTRATION_FORM_SETTINGS,
  emailTemplates: DEFAULT_EMAIL_TEMPLATE_SETTINGS,
  webhookSettings: DEFAULT_WEBHOOK_SETTINGS,
  packages: DEFAULT_PACKAGES_SETTINGS,
  siteAssets: DEFAULT_SITE_ASSETS,
  envFields: [],
}

export const EDITABLE_ENV_FIELDS: AdminEditableEnvField[] = [
  { key: 'NEXT_PUBLIC_APP_URL', label: 'App URL', description: 'URL aplikasi untuk callback pembayaran Xendit.', sensitive: false },
  { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloudinary Cloud Name', description: 'Nama cloud Cloudinary untuk upload gambar (size chart, logo, hero).', sensitive: false },
  { key: 'CLOUDINARY_API_KEY', label: 'Cloudinary API Key', description: 'API key Cloudinary untuk signed upload.', sensitive: false },
  { key: 'CLOUDINARY_API_SECRET', label: 'Cloudinary API Secret', description: 'API secret Cloudinary untuk signed upload.', sensitive: true },
  { key: 'XENDIT_SECRET_KEY', label: 'Xendit Secret Key', description: 'Secret key Xendit untuk membuat checkout.', sensitive: true },
  { key: 'XENDIT_CALLBACK_TOKEN', label: 'Xendit Callback Token', description: 'Token verifikasi webhook Xendit.', sensitive: true },
  { key: 'XENDIT_ALLOWED_CHANNELS', label: 'Xendit Channels', description: 'Daftar channel pembayaran dipisah koma.', sensitive: false },
  { key: 'SMTP_HOST', label: 'SMTP Host', description: 'Host SMTP email racepack.', sensitive: false },
  { key: 'SMTP_PORT', label: 'SMTP Port', description: 'Port SMTP.', sensitive: false },
  { key: 'SMTP_SECURE', label: 'SMTP Secure', description: 'Isi true untuk SSL/TLS.', sensitive: false },
  { key: 'SMTP_USER', label: 'SMTP User', description: 'Username email SMTP.', sensitive: false },
  { key: 'SMTP_PASS', label: 'SMTP Password', description: 'Password email SMTP.', sensitive: true },
  { key: 'SMTP_FROM', label: 'SMTP From', description: 'Nama dan alamat pengirim email.', sensitive: false },
  { key: 'GHL_REGISTRATION_WEBHOOK_URL', label: 'GHL Registration Webhook', description: 'Webhook WA setelah pendaftaran diterima (fallback jika belum diatur per paket).', sensitive: true },
  { key: 'GHL_REGISTRATION_WEBHOOK_TOKEN', label: 'GHL Registration Token', description: 'Token opsional untuk webhook pendaftaran (fallback).', sensitive: true },
  { key: 'GHL_QR_WEBHOOK_URL', label: 'GHL Payment Webhook', description: 'Webhook WA setelah pembayaran diterima (fallback jika belum diatur per paket).', sensitive: true },
  { key: 'GHL_QR_WEBHOOK_TOKEN', label: 'GHL Payment Token', description: 'Token opsional untuk webhook pembayaran (fallback).', sensitive: true },
  { key: 'AXIOM_TOKEN', label: 'Axiom Token', description: 'Token API untuk query log Axiom.', sensitive: true },
  { key: 'AXIOM_DATASET', label: 'Axiom Dataset', description: 'Nama dataset log di Axiom.', sensitive: false },
  { key: 'AXIOM_ORG_ID', label: 'Axiom Org ID', description: 'Opsional: isi jika token personal membutuhkan org id.', sensitive: false },
  { key: 'SUPER_ADMIN_PASSWORD', label: 'Password Super Admin', description: 'Password login halaman admin.', sensitive: true },
]
