type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

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

export function clearRateLimit(key: string) {
  buckets.delete(key)
}
