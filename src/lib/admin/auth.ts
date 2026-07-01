import { cookies, headers } from 'next/headers'

export const ADMIN_COOKIE = 'topsell_admin_session'

function getAdminSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET or SESSION_SECRET is required in production')
  }
  return secret || 'dev-secret-only-use-in-development-do-not-commit-this'
}

async function getCryptoKey(secret: string) {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function sign(value: string) {
  const key = await getCryptoKey(getAdminSecret())
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const signature = await crypto.subtle.sign('HMAC', key, data)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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
    // Decode base64url to UTF-8 string using Web APIs (Edge-compatible)
    const binaryString = atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const text = new TextDecoder('utf-8').decode(bytes)
    const parsed = JSON.parse(text) as Partial<EncodedSession>
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
  const signature = await sign(payload)
  const token = `${payload}.${signature}`
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

  if (!Boolean(getAdminSecret())) {
    return null
  }

  const expectedSignature = await sign(encodedPayload)
  if (signature !== expectedSignature) {
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

export async function getAdminSessionFromRequest(request: { cookies: { get: (name: string) => { value: string } | undefined } }): Promise<AdminSession | null> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  if (!Boolean(getAdminSecret())) return null

  const expectedSignature = await sign(encodedPayload)
  if (signature !== expectedSignature) {
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
