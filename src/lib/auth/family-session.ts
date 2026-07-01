const FAMILY_COOKIE = 'topsell_family_session'

function getFamilySecret() {
  const secret = process.env.FAMILY_SESSION_SECRET || process.env.SESSION_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FAMILY_SESSION_SECRET or SESSION_SECRET is required in production')
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
  const key = await getCryptoKey(getFamilySecret())
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const signature = await crypto.subtle.sign('HMAC', key, data)
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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
    // Decode base64url to UTF-8 string using Web APIs (Edge-compatible)
    const binaryString = atob(raw.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    const text = new TextDecoder('utf-8').decode(bytes)
    const parsed = JSON.parse(text) as Partial<EncodedSession>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.id !== 'string' || typeof parsed.phone !== 'string' || typeof parsed.name !== 'string') return null
    if (typeof parsed.issuedAt !== 'number' || !Number.isFinite(parsed.issuedAt)) return null
    return parsed as EncodedSession
  } catch {
    return null
  }
}

export async function getFamilySessionFromRequest(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const token = request.cookies.get(FAMILY_COOKIE)?.value
  if (!token) return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null

  if (!getFamilySecret()) {
    return null
  }

  const expectedSignature = await sign(encodedPayload)
  if (signature !== expectedSignature) {
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
