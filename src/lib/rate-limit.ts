/**
 * V22: Rate limiter using Upstash Redis (works on Vercel serverless).
 *
 * Uses @upstash/ratelimit sliding window algorithm backed by Upstash Redis.
 * Falls back to in-memory store when UPSTASH env vars are not set (local dev).
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export type RateLimitConfig = {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetMs: number
}

// Singleton Redis client — created once per cold start
let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    if (process.env.VERCEL) {
      console.error('[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set on Vercel — rate limiting is ineffective (each Lambda has its own in-memory store)')
    }
    return null
  }
  redis = new Redis({ url, token })
  return redis
}

// Cache of Ratelimit instances keyed by "maxRequests:windowMs"
const limiters = new Map<string, Ratelimit>()

function getLimiter(config: RateLimitConfig): Ratelimit | null {
  const r = getRedis()
  if (!r) return null

  const key = `${config.maxRequests}:${config.windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    const windowSec = Math.ceil(config.windowMs / 1000)
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSec} s`),
      prefix: 'cekatan:rl',
    })
    limiters.set(key, limiter)
  }
  return limiter
}

// ============================================
// In-memory fallback (local dev only)
// ============================================

const memStore = new Map<string, number[]>()
let lastGc = Date.now()
const GC_INTERVAL_MS = 5 * 60_000 // 5 minutes

function gcMemStore() {
  const now = Date.now()
  if (now - lastGc < GC_INTERVAL_MS) return
  lastGc = now
  const maxWindow = 60 * 60_000 // 1 hour (longest window)
  for (const [key, timestamps] of memStore) {
    const fresh = timestamps.filter((t) => t > now - maxWindow)
    if (fresh.length === 0) {
      memStore.delete(key)
    } else {
      memStore.set(key, fresh)
    }
  }
}

function checkMemoryRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  gcMemStore()
  const now = Date.now()
  const windowStart = now - config.windowMs
  let timestamps = memStore.get(key) ?? []
  timestamps = timestamps.filter((t) => t > windowStart)

  if (timestamps.length >= config.maxRequests) {
    memStore.set(key, timestamps)
    return { allowed: false, remaining: 0, resetMs: timestamps[0] + config.windowMs - now }
  }

  timestamps.push(now)
  memStore.set(key, timestamps)
  return { allowed: true, remaining: config.maxRequests - timestamps.length, resetMs: config.windowMs }
}

// ============================================
// Public API
// ============================================

/**
 * Check and consume a rate limit token for the given key.
 * Uses Upstash Redis in production, in-memory in local dev.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const limiter = getLimiter(config)

  if (!limiter) {
    // Fallback to in-memory for local dev
    return checkMemoryRateLimit(key, config)
  }

  try {
    const result = await limiter.limit(key)
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetMs: result.reset - Date.now(),
    }
  } catch {
    // If Redis is down, fail open (allow the request)
    return { allowed: true, remaining: config.maxRequests, resetMs: config.windowMs }
  }
}

// Pre-configured rate limit profiles
export const RATE_LIMITS = {
  /** General API actions: 60 requests per minute */
  standard: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,
  /** Sensitive actions (session start, complete): 10 per minute */
  sensitive: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,
  /** Bulk operations: 5 per minute */
  bulk: { maxRequests: 5, windowMs: 60_000 } as RateLimitConfig,
  /** Auth attempts: 10 per 5 minutes */
  auth: { maxRequests: 10, windowMs: 5 * 60_000 } as RateLimitConfig,
  /** Public registration: 5 per hour per IP */
  publicRegistration: { maxRequests: 5, windowMs: 60 * 60_000 } as RateLimitConfig,
} as const
