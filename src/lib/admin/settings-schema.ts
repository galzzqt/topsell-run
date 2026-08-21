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

export type PackageKey = 'community' | 'family' | 'individual' | 'pacer' | 'umkm'

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
  social_media: FormInputConfig
  description: FormInputConfig
  photo_urls: FormInputConfig
  address: FormInputConfig
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
  community_name: FormInputConfig
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
  provinsi: { label: 'Provinsi', placeholder: 'Pilih provinsi', visible: true, required: true },
  kota: { label: 'Kota / Kabupaten', placeholder: 'Pilih kota/kabupaten', visible: true, required: true },
  kecamatan: { label: 'Kecamatan', placeholder: 'Pilih kecamatan', visible: true, required: true },
  social_media: { label: 'Link Media Sosial', placeholder: 'Contoh: https://instagram.com/...', visible: false, required: false },
  description: { label: 'Deskripsi', placeholder: 'Deskripsi singkat...', visible: false, required: false },
  photo_urls: { label: 'Foto', placeholder: 'Upload foto', visible: false, required: false },
  address: { label: 'Alamat Lengkap', placeholder: 'Alamat lengkap domisili...', visible: false, required: false },
  password: { label: 'Password', placeholder: 'Minimal 6 karakter', visible: true, required: true },
  confirmPassword: { label: 'Konfirmasi Password', placeholder: 'Ulangi password', visible: true, required: true },
}

const DEFAULT_PARTICIPANT_GROUP: RegistrationFormParticipantSettings = {
  full_name: { label: 'Nama Lengkap', placeholder: 'Nama sesuai KTP', visible: true, required: true },
  bib_name: { label: 'Nama BIB', placeholder: 'Maks. 12 karakter', visible: true, required: true },
  ktp_number: { label: 'Nomor KTP / NIK', placeholder: '16 digit NIK', visible: true, required: true },
  email: { label: 'Email Peserta', placeholder: 'email@peserta.com', visible: true, required: true },
  phone: { label: 'No. WhatsApp Peserta', placeholder: '08xxxxxxxxxx', visible: true, required: true },
  date_of_birth: { label: 'Tanggal Lahir', placeholder: 'YYYY-MM-DD', visible: true, required: true },
  gender: {
    label: 'Jenis Kelamin',
    placeholder: 'Pilih jenis kelamin',
    visible: true,
    required: true,
    options: [
      { value: 'male', label: 'Laki-laki' },
      { value: 'female', label: 'Perempuan' },
    ],
  },
  tshirt_size: {
    label: 'Ukuran Jersey',
    placeholder: 'Pilih ukuran',
    visible: true,
    required: true,
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => ({ value: size, label: size })),
  },
  blood_type: {
    label: 'Golongan Darah',
    placeholder: 'Pilih golongan darah',
    visible: true,
    required: true,
    options: [
      { value: 'A', label: 'A' },
      { value: 'B', label: 'B' },
      { value: 'AB', label: 'AB' },
      { value: 'O', label: 'O' },
      { value: 'none', label: 'Tidak Tahu' },
    ],
  },
  medical_condition: { label: 'Riwayat Penyakit', placeholder: 'Isi "Tidak ada" jika sehat', visible: true, required: false },
  emergency_contact_name: { label: 'Nama Kontak Darurat', placeholder: 'Keluarga / kerabat terdekat', visible: true, required: true },
  emergency_contact_phone: { label: 'No. Kontak Darurat', placeholder: '08xxxxxxxxxx', visible: true, required: true },
  community_name: { label: 'Instansi / Komunitas', placeholder: 'Contoh: Nama Perusahaan / Komunitas (Opsional)', visible: true, required: false },
  // Khusus Pacer: nonaktif di paket lain secara default.
  age: { label: 'Usia', placeholder: 'Usia (tahun)', visible: false, required: false },
  sosmed_instagram: { label: 'Link Instagram', placeholder: 'https://instagram.com/username', visible: false, required: false },
  sosmed_tiktok: { label: 'Link TikTok', placeholder: 'https://tiktok.com/@username', visible: false, required: false },
  strava_link: { label: 'Link Akun Strava', placeholder: 'https://strava.com/athletes/...', visible: false, required: false },
  strava_username: { label: 'Username Strava', placeholder: 'Username Strava', visible: false, required: false },
  bank_name: { label: 'Nama Bank', placeholder: 'Contoh: BCA', visible: false, required: false },
  bank_account_number: { label: 'No. Rekening', placeholder: 'Nomor rekening', visible: false, required: false },
  bank_account_holder: { label: 'Nama Pemilik Rekening', placeholder: 'Nama Pemilik Rekening', visible: false, required: false },
  has_smartwatch: {
    label: 'Punya Smartwatch?',
    placeholder: '',
    visible: false,
    required: false,
    options: [
      { value: 'yes', label: 'Ya' },
      { value: 'no', label: 'Tidak' },
    ],
  },
}

