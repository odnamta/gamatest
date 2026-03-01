/**
 * V22: Centralized environment variable validation.
 *
 * Called from instrumentation.ts on server startup.
 * Logs warnings for missing optional vars, throws for missing required vars.
 */

import { logger } from '@/lib/logger'

const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const OPTIONAL_VARS = [
  { key: 'OPENAI_API_KEY', feature: 'AI MCQ generation' },
  { key: 'RESEND_API_KEY', feature: 'Email notifications' },
  { key: 'NEXT_PUBLIC_APP_URL', feature: 'Email links (falls back to https://cekatan.com)' },
  { key: 'UPSTASH_REDIS_REST_URL', feature: 'Production rate limiting (REQUIRED on Vercel — in-memory fallback is per-Lambda)' },
  { key: 'UPSTASH_REDIS_REST_TOKEN', feature: 'Production rate limiting (REQUIRED on Vercel — in-memory fallback is per-Lambda)' },
  { key: 'HEALTH_API_KEY', feature: 'Health endpoint auth (if unset, detailed status is hidden)' },
] as const

export function validateEnv(): void {
  const missing: string[] = []

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  for (const { key, feature } of OPTIONAL_VARS) {
    if (!process.env[key]) {
      logger.warn('env.optional', `${key} not set — ${feature} disabled`)
    }
  }
}
