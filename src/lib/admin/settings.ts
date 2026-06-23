import 'server-only'

import { promises as fs } from 'fs'
import path from 'path'
import { getAppSetting, upsertAppSetting } from '@/lib/db'
import {
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_EMAIL_TEMPLATE_SETTINGS,
  EDITABLE_ENV_FIELDS,
  type AdminEnvSnapshot,
  type AdminEditableEnvField,
  type AdminSettings,
  type RegistrationFormSettings,
} from './settings-schema'

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'admin-settings.json')
const ENV_PATH = path.join(process.cwd(), '.env.local')
const FORM_SETTINGS_KEY = 'registration_form'

function mergeInput<T extends { label: string; placeholder: string; visible: boolean }>(base: T, value: Partial<T> | undefined): T {
  return {
    ...base,
    ...value,
    label: typeof value?.label === 'string' ? value.label : base.label,
    placeholder: typeof value?.placeholder === 'string' ? value.placeholder : base.placeholder,
    visible: typeof value?.visible === 'boolean' ? value.visible : base.visible,
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

export function normalizeRegistrationFormSettings(value: Partial<RegistrationFormSettings> | undefined): RegistrationFormSettings {
  const base = DEFAULT_ADMIN_SETTINGS.registrationForm
  return {
    community: {
      name: mergeInput(base.community.name, value?.community?.name),
      leader_name: mergeInput(base.community.leader_name, value?.community?.leader_name),
      phone: mergeInput(base.community.phone, value?.community?.phone),
      email: mergeInput(base.community.email, value?.community?.email),
      category: {
        ...mergeInput(base.community.category, value?.community?.category),
        options: base.community.category.options,
      },
      provinsi: mergeInput(base.community.provinsi, value?.community?.provinsi),
      kota: mergeInput(base.community.kota, value?.community?.kota),
      kecamatan: mergeInput(base.community.kecamatan, value?.community?.kecamatan),
      password: mergeInput(base.community.password, value?.community?.password),
      confirmPassword: mergeInput(base.community.confirmPassword, value?.community?.confirmPassword),
    },
    participants: {
      full_name: mergeInput(base.participants.full_name, value?.participants?.full_name),
      bib_name: mergeInput(base.participants.bib_name, value?.participants?.bib_name),
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
        options: base.participants.tshirt_size.options.map((option) => ({
          ...option,
          label: value?.participants?.tshirt_size?.options?.find((item) => item.value === option.value)?.label || option.label,
        })),
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
    },
  }
}

function normalizeAdminSettings(value: Partial<AdminSettings> | undefined): AdminSettings {
  return {
    registrationForm: normalizeRegistrationFormSettings(value?.registrationForm),
    emailTemplates: value?.emailTemplates || DEFAULT_EMAIL_TEMPLATE_SETTINGS,
    webhookSettings: value?.webhookSettings || {
      registration: {
        url: process.env.GHL_REGISTRATION_WEBHOOK_URL || '',
        token: process.env.GHL_REGISTRATION_WEBHOOK_TOKEN || '',
      },
      payment: {
        url: process.env.GHL_QR_WEBHOOK_URL || '',
        token: process.env.GHL_QR_WEBHOOK_TOKEN || '',
      },
    },
    envFields: normalizeEnvFields(value?.envFields),
  }
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

export async function updateWebhookSettings(webhookSettings: AdminSettings['webhookSettings']) {
  // Update both database and env file
  const currentSettings = await readAdminSettings()
  const updatedSettings = {
    ...currentSettings,
    webhookSettings,
  }
  
  // Save to database/JSON
  await writeAdminSettings(updatedSettings)
  
  // Also update .env.local for immediate use
  await updateEditableEnvValues({
    GHL_REGISTRATION_WEBHOOK_URL: webhookSettings.registration.url,
    GHL_REGISTRATION_WEBHOOK_TOKEN: webhookSettings.registration.token,
    GHL_QR_WEBHOOK_URL: webhookSettings.payment.url,
    GHL_QR_WEBHOOK_TOKEN: webhookSettings.payment.token,
  })
  
  return { success: true }
}