export const DEFAULT_REGISTRATION_FORM_SETTINGS: RegistrationFormSettings = {
  community: {
    registrant: { ...DEFAULT_REGISTRANT_GROUP },
    participants: { ...DEFAULT_PARTICIPANT_GROUP },
  },
  family: {
    registrant: {
      ...DEFAULT_REGISTRANT_GROUP,
      name: { label: 'Nama Keluarga', placeholder: 'Contoh: Keluarga Pratama', visible: true, required: true },
      leader_name: { label: 'Nama Perwakilan Keluarga', placeholder: 'Nama lengkap perwakilan', visible: true, required: true },
      email: { label: 'Email Keluarga', placeholder: 'email@keluarga.com', visible: true, required: true },
    },
    participants: { ...DEFAULT_PARTICIPANT_GROUP },
  },
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
          { value: '3K 99.000', label: '3K 99.000' },
          { value: '6K 149.000', label: '6K 149.000' },
        ],
      },
    },
    participants: {
      ...DEFAULT_PARTICIPANT_GROUP,
      tshirt_size: {
        label: 'Ukuran Jersey',
        placeholder: 'Pilih ukuran',
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
        placeholder: 'Pilih ukuran',
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
  umkm: {
    registrant: {
      ...DEFAULT_REGISTRANT_GROUP,
      name: { label: 'Nama Usaha / Brand', placeholder: 'Contoh: Warung Makan Bu Sari', visible: true, required: true },
      category: {
        label: 'Bidang Usaha',
        placeholder: 'Pilih bidang usaha',
        visible: true,
        required: true,
        options: [
          { value: 'Kuliner / Makanan & Minuman', label: 'Kuliner / Makanan & Minuman' },
          { value: 'Fashion & Pakaian', label: 'Fashion & Pakaian' },
          { value: 'Kerajinan Tangan', label: 'Kerajinan Tangan' },
          { value: 'Kecantikan & Perawatan', label: 'Kecantikan & Perawatan' },
          { value: 'Elektronik & Gadget', label: 'Elektronik & Gadget' },
          { value: 'Olahraga & Outdoor', label: 'Olahraga & Outdoor' },
          { value: 'Kesehatan & Suplemen', label: 'Kesehatan & Suplemen' },
          { value: 'Pertanian & Perkebunan', label: 'Pertanian & Perkebunan' },
          { value: 'Jasa & Layanan', label: 'Jasa & Layanan' },
          { value: 'Lainnya', label: 'Lainnya' },
        ],
      },
      social_media: { label: 'Link Media Sosial Usaha', placeholder: 'Contoh: https://instagram.com/warungmakanbusari', visible: true, required: true },
      description: { label: 'Deskripsi Usaha / Produk', placeholder: 'Jelaskan secara singkat jenis produk, menu, atau konsep tenant usaha Anda...', visible: true, required: true },
      photo_urls: { label: 'Foto Usaha / Produk UMKM', placeholder: 'Upload foto usaha/produk', visible: true, required: true },
      leader_name: { label: 'Nama PIC', placeholder: 'Nama lengkap penanggung jawab', visible: true, required: true },
      phone: { label: 'No. WhatsApp PIC', placeholder: '08xxxxxxxxxx', visible: true, required: true },
      email: { label: 'Email PIC', placeholder: 'email@usaha.com', visible: true, required: true },
      provinsi: { label: 'Provinsi', placeholder: 'Pilih provinsi', visible: true, required: true },
      kota: { label: 'Kota / Kabupaten', placeholder: 'Pilih kota', visible: true, required: true },
      kecamatan: { label: 'Kecamatan', placeholder: 'Pilih kecamatan', visible: true, required: true },
      address: { label: 'Alamat Lengkap Usaha / Domisili', placeholder: 'Nama jalan, nomor bangunan/toko, RT/RW, kelurahan/desa, patokan lokasi...', visible: true, required: true },
      password: { label: 'Password', placeholder: 'Minimal 6 karakter', visible: true, required: true },
      confirmPassword: { label: 'Konfirmasi Password', placeholder: 'Ulangi password Anda', visible: true, required: true },
    },
    participants: {
      ...DEFAULT_PARTICIPANT_GROUP,
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
  pacer: { ...DEFAULT_RACEPACK_EMAIL },
  umkm: {
    subject: 'Konfirmasi Pembayaran Tenant UMKM - TOPSELL RUN 2026',
    greeting: 'Halo {leaderName},',
    bodyIntro: 'Pembayaran tenant UMKM {communityName} untuk TOPSELL RUN 2026 sebesar Rp 500.000 sudah kami terima dan pendaftaran Anda telah aktif.',
    bodyOutro: 'Terima kasih atas partisipasi usaha Anda! Sampai jumpa di venue event. 🏬',
  },
}

const EMPTY_WEBHOOK_PACKAGE: WebhookPackageConfig = {
  registration: { url: '', token: '' },
  payment: { url: '', token: '' },
}

export const DEFAULT_WEBHOOK_SETTINGS: WebhookSettings = {
  community: { ...EMPTY_WEBHOOK_PACKAGE },
  family: { ...EMPTY_WEBHOOK_PACKAGE },
  individual: { ...EMPTY_WEBHOOK_PACKAGE },
  pacer: { ...EMPTY_WEBHOOK_PACKAGE },
  umkm: { ...EMPTY_WEBHOOK_PACKAGE },
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
        categories: [
          { value: '3K', label: '3K', price: 0, quota: 0 },
          { value: '6K', label: '6K', price: 0, quota: 0 },
        ],
      },
    ],
  },
  umkm: {
    label: 'Tenant UMKM',
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
          { value: 'Tenant UMKM 500.000', label: 'Tenant UMKM — Rp 500.000', price: 500000, quota: 0 },
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
