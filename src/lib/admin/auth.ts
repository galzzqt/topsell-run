import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

const ADMIN_COOKIE = 'topsell_admin_session'

function getAdminPassword() {
  return process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || ''
}

function getAdminSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function sign(value: string) {
  return createHmac('sha256', getAdminSecret()).update(value).digest('hex')
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function createAdminSession() {
  const issuedAt = Date.now().toString()
  const nonce = crypto.randomUUID()
  const payload = `${issuedAt}.${nonce}`
  const token = `${payload}.${sign(payload)}`
  const cookieStore = await cookies()

  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 60 * 60 * 8,
  })
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 0,
  })
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) return false

  const [issuedAt, nonce, signature] = token.split('.')
  if (!issuedAt || !nonce || !signature) return false

  const issuedAtNumber = Number(issuedAt)
  if (!Number.isFinite(issuedAtNumber)) return false

  const maxAgeMs = 1000 * 60 * 60 * 8
  if (Date.now() - issuedAtNumber > maxAgeMs) return false

  return Boolean(getAdminSecret()) && safeCompare(signature, sign(`${issuedAt}.${nonce}`))
}

export function verifyAdminPassword(password: string) {
  const adminPassword = getAdminPassword()
  if (!adminPassword) return false
  return safeCompare(password, adminPassword)
}
