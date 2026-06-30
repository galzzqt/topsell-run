import { createHmac, timingSafeEqual } from 'crypto'

const COMMUNITY_COOKIE = 'topsell_community_session'

function getCommunitySecret() {
  const secret = process.env.COMMUNITY_SESSION_SECRET || process.env.SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('COMMUNITY_SESSION_SECRET or SESSION_SECRET is required in production')
  }
  return secret || 'dev-secret-only-use-in-development-do-not-commit-this'
}

function sign(value: string) {
  return createHmac('sha256', getCommunitySecret()).update(value).digest('hex')
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export type CommunitySession = {
  id: string
  phone: string
  name: string
}

type EncodedSession = CommunitySession & {
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

export function getCommunitySessionFromRequest(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const token = request.cookies.get(COMMUNITY_COOKIE)?.value
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  if (!getCommunitySecret() || !safeCompare(signature, sign(encodedPayload))) {
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

export { COMMUNITY_COOKIE }
