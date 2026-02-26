'use server'

/**
 * V16: Org-Level Analytics Server Actions
 *
 * Aggregate stats across all assessments for org admins/creators.
 */

import { withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'

export interface OrgAnalytics {
  totalAssessments: number
  publishedAssessments: number
  totalSessions: number
  completedSessions: number
  timedOutSessions: number
  uniqueCandidates: number
  avgScore: number
  avgPassRate: number
  // Per-assessment breakdown
  assessmentStats: Array<{
    id: string
    title: string
    status: string
    sessions: number
    completedCount: number
    avgScore: number
    passRate: number
  }>
  // Score trend: last 12 weeks
  weeklyTrend: Array<{
    week: string
    avgScore: number
    completions: number
  }>
  // Cohort analytics
  cohort: {
    topPerformers: Array<{ userId: string; email: string; avgScore: number; assessmentsTaken: number }>
    bottomPerformers: Array<{ userId: string; email: string; avgScore: number; assessmentsTaken: number }>
    passRateTrend: Array<{ week: string; passRate: number }>
    scoreDistribution: { below40: number; between40_70: number; above70: number }
  }
}

/**
 * Get org-wide analytics summary. Creator+ only.
 */
export async function getOrgAnalytics(): Promise<ActionResultV2<OrgAnalytics>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get all assessments
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, title, status')
      .eq('org_id', org.id)

    if (!assessments || assessments.length === 0) {
      return {
        ok: true,
        data: {
          totalAssessments: 0,
          publishedAssessments: 0,
          totalSessions: 0,
          completedSessions: 0,
          timedOutSessions: 0,
          uniqueCandidates: 0,
          avgScore: 0,
          avgPassRate: 0,
          assessmentStats: [],
          weeklyTrend: [],
          cohort: {
            topPerformers: [],
            bottomPerformers: [],
            passRateTrend: [],
            scoreDistribution: { below40: 0, between40_70: 0, above70: 0 },
          },
        },
      }
    }

    const assessmentIds = assessments.map((a) => a.id)

    // Get sessions for these assessments (bounded to last 90 days for performance)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, assessment_id, user_id, status, score, passed, completed_at')
      .in('assessment_id', assessmentIds)
      .gte('created_at', ninetyDaysAgo.toISOString())

    const allSessions = sessions ?? []
    const completed = allSessions.filter((s) => s.status === 'completed' || s.status === 'timed_out')
    const uniqueUsers = new Set(allSessions.map((s) => s.user_id))

    // Overall stats
    const scores = completed.filter((s) => s.score != null).map((s) => s.score as number)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const passCount = completed.filter((s) => s.passed).length
    const avgPassRate = completed.length > 0 ? Math.round((passCount / completed.length) * 100) : 0

    // Per-assessment breakdown
    const assessmentStats = assessments.map((a) => {
      const aSessions = allSessions.filter((s) => s.assessment_id === a.id)
      const aCompleted = aSessions.filter((s) => s.status === 'completed' || s.status === 'timed_out')
      const aScores = aCompleted.filter((s) => s.score != null).map((s) => s.score as number)
      const aPassCount = aCompleted.filter((s) => s.passed).length

      return {
        id: a.id,
        title: a.title,
        status: a.status,
        sessions: aSessions.length,
        completedCount: aCompleted.length,
        avgScore: aScores.length > 0 ? Math.round(aScores.reduce((x, y) => x + y, 0) / aScores.length) : 0,
        passRate: aCompleted.length > 0 ? Math.round((aPassCount / aCompleted.length) * 100) : 0,
      }
    }).sort((a, b) => b.sessions - a.sessions)

    // Weekly trend — last 12 weeks
    const weeklyTrend: Array<{ week: string; avgScore: number; completions: number }> = []
    const now = new Date()
    for (let w = 11; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - w * 7)
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week (Sunday)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekSessions = completed.filter((s) => {
        if (!s.completed_at) return false
        const d = new Date(s.completed_at)
        return d >= weekStart && d < weekEnd
      })

      const wScores = weekSessions.filter((s) => s.score != null).map((s) => s.score as number)
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`

      weeklyTrend.push({
        week: label,
        avgScore: wScores.length > 0 ? Math.round(wScores.reduce((a, b) => a + b, 0) / wScores.length) : 0,
        completions: weekSessions.length,
      })
    }

    // Cohort analytics: per-candidate performance
    const userScoreMap = new Map<string, { scores: number[]; email: string }>()
    for (const s of completed) {
      if (s.score == null) continue
      const existing = userScoreMap.get(s.user_id)
      if (existing) {
        existing.scores.push(s.score)
      } else {
        userScoreMap.set(s.user_id, { scores: [s.score], email: '' })
      }
    }

    // Fetch emails for candidates from profiles table
    if (userScoreMap.size > 0) {
      const userIds = [...userScoreMap.keys()]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) {
          const entry = userScoreMap.get(p.id)
          if (entry) entry.email = p.email ?? 'Unknown'
        }
      }
    }

    const candidatePerf = Array.from(userScoreMap.entries())
      .map(([userId, { scores, email }]) => ({
        userId,
        email,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        assessmentsTaken: scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)

    const topPerformers = candidatePerf.slice(0, 5)
    const bottomPerformers = candidatePerf.length > 5
      ? candidatePerf.slice(-5).reverse()
      : []

    // Pass rate trend
    const passRateTrend = weeklyTrend.map((w, i) => {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - (11 - i) * 7)
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const wCompleted = completed.filter((s) => {
        if (!s.completed_at) return false
        const d = new Date(s.completed_at)
        return d >= weekStart && d < weekEnd
      })
      const wPassed = wCompleted.filter((s) => s.passed).length
      return {
        week: w.week,
        passRate: wCompleted.length > 0 ? Math.round((wPassed / wCompleted.length) * 100) : 0,
      }
    })

    // Score band distribution
    const below40 = scores.filter((s) => s < 40).length
    const between40_70 = scores.filter((s) => s >= 40 && s < 70).length
    const above70 = scores.filter((s) => s >= 70).length

    return {
      ok: true,
      data: {
        totalAssessments: assessments.length,
        publishedAssessments: assessments.filter((a) => a.status === 'published').length,
        totalSessions: allSessions.length,
        completedSessions: completed.filter((s) => s.status === 'completed').length,
        timedOutSessions: completed.filter((s) => s.status === 'timed_out').length,
        uniqueCandidates: uniqueUsers.size,
        avgScore,
        avgPassRate,
        assessmentStats,
        weeklyTrend,
        cohort: {
          topPerformers,
          bottomPerformers,
          passRateTrend,
          scoreDistribution: { below40, between40_70, above70 },
        },
      },
    }
  }, undefined, RATE_LIMITS.standard)
}
