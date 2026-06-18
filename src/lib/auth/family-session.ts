import { createHmac, timingSafeEqual } from 'crypto'

const FAMILY_COOKIE = 'topsell_family_session'

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

export type FamilySession = {
  id: string
  phone: string
  name: string
}

type EncodedSession = FamilySession & {
  issuedAt: number
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

export function getFamilySessionFromRequest(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const token = request.cookies.get(FAMILY_COOKIE)?.value
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  if (!getFamilySecret() || !safeCompare(signature, sign(encodedPayload))) {
    return null
  }

  const payload = decode(encodedPayload)
  if (!payload) return null

  const maxAgeMs = 1000 * 60 * 60 * 24 * 7
  if (Date.now() - payload.issuedAt > maxAgeMs) return null

  return {
    id: payload.id,
    phone: payload.phone,
    name: payload.name,
  }
}

export { FAMILY_COOKIE }
