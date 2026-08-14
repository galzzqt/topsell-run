import { headers } from 'next/headers'

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export async function getClientIp(): Promise<string> {
  try {
    const headerList = await headers()
    const forwarded = headerList.get('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    const realIp = headerList.get('x-real-ip')
    if (realIp) return realIp.trim()
  } catch {
    // outside request context or headers not available
  }
  return '127.0.0.1'
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1 }
  }

  current.count += 1
  const remaining = Math.max(limit - current.count, 0)
  return { limited: current.count > limit, remaining, retryAfterMs: current.resetAt - now }
}

export async function rateLimitByIp(action: string, limit: number, windowMs: number, extraId?: string) {
  const ip = await getClientIp()
  const key = extraId ? `${action}:${ip}:${extraId}` : `${action}:${ip}`
  return rateLimit(key, limit, windowMs)
}

export function clearRateLimit(key: string) {
  buckets.delete(key)
}

export function clearAllRateLimits() {
  buckets.clear()
}

