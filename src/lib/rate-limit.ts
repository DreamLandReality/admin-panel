/**
 * Simple in-memory sliding-window rate limiter.
 * No external dependencies — suitable for single-instance deployments.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 10 })
 *   // In API route:
 *   const { limited } = limiter.check(userId)
 *   if (limited) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 */

interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Max requests allowed per window */
  max: number
}

interface RateLimitResult {
  limited: boolean
  remaining: number
  resetMs: number
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  const hits = new Map<string, number[]>()

  // Periodically clean up stale entries to prevent memory growth
  const cleanup = setInterval(() => {
    const now = Date.now()
    hits.forEach((timestamps, key) => {
      const valid = timestamps.filter((t: number) => now - t < windowMs)
      if (valid.length === 0) {
        hits.delete(key)
      } else {
        hits.set(key, valid)
      }
    })
  }, windowMs)

  // Allow GC if the module is unloaded
  if (typeof cleanup === 'object' && 'unref' in cleanup) {
    cleanup.unref()
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      const timestamps = (hits.get(key) ?? []).filter((t) => now - t < windowMs)

      if (timestamps.length >= max) {
        const oldestInWindow = timestamps[0]
        return {
          limited: true,
          remaining: 0,
          resetMs: oldestInWindow + windowMs - now,
        }
      }

      timestamps.push(now)
      hits.set(key, timestamps)

      return {
        limited: false,
        remaining: max - timestamps.length,
        resetMs: windowMs,
      }
    },
  }
}
