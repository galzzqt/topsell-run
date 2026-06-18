import 'server-only'

import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'
import { getAppSetting, upsertAppSetting } from '@/lib/db'
import type { AdminRole } from './auth'

const ADMIN_ACCOUNTS_KEY = 'admin_accounts'
const ACCOUNTS_PATH = path.join(process.cwd(), 'data', 'admin-accounts.json')

export type StoredAdminAccount = {
  id: string
  username: string
  name: string
  role: AdminRole
  password_hash: string
  password_salt: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type AdminAccountPublic = Omit<StoredAdminAccount, 'password_hash' | 'password_salt'>

type PersistedAdminAccount = Partial<StoredAdminAccount>

function normalizeUsername(value: string) {
  return value.trim().toLowerCase()
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString('hex')
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function normalizeStoredAccount(value: PersistedAdminAccount): StoredAdminAccount | null {
  if (
    !value.id ||
    !value.username ||
    !value.name ||
    !value.password_hash ||
    !value.password_salt ||
    !value.created_at ||
    !value.updated_at
  ) {
    return null
  }

  const username = normalizeUsername(value.username)
  if (!username) return null

  const role: AdminRole = value.role === 'superadmin' ? 'superadmin' : 'admin'

  return {
    id: value.id,
    username,
    name: value.name.trim(),
    role,
    password_hash: value.password_hash,
    password_salt: value.password_salt,
    is_active: value.is_active !== false,
    created_at: value.created_at,
    updated_at: value.updated_at,
  }
}

async function readAccountsFromDb() {
  const value = await getAppSetting<PersistedAdminAccount[]>(ADMIN_ACCOUNTS_KEY)
  if (!value) return [] as StoredAdminAccount[]

  const rows = Array.isArray(value) ? value : []
  return rows
    .map((row) => normalizeStoredAccount(row as PersistedAdminAccount))
    .filter((row): row is StoredAdminAccount => Boolean(row))
}

async function readAccountsFromFile() {
  const raw = await fs.readFile(ACCOUNTS_PATH, 'utf8')
  const parsed = JSON.parse(raw) as PersistedAdminAccount[]
  return (Array.isArray(parsed) ? parsed : [])
    .map((row) => normalizeStoredAccount(row))
    .filter((row): row is StoredAdminAccount => Boolean(row))
}

async function writeAccountsToDb(accounts: StoredAdminAccount[]) {
  await upsertAppSetting(ADMIN_ACCOUNTS_KEY, accounts)
}

async function writeAccountsToFile(accounts: StoredAdminAccount[]) {
  await fs.mkdir(path.dirname(ACCOUNTS_PATH), { recursive: true })
  await fs.writeFile(ACCOUNTS_PATH, `${JSON.stringify(accounts, null, 2)}\n`, 'utf8')
}

export async function readManagedAdminAccounts() {
  try {
    return await readAccountsFromDb()
  } catch {
    try {
      return await readAccountsFromFile()
    } catch {
      return []
    }
  }
}

export async function writeManagedAdminAccounts(accounts: StoredAdminAccount[]) {
  const unique = new Set<string>()
  const normalized = accounts
    .map((account) => normalizeStoredAccount(account))
    .filter((account): account is StoredAdminAccount => Boolean(account))
    .filter((account) => {
      if (unique.has(account.username)) return false
      unique.add(account.username)
      return true
    })

  try {
    await writeAccountsToDb(normalized)
    return
  } catch {
    await writeAccountsToFile(normalized)
  }
}

export async function getAdminPublicAccounts(): Promise<AdminAccountPublic[]> {
  const accounts = await readManagedAdminAccounts()
  return accounts.map((account) => ({
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    is_active: account.is_active,
    created_at: account.created_at,
    updated_at: account.updated_at,
  }))
}

function getSuperAdminCandidate() {
  const password = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
  if (!password) return null

  const username = normalizeUsername(process.env.SUPER_ADMIN_USERNAME || 'superadmin')
  const name = process.env.SUPER_ADMIN_NAME || 'Super Admin'
  return {
    id: 'superadmin-env',
    username,
    name,
    role: 'superadmin' as const,
    password,
  }
}

function getEnvAdminCandidate() {
  const password = process.env.ADMIN_PASSWORD || ''
  if (!password) return null
  const superPassword = process.env.SUPER_ADMIN_PASSWORD || ''
  if (superPassword && safeCompare(password, superPassword)) return null

  const username = normalizeUsername(process.env.ADMIN_USERNAME || 'admin')
  return {
    id: 'admin-env',
    username,
    name: process.env.ADMIN_NAME || 'Admin',
    role: 'admin' as const,
    password,
  }
}

export async function resolveAdminLogin(usernameInput: string, password: string) {
  const username = normalizeUsername(usernameInput)
  if (!username || !password) return null

  const superAdmin = getSuperAdminCandidate()
  if (superAdmin && username === superAdmin.username && safeCompare(password, superAdmin.password)) {
    return {
      id: superAdmin.id,
      username: superAdmin.username,
      name: superAdmin.name,
      role: superAdmin.role,
    }
  }

  const envAdmin = getEnvAdminCandidate()
  if (envAdmin && username === envAdmin.username && safeCompare(password, envAdmin.password)) {
    return {
      id: envAdmin.id,
      username: envAdmin.username,
      name: envAdmin.name,
      role: envAdmin.role,
    }
  }

  const accounts = await readManagedAdminAccounts()
  const account = accounts.find((item) => item.username === username && item.is_active)
  if (!account) return null
  const digest = hashPassword(password, account.password_salt)
  if (!safeCompare(account.password_hash, digest)) return null

  return {
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
  }
}

export function createPasswordRecord(password: string) {
  const salt = createHmac('sha256', randomUUID()).update(`${Date.now()}`).digest('hex').slice(0, 24)
  return {
    password_salt: salt,
    password_hash: hashPassword(password, salt),
  }
}
