'use server'

/**
 * Assessment results, scoring, percentiles, weak areas, question bank, and CSV export.
 */

import { withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { AssessmentSession, AssessmentAnswer } from '@/types/database'

/**
 * Get session results with answers.
 */
export async function getSessionResults(
  sessionId: string
): Promise<ActionResultV2<{
  session: AssessmentSession
  answers: (AssessmentAnswer & { stem: string; options: string[]; correct_index: number; explanation: string | null })[]
}>> {
  return withOrgUser(async ({ user, supabase }) => {
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (sError || !session) {
      return { ok: false, error: 'Session not found' }
    }

    // Get answers with card details
    const { data: answers, error: aError } = await supabase
      .from('assessment_answers')
      .select(`
        *,
        card_templates!inner(stem, options, correct_index, explanation)
      `)
      .eq('session_id', sessionId)

    if (aError) {
      return { ok: false, error: aError.message }
    }

    const enrichedAnswers = (answers ?? []).map((a) => {
      const card = a.card_templates as unknown as {
        stem: string; options: string[]; correct_index: number; explanation: string | null
      }
      return {
        id: a.id,
        session_id: a.session_id,
        card_template_id: a.card_template_id,
        selected_index: a.selected_index,
        is_correct: a.is_correct,
        answered_at: a.answered_at,
        time_spent_seconds: a.time_spent_seconds ?? null,
        stem: card.stem,
        options: card.options,
        correct_index: card.correct_index,
        explanation: card.explanation,
      }
    })

    return {
      ok: true,
      data: { session: session as AssessmentSession, answers: enrichedAnswers },
    }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get percentile ranking for a completed session.
 * Returns what percentage of other takers the candidate scored better than.
 */
export async function getSessionPercentile(
  sessionId: string
): Promise<ActionResultV2<{ percentile: number; rank: number; totalSessions: number }>> {
  return withOrgUser(async ({ supabase }) => {
    // Get the session's assessment_id and score
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, assessment_id, score')
      .eq('id', sessionId)
      .single()

    if (!session || session.score == null) {
      return { ok: false, error: 'Session not found or not scored' }
    }

    // Get all completed/timed_out sessions for this assessment
    const { data: allSessions } = await supabase
      .from('assessment_sessions')
      .select('id, score')
      .eq('assessment_id', session.assessment_id)
      .in('status', ['completed', 'timed_out'])
      .not('score', 'is', null)

    if (!allSessions || allSessions.length === 0) {
      return { ok: true, data: { percentile: 100, rank: 1, totalSessions: 1 } }
    }

    const scores = allSessions.map((s) => s.score as number).sort((a, b) => b - a)
    const rank = scores.findIndex((s) => s <= session.score!) + 1
    const belowCount = scores.filter((s) => s < session.score!).length
    const percentile = Math.round((belowCount / scores.length) * 100)

    return { ok: true, data: { percentile, rank, totalSessions: scores.length } }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get all sessions for an assessment (creator/admin view).
 */
export async function getAssessmentResults(
  assessmentId: string
): Promise<ActionResultV2<AssessmentSession[]>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data, error } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .order('completed_at', { ascending: false })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: (data ?? []) as AssessmentSession[] }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get detailed assessment results for creators.
 * Includes all sessions with user email for candidate identification.
 */
export async function getAssessmentResultsDetailed(
  assessmentId: string
): Promise<ActionResultV2<{
  sessions: (AssessmentSession & { user_email: string; user_full_name: string | null; user_phone: string | null })[]
  stats: { avgScore: number; passRate: number; totalAttempts: number }
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get all sessions with user profile info
    const { data, error } = await supabase
      .from('assessment_sessions')
      .select(`
        *,
        assessments!inner(org_id)
      `)
      .eq('assessment_id', assessmentId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1000)

    if (error) {
      return { ok: false, error: error.message }
    }

    // Filter by org
    const orgSessions = (data ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Bulk-fetch user profiles (email, full_name, phone) from profiles table
    const userIds = [...new Set(orgSessions.map((s) => s.user_id))]
    const userProfileMap = new Map<string, { email: string; full_name: string | null; phone: string | null }>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) {
          userProfileMap.set(p.id, { email: p.email, full_name: p.full_name, phone: p.phone })
        }
      }
    }

    const sessions = orgSessions.map((s) => {
      const profile = userProfileMap.get(s.user_id)
      return {
        ...s,
        user_email: profile?.email ?? `user-${s.user_id.slice(0, 8)}`,
        user_full_name: profile?.full_name ?? null,
        user_phone: profile?.phone ?? null,
      }
    }) as (AssessmentSession & { user_email: string; user_full_name: string | null; user_phone: string | null })[]

    // Calculate stats from finished sessions (completed + timed_out)
    const finished = sessions.filter((s) => s.status === 'completed' || s.status === 'timed_out')
    const avgScore = finished.length > 0
      ? Math.round(finished.reduce((sum, s) => sum + (s.score ?? 0), 0) / finished.length)
      : 0
    const passRate = finished.length > 0
      ? Math.round((finished.filter((s) => s.passed).length / finished.length) * 100)
      : 0

    return {
      ok: true,
      data: {
        sessions,
        stats: { avgScore, passRate, totalAttempts: sessions.length },
      },
    }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Export assessment results as CSV string.
 */
export async function exportResultsCsv(
  assessmentId: string
): Promise<ActionResultV2<string>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select(`*, assessments!inner(org_id, title)`)
      .eq('assessment_id', assessmentId)
      .in('status', ['completed', 'timed_out', 'in_progress'])
      .order('started_at', { ascending: false })

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Fetch profiles (email, full_name, phone)
    const userIds = [...new Set(orgSessions.map((s) => s.user_id))]
    const profileMap = new Map<string, { email: string; full_name: string | null; phone: string | null }>()
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) profileMap.set(p.id, { email: p.email, full_name: p.full_name, phone: p.phone })
      }
    }

    // Build CSV with BOM for Excel compatibility
    const BOM = '\uFEFF'
    const header = 'Nama,Email,Telepon,Status,Score,Passed,Tab Switches,Started At,Completed At'
    const rows = orgSessions.map((s) => {
      const profile = profileMap.get(s.user_id)
      const name = (profile?.full_name ?? '').replace(/,/g, ' ')
      const email = profile?.email ?? `user-${s.user_id.slice(0, 8)}`
      const phone = profile?.phone ?? ''
      return [
        `"${name}"`,
        `"${email}"`,
        `"${phone}"`,
        s.status,
        s.score ?? '',
        s.passed ? 'Yes' : s.passed === false ? 'No' : '',
        s.tab_switch_count ?? 0,
        s.started_at,
        s.completed_at ?? '',
      ].join(',')
    })

    const csv = BOM + [header, ...rows].join('\n')
    return { ok: true, data: csv }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get topic-level weak area analysis for a completed session.
 * Connects assessment answers to card_template_tags to show
 * per-topic correct/total breakdown.
 */
export async function getSessionWeakAreas(
  sessionId: string
): Promise<ActionResultV2<{
  topics: Array<{
    tagId: string
    tagName: string
    tagColor: string
    correct: number
    total: number
    percent: number
  }>
}>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Get answers for this session
    const { data: answers, error: aError } = await supabase
      .from('assessment_answers')
      .select('card_template_id, is_correct')
      .eq('session_id', sessionId)

    if (aError || !answers || answers.length === 0) {
      return { ok: true, data: { topics: [] } }
    }

    const cardIds = answers.map((a) => a.card_template_id)

    // Get tags for these cards (topic category only)
    const { data: cardTags } = await supabase
      .from('card_template_tags')
      .select('card_template_id, tag_id')
      .in('card_template_id', cardIds)

    if (!cardTags || cardTags.length === 0) {
      return { ok: true, data: { topics: [] } }
    }

    const tagIds = [...new Set(cardTags.map((ct) => ct.tag_id))]

    // Fetch tag details (topic tags only)
    const { data: tags } = await supabase
      .from('tags')
      .select('id, name, color, category')
      .in('id', tagIds)
      .eq('category', 'topic')

    if (!tags || tags.length === 0) {
      return { ok: true, data: { topics: [] } }
    }

    const tagMap = new Map(tags.map((t) => [t.id, t]))

    // Build answer map: card_template_id -> is_correct
    const answerMap = new Map(answers.map((a) => [a.card_template_id, a.is_correct === true]))

    // Aggregate per topic tag
    const topicStats = new Map<string, { correct: number; total: number }>()
    for (const ct of cardTags) {
      const tag = tagMap.get(ct.tag_id)
      if (!tag) continue

      const entry = topicStats.get(tag.id) ?? { correct: 0, total: 0 }
      entry.total++
      if (answerMap.get(ct.card_template_id)) entry.correct++
      topicStats.set(tag.id, entry)
    }

    // Build result sorted by weakest first
    const topics = [...topicStats.entries()]
      .map(([tagId, stats]) => {
        const tag = tagMap.get(tagId)!
        return {
          tagId,
          tagName: tag.name,
          tagColor: tag.color,
          correct: stats.correct,
          total: stats.total,
          percent: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        }
      })
      .sort((a, b) => a.percent - b.percent)

    return { ok: true, data: { topics } }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get all questions across org decks with difficulty stats.
 * Creator+ only. Used for the question bank view.
 */
export async function getOrgQuestionBank(
  deckTemplateId?: string
): Promise<ActionResultV2<{
  questions: Array<{
    cardTemplateId: string
    stem: string
    deckTitle: string
    deckTemplateId: string
    totalAttempts: number
    correctCount: number
    percentCorrect: number
  }>
  decks: Array<{ id: string; title: string }>
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get org deck templates
    const { data: decks } = await supabase
      .from('deck_templates')
      .select('id, title')
      .eq('org_id', org.id)
      .order('title')

    if (!decks || decks.length === 0) {
      return { ok: true, data: { questions: [], decks: [] } }
    }

    // Filter to specific deck if requested
    const targetDeckIds = deckTemplateId
      ? decks.filter((d) => d.id === deckTemplateId).map((d) => d.id)
      : decks.map((d) => d.id)

    if (targetDeckIds.length === 0) {
      return { ok: true, data: { questions: [], decks } }
    }

    // Get questions from these decks
    const { data: cards } = await supabase
      .from('card_templates')
      .select('id, stem, deck_template_id')
      .in('deck_template_id', targetDeckIds)
      .order('created_at', { ascending: false })
      .limit(500)

    if (!cards || cards.length === 0) {
      return { ok: true, data: { questions: [], decks } }
    }

    const deckMap = new Map(decks.map((d) => [d.id, d.title]))

    // Get assessment answers for these cards to calculate difficulty
    const cardIds = cards.map((c) => c.id)
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('card_template_id, is_correct')
      .in('card_template_id', cardIds)
      .not('is_correct', 'is', null)

    const statsMap = new Map<string, { total: number; correct: number }>()
    if (answers) {
      for (const a of answers) {
        const entry = statsMap.get(a.card_template_id) ?? { total: 0, correct: 0 }
        entry.total++
        if (a.is_correct) entry.correct++
        statsMap.set(a.card_template_id, entry)
      }
    }

    const questions = cards.map((c) => {
      const stats = statsMap.get(c.id) ?? { total: 0, correct: 0 }
      return {
        cardTemplateId: c.id,
        stem: c.stem,
        deckTitle: deckMap.get(c.deck_template_id) ?? 'Unknown',
        deckTemplateId: c.deck_template_id,
        totalAttempts: stats.total,
        correctCount: stats.correct,
        percentCorrect: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : -1,
      }
    })

    return { ok: true, data: { questions, decks } }
  }, undefined, RATE_LIMITS.standard)
}
