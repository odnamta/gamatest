'use server'

import { withUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import type { UserStats, StudyLog } from '@/types/database'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Server Action for fetching user stats.
 * Requirements: 8.2, 8.3
 */
export async function getUserStats(): Promise<ActionResultV2<{ stats: UserStats | null }>> {
  return withUser(async ({ user, supabase }) => {
    try {
      const { data: stats, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected for new users
        return { ok: false, error: error.message }
      }

      return { ok: true, data: { stats: stats as UserStats | null } }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, RATE_LIMITS.standard)
}

/**
 * Server Action for fetching study logs for the heatmap.
 * Fetches the last N days of study activity.
 * Requirements: 2.2, 9.2
 */
export async function getStudyLogs(days: number = 60): Promise<ActionResultV2<{ logs: StudyLog[] }>> {
  // V20.6: Bounds validation — cap days to prevent expensive queries
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)))

  return withUser(async ({ user, supabase }) => {
    try {
      // Calculate the date N days ago
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - safeDays)
      const startDateStr = startDate.toISOString().split('T')[0]

      const { data: logs, error } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('study_date', startDateStr)
        .order('study_date', { ascending: true })

      if (error) {
        return { ok: false, error: error.message }
      }

      return { ok: true, data: { logs: (logs || []) as StudyLog[] } }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, RATE_LIMITS.standard)
}
