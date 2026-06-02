export type FormInputConfig = {
  label: string
  placeholder: string
  visible: boolean
}

export type FormSelectOptionConfig = {
  value: string
  label: string
}

export type FormSelectConfig = FormInputConfig & {
  options: FormSelectOptionConfig[]
}

export type RegistrationFormSettings = {
  community: {
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
  participants: {
    full_name: FormInputConfig
    bib_name: FormInputConfig
    email: FormInputConfig
    phone: FormInputConfig
    date_of_birth: FormInputConfig
    gender: FormSelectConfig
    tshirt_size: FormSelectConfig
    blood_type: FormSelectConfig
    medical_condition: FormInputConfig
    emergency_contact_name: FormInputConfig
    emergency_contact_phone: FormInputConfig
  }
}

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

export type AdminSettings = {
  registrationForm: RegistrationFormSettings
  envFields: AdminEditableEnvField[]
}

export const DEFAULT_REGISTRATION_FORM_SETTINGS: RegistrationFormSettings = {
  community: {
    name: { label: 'Nama Komunitas Lari', placeholder: 'Contoh: Topsell Runners, Malang Striders', visible: true },
    leader_name: { label: 'Nama Ketua / PIC', placeholder: 'Nama lengkap perwakilan', visible: true },
    phone: { label: 'No. WhatsApp Ketua', placeholder: '08xxxxxxxxxx', visible: true },
    email: { label: 'Email Komunitas', placeholder: 'email@komunitas.com', visible: true },
    category: {
      label: 'Kategori',
      placeholder: 'Pilih kategori',
      visible: true,
      options: [
        { value: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000', label: '6K 1̶4̶9̶.̶0̶0̶0̶ 135.000' },
      ],
    },
    provinsi: { label: 'Provinsi', placeholder: 'Pilih provinsi komunitas', visible: true },
    kota: { label: 'Kota / Kabupaten', placeholder: 'Pilih kota/kabupaten', visible: true },
    kecamatan: { label: 'Kecamatan', placeholder: 'Pilih kecamatan', visible: true },
    password: { label: 'Password', placeholder: 'Min. 6 karakter', visible: true },
    confirmPassword: { label: 'Konfirmasi Password', placeholder: 'Ulangi password', visible: true },
  },
  participants: {
    full_name: { label: 'Nama Lengkap', placeholder: 'Nama lengkap peserta', visible: true },
    bib_name: { label: 'Nama BIB', placeholder: 'Nama di BIB', visible: true },
    email: { label: 'Email', placeholder: 'email@peserta.com', visible: true },
    phone: { label: 'No. WhatsApp', placeholder: '08xxxxxxxxxx', visible: true },
    date_of_birth: { label: 'Tanggal Lahir', placeholder: 'Pilih tanggal lahir', visible: true },
    gender: {
      label: 'Jenis Kelamin',
      placeholder: '',
      visible: true,
      options: [
        { value: 'male', label: 'Laki-laki' },
        { value: 'female', label: 'Perempuan' },
      ],
    },
    tshirt_size: {
      label: 'Ukuran Jersey',
      placeholder: '',
      visible: true,
      options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'].map((size) => ({ value: size, label: size })),
    },
    blood_type: {
      label: 'Gol. Darah',
      placeholder: '',
      visible: true,
      options: ['A', 'B', 'AB', 'O'].map((type) => ({ value: type, label: type })),
    },
    medical_condition: { label: 'Penyakit Bawaan', placeholder: 'Isi jika ada, contoh: asma', visible: true },
    emergency_contact_name: { label: 'Nama Kontak Darurat', placeholder: 'Nama keluarga/kerabat yang bisa dihubungi', visible: true },
    emergency_contact_phone: { label: 'No. Kontak Darurat', placeholder: '08xxxxxxxxxx', visible: true },
  },
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  registrationForm: DEFAULT_REGISTRATION_FORM_SETTINGS,
  envFields: [],
}

export const EDITABLE_ENV_FIELDS: AdminEditableEnvField[] = [
  { key: 'NEXT_PUBLIC_APP_URL', label: 'App URL', description: 'URL aplikasi untuk callback pembayaran Xendit.', sensitive: false },
  { key: 'XENDIT_SECRET_KEY', label: 'Xendit Secret Key', description: 'Secret key Xendit untuk membuat checkout.', sensitive: true },
  { key: 'XENDIT_CALLBACK_TOKEN', label: 'Xendit Callback Token', description: 'Token verifikasi webhook Xendit.', sensitive: true },
  { key: 'XENDIT_ALLOWED_CHANNELS', label: 'Xendit Channels', description: 'Daftar channel pembayaran dipisah koma.', sensitive: false },
  { key: 'SMTP_HOST', label: 'SMTP Host', description: 'Host SMTP email racepack.', sensitive: false },
  { key: 'SMTP_PORT', label: 'SMTP Port', description: 'Port SMTP.', sensitive: false },
  { key: 'SMTP_SECURE', label: 'SMTP Secure', description: 'Isi true untuk SSL/TLS.', sensitive: false },
  { key: 'SMTP_USER', label: 'SMTP User', description: 'Username email SMTP.', sensitive: false },
  { key: 'SMTP_PASS', label: 'SMTP Password', description: 'Password email SMTP.', sensitive: true },
  { key: 'SMTP_FROM', label: 'SMTP From', description: 'Nama dan alamat pengirim email.', sensitive: false },
  { key: 'GHL_REGISTRATION_WEBHOOK_URL', label: 'GHL Registration Webhook', description: 'Webhook WA setelah pendaftaran diterima.', sensitive: true },
  { key: 'GHL_REGISTRATION_WEBHOOK_TOKEN', label: 'GHL Registration Token', description: 'Token opsional untuk webhook pendaftaran.', sensitive: true },
  { key: 'GHL_QR_WEBHOOK_URL', label: 'GHL Payment Webhook', description: 'Webhook WA setelah pembayaran diterima.', sensitive: true },
  { key: 'GHL_QR_WEBHOOK_TOKEN', label: 'GHL Payment Token', description: 'Token opsional untuk webhook pembayaran.', sensitive: true },
  { key: 'AXIOM_TOKEN', label: 'Axiom Token', description: 'Token API untuk query log Axiom.', sensitive: true },
  { key: 'AXIOM_DATASET', label: 'Axiom Dataset', description: 'Nama dataset log di Axiom.', sensitive: false },
  { key: 'AXIOM_ORG_ID', label: 'Axiom Org ID', description: 'Opsional: isi jika token personal membutuhkan org id.', sensitive: false },
  { key: 'BINDERBYTE_API_KEY', label: 'Binderbyte API Key', description: 'API key data wilayah.', sensitive: true },
  { key: 'SUPER_ADMIN_PASSWORD', label: 'Password Super Admin', description: 'Password login halaman admin.', sensitive: true },
]
