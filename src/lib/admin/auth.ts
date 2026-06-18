import { createHmac, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'

const ADMIN_COOKIE = 'topsell_admin_session'

function getAdminSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.COMMUNITY_SESSION_SECRET || process.env.MONGODB_URI || ''
}

function sign(value: string) {
  return createHmac('sha256', getAdminSecret()).update(value).digest('hex')
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export type AdminRole = 'superadmin' | 'admin'

export type AdminSession = {
  id: string
  username: string
  name: string
  role: AdminRole
}

type EncodedSession = AdminSession & {
  issuedAt: number
}

function encode(payload: EncodedSession) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decode(raw: string) {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<EncodedSession>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.id !== 'string' || typeof parsed.username !== 'string' || typeof parsed.name !== 'string') return null
    if (parsed.role !== 'admin' && parsed.role !== 'superadmin') return null
    if (typeof parsed.issuedAt !== 'number' || !Number.isFinite(parsed.issuedAt)) return null
    return parsed as EncodedSession
  } catch {
    return null
  }
}

export async function createAdminSession(session: AdminSession) {
  const payload = encode({
    ...session,
    issuedAt: Date.now(),
  })
  const token = `${payload}.${sign(payload)}`
  const cookieStore = await cookies()
  const headersList = await headers()
  const isHttps = headersList.get('x-forwarded-proto') === 'https'

  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttps,
    path: '/admin',
    maxAge: 60 * 60 * 8,
  })
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const isHttps = headersList.get('x-forwarded-proto') === 'https'

  cookieStore.set(ADMIN_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttps,
    path: '/admin',
    maxAge: 0,
  })
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  if (!Boolean(getAdminSecret()) || !safeCompare(signature, sign(encodedPayload))) {
    return null
  }

  const payload = decode(encodedPayload)
  if (!payload) return null

  const maxAgeMs = 1000 * 60 * 60 * 8
  if (Date.now() - payload.issuedAt > maxAgeMs) return null

  return {
    id: payload.id,
    username: payload.username,
    name: payload.name,
    role: payload.role,
  }
}

export async function isAdminAuthenticated() {
  return Boolean(await getAdminSession())
}
