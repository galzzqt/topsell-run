import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { FAMILY_COOKIE, type FamilySession } from './family-session'

function getFamilySecret() {
  return process.env.FAMILY_SESSION_SECRET || process.env.COMMUNITY_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.MONGODB_URI || ''
}

function sign(value: string) {
  return createHmac('sha256', getFamilySecret()).update(value).digest('hex')
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

type EncodedSession = FamilySession & {
  issuedAt: number
}

function encode(payload: EncodedSession) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decode(raw: string) {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<EncodedSession>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.id !== 'string' || typeof parsed.phone !== 'string' || typeof parsed.name !== 'string') return null
    if (typeof parsed.issuedAt !== 'number' || !Number.isFinite(parsed.issuedAt)) return null
    return parsed as EncodedSession
  } catch {
    return null
  }
}

export async function createFamilySession(session: FamilySession) {
  const payload = encode({
    ...session,
    issuedAt: Date.now(),
  })
  const token = `${payload}.${sign(payload)}`
  const cookieStore = await cookies()
  const headersList = await headers()
  const isHttps = headersList.get('x-forwarded-proto') === 'https'

  cookieStore.set(FAMILY_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttps,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearFamilySession() {
  const cookieStore = await cookies()
  const headersList = await headers()
  const isHttps = headersList.get('x-forwarded-proto') === 'https'

  cookieStore.set(FAMILY_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttps,
    path: '/',
    maxAge: 0,
  })
}

export async function getFamilySession(): Promise<FamilySession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(FAMILY_COOKIE)?.value
  if (!token) {
    return null
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return null
  }

  if (!getFamilySecret()) {
    return null
  }

  const expectedSignature = sign(encodedPayload)
  if (!safeCompare(signature, expectedSignature)) {
    return null
  }

  const payload = decode(encodedPayload)
  if (!payload) {
    return null
  }

  const maxAgeMs = 1000 * 60 * 60 * 24 * 7
  if (Date.now() - payload.issuedAt > maxAgeMs) {
    return null
  }

  return {
    id: payload.id,
    phone: payload.phone,
    name: payload.name,
  }
}

export type { FamilySession }
