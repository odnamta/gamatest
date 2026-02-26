'use server'

/**
 * Assessment analytics and dashboard: summary stats, question analytics, org dashboard,
 * candidate score progression, violation heatmap.
 */

import { withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Get analytics summary for an assessment.
 * Includes score distribution, completion rate, average time, and top/bottom performers.
 */
export async function getAssessmentAnalyticsSummary(
  assessmentId: string
): Promise<ActionResultV2<{
  scoreDistribution: number[] // 10 buckets: [0-9, 10-19, ..., 90-100]
  completionRate: number
  avgTimeMinutes: number | null
  medianScore: number | null
  totalStarted: number
  totalCompleted: number
  topPerformers: Array<{ email: string; score: number; completedAt: string }>
  tabSwitchCorrelation: Array<{ tabSwitches: number; score: number }>
  attemptsByHour: number[] // 24 buckets (0-23)
  scoreTrend: Array<{ attempt: number; avgScore: number }>
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get all sessions for this assessment
    const { data: allSessions } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(org_id, time_limit_minutes)')
      .eq('assessment_id', assessmentId)
      .order('completed_at', { ascending: false })

    const orgSessions = (allSessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    const totalStarted = orgSessions.length
    const completed = orgSessions.filter((s) => s.status === 'completed')
    const totalCompleted = completed.length
    const completionRate = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0

    // Score distribution: 10 buckets
    const scoreDistribution = Array(10).fill(0)
    const scores: number[] = []
    for (const s of completed) {
      const score = s.score ?? 0
      scores.push(score)
      const bucket = score === 100 ? 9 : Math.floor(score / 10)
      scoreDistribution[bucket]++
    }

    // Median score
    scores.sort((a, b) => a - b)
    const medianScore = scores.length > 0
      ? scores.length % 2 === 0
        ? Math.round((scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2)
        : scores[Math.floor(scores.length / 2)]
      : null

    // Average time (time_limit - time_remaining at completion)
    let avgTimeMinutes: number | null = null
    const timeLimitMinutes = orgSessions[0]
      ? (orgSessions[0].assessments as unknown as { time_limit_minutes: number }).time_limit_minutes
      : null
    if (timeLimitMinutes && completed.length > 0) {
      const totalTimeSeconds = completed.reduce((sum, s) => {
        const remaining = s.time_remaining_seconds ?? 0
        return sum + (timeLimitMinutes * 60 - remaining)
      }, 0)
      avgTimeMinutes = Math.round((totalTimeSeconds / completed.length / 60) * 10) / 10
    }

    // Top performers
    const userIds = [...new Set(completed.slice(0, 10).map((s) => s.user_id))]
    const emailMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) emailMap.set(p.id, p.email)
      }
    }

    // Sort by score desc, take top 5
    const sortedByScore = [...completed].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const topPerformers = sortedByScore.slice(0, 5).map((s) => ({
      email: emailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`,
      score: s.score ?? 0,
      completedAt: s.completed_at ?? '',
    }))

    // Tab-switch vs score correlation (for completed/timed_out sessions with scores)
    const tabSwitchCorrelation = orgSessions
      .filter((s) => s.score != null && (s.status === 'completed' || s.status === 'timed_out'))
      .map((s) => ({
        tabSwitches: s.tab_switch_count ?? 0,
        score: s.score ?? 0,
      }))

    // Attempts by hour of day
    const attemptsByHour = Array(24).fill(0)
    for (const s of orgSessions) {
      if (s.started_at) {
        const hour = new Date(s.started_at).getHours()
        attemptsByHour[hour]++
      }
    }

    // Score trend: average score grouped by attempt number per user
    const userAttempts = new Map<string, number[]>()
    // Sort by started_at ascending to get correct attempt ordering
    const sorted = [...orgSessions]
      .filter((s) => s.score != null && (s.status === 'completed' || s.status === 'timed_out'))
      .sort((a, b) => a.started_at.localeCompare(b.started_at))
    for (const s of sorted) {
      const arr = userAttempts.get(s.user_id) ?? []
      arr.push(s.score ?? 0)
      userAttempts.set(s.user_id, arr)
    }
    const maxAttemptNum = Math.min(
      10,
      Math.max(...[...userAttempts.values()].map((a) => a.length), 0)
    )
    const scoreTrend: Array<{ attempt: number; avgScore: number }> = []
    for (let i = 0; i < maxAttemptNum; i++) {
      const scoresAtAttempt: number[] = []
      for (const arr of userAttempts.values()) {
        if (i < arr.length) scoresAtAttempt.push(arr[i])
      }
      if (scoresAtAttempt.length > 0) {
        scoreTrend.push({
          attempt: i + 1,
          avgScore: Math.round(scoresAtAttempt.reduce((a, b) => a + b, 0) / scoresAtAttempt.length),
        })
      }
    }

    return {
      ok: true,
      data: {
        scoreDistribution,
        completionRate,
        avgTimeMinutes,
        medianScore,
        totalStarted,
        totalCompleted,
        topPerformers,
        tabSwitchCorrelation,
        attemptsByHour,
        scoreTrend,
      },
    }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get per-question analytics for an assessment.
 * Returns each question's stem, total attempts, correct count, and % correct.
 */
export async function getQuestionAnalytics(
  assessmentId: string
): Promise<ActionResultV2<{
  questions: Array<{
    cardTemplateId: string
    stem: string
    totalAttempts: number
    correctCount: number
    percentCorrect: number
    avgTimeSeconds: number | null
    discriminationIndex: number | null
  }>
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Verify assessment belongs to org
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, deck_template_id')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!assessment) {
      return { ok: false, error: 'Assessment not found' }
    }

    // Get all completed sessions with scores for this assessment
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, score')
      .eq('assessment_id', assessmentId)
      .eq('status', 'completed')

    if (!sessions || sessions.length === 0) {
      return { ok: true, data: { questions: [] } }
    }

    const sessionIds = sessions.map((s) => s.id)

    // Get all answers for these sessions
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('session_id, card_template_id, is_correct, time_spent_seconds')
      .in('session_id', sessionIds)

    if (!answers) {
      return { ok: true, data: { questions: [] } }
    }

    // Aggregate per question
    const questionMap = new Map<string, { total: number; correct: number; timeSum: number; timeCount: number }>()
    for (const a of answers) {
      const entry = questionMap.get(a.card_template_id) ?? { total: 0, correct: 0, timeSum: 0, timeCount: 0 }
      entry.total++
      if (a.is_correct) entry.correct++
      if (a.time_spent_seconds != null && a.time_spent_seconds > 0) {
        entry.timeSum += a.time_spent_seconds
        entry.timeCount++
      }
      questionMap.set(a.card_template_id, entry)
    }

    // Compute discrimination index (top 27% vs bottom 27% correctness)
    const discriminationMap = new Map<string, number | null>()
    if (sessions.length >= 4) {
      const sorted = [...sessions].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      const n27 = Math.max(1, Math.round(sorted.length * 0.27))
      const topIds = new Set(sorted.slice(0, n27).map((s) => s.id))
      const bottomIds = new Set(sorted.slice(-n27).map((s) => s.id))

      // Per-question: count correct in top group vs bottom group
      const perQuestion = new Map<string, { topCorrect: number; topTotal: number; bottomCorrect: number; bottomTotal: number }>()
      for (const a of answers) {
        const inTop = topIds.has(a.session_id)
        const inBottom = bottomIds.has(a.session_id)
        if (!inTop && !inBottom) continue
        const entry = perQuestion.get(a.card_template_id) ?? { topCorrect: 0, topTotal: 0, bottomCorrect: 0, bottomTotal: 0 }
        if (inTop) {
          entry.topTotal++
          if (a.is_correct) entry.topCorrect++
        }
        if (inBottom) {
          entry.bottomTotal++
          if (a.is_correct) entry.bottomCorrect++
        }
        perQuestion.set(a.card_template_id, entry)
      }

      for (const [cardId, d] of perQuestion) {
        if (d.topTotal > 0 && d.bottomTotal > 0) {
          const topRate = d.topCorrect / d.topTotal
          const bottomRate = d.bottomCorrect / d.bottomTotal
          discriminationMap.set(cardId, Math.round((topRate - bottomRate) * 100) / 100)
        }
      }
    }

    // Fetch question stems
    const cardIds = [...questionMap.keys()]
    const { data: cards } = await supabase
      .from('card_templates')
      .select('id, stem')
      .in('id', cardIds)

    const stemMap = new Map<string, string>()
    if (cards) {
      for (const c of cards) {
        stemMap.set(c.id, c.stem)
      }
    }

    // Build result sorted by difficulty (lowest % correct first)
    const questions = cardIds
      .map((id) => {
        const stats = questionMap.get(id)!
        return {
          cardTemplateId: id,
          stem: stemMap.get(id) ?? 'Unknown question',
          totalAttempts: stats.total,
          correctCount: stats.correct,
          percentCorrect: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
          avgTimeSeconds: stats.timeCount > 0 ? Math.round(stats.timeSum / stats.timeCount) : null,
          discriminationIndex: discriminationMap.get(id) ?? null,
        }
      })
      .sort((a, b) => a.percentCorrect - b.percentCorrect)

    return { ok: true, data: { questions } }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get org-level dashboard stats for creators.
 * Returns member count, assessment count, recent activity, and overall pass rate.
 */
export async function getOrgDashboardStats(): Promise<ActionResultV2<{
  memberCount: number
  assessmentCount: number
  totalAttempts: number
  avgPassRate: number
  activeCandidatesThisWeek: number
  topPerformers: Array<{ email: string; avgScore: number; totalCompleted: number }>
  recentSessions: Array<{
    assessmentId: string
    sessionId: string
    assessmentTitle: string
    userEmail: string
    score: number | null
    passed: boolean | null
    completedAt: string | null
  }>
  activeAssessments: Array<{
    id: string
    title: string
    candidateCount: number
    avgScore: number | null
  }>
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Member count
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)

    // Assessment count
    const { count: assessmentCount } = await supabase
      .from('assessments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', org.id)

    // All completed sessions for this org's assessments
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select(`
        id, assessment_id, score, passed, completed_at, user_id,
        assessments!inner(org_id, title)
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(200)

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    const totalAttempts = orgSessions.length
    const avgPassRate = totalAttempts > 0
      ? Math.round((orgSessions.filter((s) => s.passed).length / totalAttempts) * 100)
      : 0

    // Active candidates this week
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString()
    const recentUserIds = new Set(
      orgSessions
        .filter((s) => s.completed_at && s.completed_at >= weekAgoStr)
        .map((s) => s.user_id)
    )
    const activeCandidatesThisWeek = recentUserIds.size

    // Top performers: aggregate avg score per user
    const userScores = new Map<string, { total: number; count: number }>()
    for (const s of orgSessions) {
      if (s.score !== null) {
        const entry = userScores.get(s.user_id) ?? { total: 0, count: 0 }
        entry.total += s.score
        entry.count++
        userScores.set(s.user_id, entry)
      }
    }

    // Get all user IDs we need emails for
    const allUserIds = [...new Set([
      ...orgSessions.slice(0, 5).map((s) => s.user_id),
      ...userScores.keys(),
    ])]
    const emailMap = new Map<string, string>()
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', allUserIds)
      if (profiles) {
        for (const p of profiles) emailMap.set(p.id, p.email)
      }
    }

    // Build top performers (min 2 attempts, sorted by avg score desc)
    const topPerformers = [...userScores.entries()]
      .filter(([, stats]) => stats.count >= 2)
      .map(([userId, stats]) => ({
        email: emailMap.get(userId) ?? `user-${userId.slice(0, 8)}`,
        avgScore: Math.round(stats.total / stats.count),
        totalCompleted: stats.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    // Recent 5 sessions
    const recentSessions = orgSessions.slice(0, 5).map((s) => ({
      assessmentId: s.assessment_id,
      sessionId: s.id,
      assessmentTitle: (s.assessments as unknown as { title: string }).title,
      userEmail: emailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`,
      score: s.score,
      passed: s.passed,
      completedAt: s.completed_at,
    }))

    // Active assessments with candidate counts
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, title')
      .eq('org_id', org.id)
      .eq('is_published', true)
      .limit(5)

    const assessmentMap = new Map<string, { count: number; totalScore: number }>()
    for (const s of orgSessions) {
      const entry = assessmentMap.get(s.assessment_id) ?? { count: 0, totalScore: 0 }
      entry.count++
      entry.totalScore += s.score ?? 0
      assessmentMap.set(s.assessment_id, entry)
    }

    const activeAssessments = (assessments ?? []).map((a) => {
      const stats = assessmentMap.get(a.id)
      return {
        id: a.id,
        title: a.title,
        candidateCount: stats?.count ?? 0,
        avgScore: stats ? Math.round(stats.totalScore / stats.count) : null,
      }
    })

    return {
      ok: true,
      data: {
        memberCount: memberCount ?? 0,
        assessmentCount: assessmentCount ?? 0,
        totalAttempts,
        avgPassRate,
        activeCandidatesThisWeek,
        topPerformers,
        recentSessions,
        activeAssessments,
      },
    }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get a candidate's score progression over time for charting.
 * Returns chronologically ordered sessions with scores and assessment titles.
 * Creator+ only.
 */
export async function getCandidateScoreProgression(
  userId: string
): Promise<ActionResultV2<Array<{
  date: string
  score: number
  assessmentTitle: string
  passed: boolean
}>>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Verify user is in org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', org.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!membership) {
      return { ok: false, error: 'Candidate not found in this organization' }
    }

    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('score, passed, completed_at, assessments!inner(org_id, title)')
      .eq('user_id', userId)
      .in('status', ['completed', 'timed_out'])
      .order('completed_at', { ascending: true })

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    const progression = orgSessions.map((s) => ({
      date: s.completed_at ?? '',
      score: s.score ?? 0,
      assessmentTitle: (s.assessments as unknown as { title: string })?.title ?? 'Unknown',
      passed: s.passed ?? false,
    }))

    return { ok: true, data: progression }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get violation heatmap data: tab switches mapped to question positions.
 * Correlates tab_switch_log timestamps with answer timestamps to determine
 * which question was active during each violation. Creator+ only.
 */
export async function getViolationHeatmap(
  assessmentId: string
): Promise<ActionResultV2<{
  questions: Array<{ index: number; stem: string; violationCount: number }>
  totalViolations: number
  flaggedSessionCount: number
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get flagged sessions with tab_switch_log
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, tab_switch_log, question_order, assessments!inner(org_id)')
      .eq('assessment_id', assessmentId)
      .gt('tab_switch_count', 0)

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    if (orgSessions.length === 0) {
      return { ok: true, data: { questions: [], totalViolations: 0, flaggedSessionCount: 0 } }
    }

    // Get all answers with timing for these sessions
    const sessionIds = orgSessions.map(s => s.id)
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('session_id, card_template_id, answered_at, time_spent_seconds')
      .in('session_id', sessionIds)

    // Get question stems
    const allCardIds = new Set<string>()
    for (const s of orgSessions) {
      const order = s.question_order as string[] ?? []
      for (const cid of order) allCardIds.add(cid)
    }
    const { data: cards } = await supabase
      .from('card_templates')
      .select('id, front_text')
      .in('id', [...allCardIds])
    const stemMap = new Map<string, string>()
    for (const c of cards ?? []) {
      stemMap.set(c.id, c.front_text?.length > 60 ? c.front_text.slice(0, 57) + '...' : c.front_text ?? '')
    }

    // Build per-question answer windows per session
    const answersBySession = new Map<string, Array<{ cardId: string; answeredAt: Date; timeSpent: number }>>()
    for (const a of answers ?? []) {
      if (!a.answered_at) continue
      const arr = answersBySession.get(a.session_id) ?? []
      arr.push({
        cardId: a.card_template_id,
        answeredAt: new Date(a.answered_at),
        timeSpent: a.time_spent_seconds ?? 0,
      })
      answersBySession.set(a.session_id, arr)
    }

    // Count violations per question index across all sessions
    const questionOrder = orgSessions[0]?.question_order as string[] ?? []
    const violationCounts = new Array(questionOrder.length).fill(0) as number[]
    let totalViolations = 0

    for (const session of orgSessions) {
      const log = Array.isArray(session.tab_switch_log)
        ? (session.tab_switch_log as Array<{ timestamp: string; type: string }>)
        : []
      const sessionAnswers = answersBySession.get(session.id) ?? []

      // Sort answers by answeredAt
      sessionAnswers.sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime())

      // For each tab_hidden event, find which question was active
      for (const entry of log) {
        if (entry.type !== 'tab_hidden') continue
        totalViolations++
        const ts = new Date(entry.timestamp).getTime()

        // Find the question whose answer window contains this timestamp
        // Answer window: [answeredAt - timeSpent, answeredAt]
        let matched = false
        for (const ans of sessionAnswers) {
          const windowStart = ans.answeredAt.getTime() - (ans.timeSpent * 1000)
          const windowEnd = ans.answeredAt.getTime()
          if (ts >= windowStart && ts <= windowEnd) {
            const order = session.question_order as string[] ?? []
            const qIdx = order.indexOf(ans.cardId)
            if (qIdx >= 0 && qIdx < violationCounts.length) {
              violationCounts[qIdx]++
            }
            matched = true
            break
          }
        }
        // If no match, attribute to the last unanswered question
        if (!matched && sessionAnswers.length > 0) {
          const lastAnswered = sessionAnswers[sessionAnswers.length - 1]
          const order = session.question_order as string[] ?? []
          const lastIdx = order.indexOf(lastAnswered.cardId)
          const nextIdx = lastIdx + 1
          if (nextIdx < violationCounts.length) {
            violationCounts[nextIdx]++
          }
        }
      }
    }

    const questions = questionOrder.map((cardId, idx) => ({
      index: idx + 1,
      stem: stemMap.get(cardId) ?? `Question ${idx + 1}`,
      violationCount: violationCounts[idx],
    }))

    return {
      ok: true,
      data: {
        questions,
        totalViolations,
        flaggedSessionCount: orgSessions.length,
      },
    }
  }, undefined, RATE_LIMITS.standard)
}
