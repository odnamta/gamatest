'use server'

/**
 * V13: Assessment Server Actions
 * CRUD for assessments, session management, scoring.
 */

import { revalidatePath } from 'next/cache'
import { withOrgUser } from '@/actions/_helpers'
import { createAssessmentSchema, submitAnswerSchema } from '@/lib/validations'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'
import { notifyOrgCandidates } from '@/actions/notification-actions'
import type {
  Assessment,
  AssessmentSession,
  AssessmentAnswer,
  AssessmentWithDeck,
  SessionWithAssessment,
} from '@/types/database'

// ============================================
// Assessment CRUD
// ============================================

/**
 * Create a new assessment from a deck.
 * Requires creator+ role.
 */
export async function createAssessment(
  input: {
    deckTemplateId: string
    title: string
    description?: string
    timeLimitMinutes: number
    passScore: number
    questionCount: number
    shuffleQuestions?: boolean
    shuffleOptions?: boolean
    showResults?: boolean
    maxAttempts?: number
    cooldownMinutes?: number
    allowReview?: boolean
    startDate?: string
    endDate?: string
  }
): Promise<ActionResultV2<Assessment>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Only creators and above can create assessments' }
    }

    const validation = createAssessmentSchema.safeParse(input)
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Validation failed' }
    }

    // Verify deck belongs to org
    const { data: deck } = await supabase
      .from('deck_templates')
      .select('id, org_id')
      .eq('id', input.deckTemplateId)
      .single()

    if (!deck) {
      return { ok: false, error: 'Deck not found' }
    }

    // Count available questions
    const { count: cardCount } = await supabase
      .from('card_templates')
      .select('*', { count: 'exact', head: true })
      .eq('deck_template_id', input.deckTemplateId)

    if (!cardCount || cardCount < input.questionCount) {
      return {
        ok: false,
        error: `Deck only has ${cardCount ?? 0} questions. Reduce question count or add more questions.`,
      }
    }

    const { data: assessment, error } = await supabase
      .from('assessments')
      .insert({
        org_id: org.id,
        deck_template_id: input.deckTemplateId,
        title: input.title,
        description: input.description ?? null,
        time_limit_minutes: input.timeLimitMinutes,
        pass_score: input.passScore,
        question_count: input.questionCount,
        shuffle_questions: input.shuffleQuestions ?? true,
        shuffle_options: input.shuffleOptions ?? false,
        show_results: input.showResults ?? true,
        max_attempts: input.maxAttempts ?? null,
        cooldown_minutes: input.cooldownMinutes ?? null,
        allow_review: input.allowReview ?? true,
        start_date: input.startDate ?? null,
        end_date: input.endDate ?? null,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/assessments')
    return { ok: true, data: assessment as Assessment }
  })
}

/**
 * Get all assessments for the current org.
 * Candidates see only published. Creators see all.
 */
export async function getOrgAssessments(): Promise<ActionResultV2<AssessmentWithDeck[]>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    let query = supabase
      .from('assessments')
      .select(`
        *,
        deck_templates!inner(title)
      `)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })

    // Candidates only see published assessments
    if (!hasMinimumRole(role, 'creator')) {
      query = query.eq('status', 'published')
    }

    const { data, error } = await query

    if (error) {
      return { ok: false, error: error.message }
    }

    // Get session counts
    const assessmentIds = (data ?? []).map((a) => a.id)
    const { data: sessionCounts } = assessmentIds.length > 0
      ? await supabase
          .from('assessment_sessions')
          .select('assessment_id')
          .in('assessment_id', assessmentIds)
      : { data: [] }

    const countMap = new Map<string, number>()
    for (const s of sessionCounts ?? []) {
      countMap.set(s.assessment_id, (countMap.get(s.assessment_id) ?? 0) + 1)
    }

    const assessments: AssessmentWithDeck[] = (data ?? []).map((a) => ({
      ...a,
      deck_title: (a.deck_templates as unknown as { title: string }).title,
      session_count: countMap.get(a.id) ?? 0,
    }))

    return { ok: true, data: assessments }
  })
}

/**
 * Get a single assessment by ID.
 */
export async function getAssessment(
  assessmentId: string
): Promise<ActionResultV2<Assessment>> {
  return withOrgUser(async ({ supabase, org }) => {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (error || !data) {
      return { ok: false, error: 'Assessment not found' }
    }

    return { ok: true, data: data as Assessment }
  })
}

/**
 * Publish an assessment (draft → published).
 * Creator+ only.
 */
export async function publishAssessment(
  assessmentId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get assessment title before updating
    const { data: assessment } = await supabase
      .from('assessments')
      .select('title')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .eq('status', 'draft')
      .single()

    if (!assessment) {
      return { ok: false, error: 'Assessment not found or not in draft' }
    }

    const { error } = await supabase
      .from('assessments')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .eq('status', 'draft')

    if (error) {
      return { ok: false, error: error.message }
    }

    // Notify org members about the new assessment
    notifyOrgCandidates(
      'New Assessment Available',
      `"${assessment.title}" is now available to take.`,
      `/assessments`
    ).catch(() => { /* fire-and-forget */ })

    revalidatePath('/assessments')
    return { ok: true }
  })
}

/**
 * Archive an assessment (published → archived).
 * Creator+ only.
 */
export async function archiveAssessment(
  assessmentId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { error } = await supabase
      .from('assessments')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .eq('status', 'published')

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/assessments')
    return { ok: true }
  })
}

/**
 * Duplicate an assessment as a new draft.
 */
export async function duplicateAssessment(
  assessmentId: string
): Promise<ActionResultV2<Assessment>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data: source } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!source) {
      return { ok: false, error: 'Assessment not found' }
    }

    const { data: clone, error } = await supabase
      .from('assessments')
      .insert({
        org_id: org.id,
        deck_template_id: source.deck_template_id,
        title: `${source.title} (Copy)`,
        description: source.description,
        time_limit_minutes: source.time_limit_minutes,
        pass_score: source.pass_score,
        question_count: source.question_count,
        shuffle_questions: source.shuffle_questions,
        shuffle_options: source.shuffle_options,
        show_results: source.show_results,
        max_attempts: source.max_attempts,
        cooldown_minutes: source.cooldown_minutes,
        allow_review: source.allow_review,
        start_date: null,
        end_date: null,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/assessments')
    return { ok: true, data: clone as Assessment }
  })
}

/**
 * Update assessment settings (draft only).
 * Creator+ only.
 */
export async function updateAssessment(
  assessmentId: string,
  input: {
    title?: string
    description?: string
    timeLimitMinutes?: number
    passScore?: number
    questionCount?: number
    shuffleQuestions?: boolean
    shuffleOptions?: boolean
    showResults?: boolean
    maxAttempts?: number | null
    cooldownMinutes?: number | null
    allowReview?: boolean
    startDate?: string | null
    endDate?: string | null
  }
): Promise<ActionResultV2<Assessment>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Build update object, mapping camelCase to snake_case
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.title !== undefined) updates.title = input.title
    if (input.description !== undefined) updates.description = input.description || null
    if (input.timeLimitMinutes !== undefined) updates.time_limit_minutes = input.timeLimitMinutes
    if (input.passScore !== undefined) updates.pass_score = input.passScore
    if (input.questionCount !== undefined) updates.question_count = input.questionCount
    if (input.shuffleQuestions !== undefined) updates.shuffle_questions = input.shuffleQuestions
    if (input.shuffleOptions !== undefined) updates.shuffle_options = input.shuffleOptions
    if (input.showResults !== undefined) updates.show_results = input.showResults
    if (input.maxAttempts !== undefined) updates.max_attempts = input.maxAttempts
    if (input.cooldownMinutes !== undefined) updates.cooldown_minutes = input.cooldownMinutes
    if (input.allowReview !== undefined) updates.allow_review = input.allowReview
    if (input.startDate !== undefined) updates.start_date = input.startDate
    if (input.endDate !== undefined) updates.end_date = input.endDate

    const { data, error } = await supabase
      .from('assessments')
      .update(updates)
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .eq('status', 'draft')
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/assessments')
    return { ok: true, data: data as Assessment }
  })
}

// ============================================
// Session Management
// ============================================

/**
 * Start an assessment session.
 * Selects questions, creates session and empty answer rows.
 */
export async function startAssessmentSession(
  assessmentId: string
): Promise<ActionResultV2<AssessmentSession>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    // Fetch assessment
    const { data: assessment, error: aError } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .eq('status', 'published')
      .single()

    if (aError || !assessment) {
      return { ok: false, error: 'Assessment not found or not published' }
    }

    // Check schedule window
    const now = new Date()
    if (assessment.start_date && new Date(assessment.start_date) > now) {
      return { ok: false, error: 'This assessment has not started yet' }
    }
    if (assessment.end_date && new Date(assessment.end_date) < now) {
      return { ok: false, error: 'This assessment has closed' }
    }

    // Check max attempts and cooldown
    if (assessment.max_attempts || assessment.cooldown_minutes) {
      const { data: pastSessions, count } = await supabase
        .from('assessment_sessions')
        .select('completed_at', { count: 'exact' })
        .eq('assessment_id', assessmentId)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false, nullsFirst: false })

      if (assessment.max_attempts && (count ?? 0) >= assessment.max_attempts) {
        return { ok: false, error: 'Maximum attempts reached' }
      }

      // Check cooldown period since last completed session
      if (assessment.cooldown_minutes && pastSessions && pastSessions.length > 0) {
        const lastCompleted = pastSessions.find((s) => s.completed_at)
        if (lastCompleted?.completed_at) {
          const cooldownEnd = new Date(lastCompleted.completed_at)
          cooldownEnd.setMinutes(cooldownEnd.getMinutes() + assessment.cooldown_minutes)
          if (now < cooldownEnd) {
            const minutesLeft = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 60000)
            return { ok: false, error: `Please wait ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''} before retaking` }
          }
        }
      }
    }

    // Check for existing in-progress session
    const { data: existingSession } = await supabase
      .from('assessment_sessions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (existingSession) {
      return { ok: true, data: existingSession as AssessmentSession }
    }

    // Select questions from deck
    const { data: cards, error: cError } = await supabase
      .from('card_templates')
      .select('id')
      .eq('deck_template_id', assessment.deck_template_id)

    if (cError || !cards || cards.length === 0) {
      return { ok: false, error: 'No questions available' }
    }

    // Shuffle and pick
    let questionIds = cards.map((c) => c.id)
    if (assessment.shuffle_questions) {
      questionIds = questionIds.sort(() => Math.random() - 0.5)
    }
    questionIds = questionIds.slice(0, assessment.question_count)

    // Create session
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .insert({
        assessment_id: assessmentId,
        user_id: user.id,
        question_order: questionIds,
        time_remaining_seconds: assessment.time_limit_minutes * 60,
        status: 'in_progress',
      })
      .select()
      .single()

    if (sError || !session) {
      return { ok: false, error: 'Failed to start session' }
    }

    // Create empty answer rows
    const answerRows = questionIds.map((cardId) => ({
      session_id: session.id,
      card_template_id: cardId,
    }))

    await supabase.from('assessment_answers').insert(answerRows)

    return { ok: true, data: session as AssessmentSession }
  })
}

/**
 * Submit an answer for a question in an active session.
 */
export async function submitAnswer(
  sessionId: string,
  cardTemplateId: string,
  selectedIndex: number,
  timeRemainingSeconds?: number
): Promise<ActionResultV2<{ isCorrect: boolean }>> {
  return withOrgUser(async ({ user, supabase }) => {
    const validation = submitAnswerSchema.safeParse({ sessionId, cardTemplateId, selectedIndex })
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Validation failed' }
    }

    // Verify session is active and belongs to user
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found or already completed' }
    }

    // Get the correct answer
    const { data: card } = await supabase
      .from('card_templates')
      .select('correct_index')
      .eq('id', cardTemplateId)
      .single()

    if (!card) {
      return { ok: false, error: 'Question not found' }
    }

    const isCorrect = selectedIndex === card.correct_index

    // Update the answer
    const { error } = await supabase
      .from('assessment_answers')
      .update({
        selected_index: selectedIndex,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      })
      .eq('session_id', sessionId)
      .eq('card_template_id', cardTemplateId)

    if (error) {
      return { ok: false, error: error.message }
    }

    // Persist timer snapshot for session resume
    if (timeRemainingSeconds !== undefined && timeRemainingSeconds >= 0) {
      await supabase
        .from('assessment_sessions')
        .update({ time_remaining_seconds: timeRemainingSeconds })
        .eq('id', sessionId)
    }

    return { ok: true, data: { isCorrect } }
  })
}

/**
 * Complete an assessment session. Calculates final score.
 */
export async function completeSession(
  sessionId: string
): Promise<ActionResultV2<{ score: number; passed: boolean; total: number; correct: number }>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Verify session
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(pass_score)')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found or already completed' }
    }

    // Get answers
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('is_correct')
      .eq('session_id', sessionId)

    const total = answers?.length ?? 0
    const correct = answers?.filter((a) => a.is_correct === true).length ?? 0
    const score = total > 0 ? Math.round((correct / total) * 100) : 0
    const passScore = (session.assessments as unknown as { pass_score: number }).pass_score
    const passed = score >= passScore

    // Update session
    const { error } = await supabase
      .from('assessment_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        score,
        passed,
      })
      .eq('id', sessionId)

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/assessments')
    return { ok: true, data: { score, passed, total, correct } }
  })
}

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
  })
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
  })
}

/**
 * Get user's sessions across all assessments in the org.
 */
export async function getMyAssessmentSessions(): Promise<ActionResultV2<SessionWithAssessment[]>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { data, error } = await supabase
      .from('assessment_sessions')
      .select(`
        *,
        assessments!inner(title, question_count, org_id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, error: error.message }
    }

    const sessions: SessionWithAssessment[] = (data ?? [])
      .filter((s) => {
        const a = s.assessments as unknown as { org_id: string }
        return a.org_id === org.id
      })
      .map((s) => {
        const a = s.assessments as unknown as { title: string; question_count: number }
        return {
          ...s,
          assessment_title: a.title,
          total_questions: a.question_count,
        }
      })

    return { ok: true, data: sessions }
  })
}

/**
 * Get questions for an active session (stems + options only, no correct answers).
 * Used by the take page to display questions during the exam.
 */
export async function getSessionQuestions(
  sessionId: string
): Promise<ActionResultV2<{ cardTemplateId: string; stem: string; options: string[] }[]>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Verify session belongs to user
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, question_order')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found' }
    }

    const questionOrder = session.question_order as string[]

    // Fetch card details
    const { data: cards, error } = await supabase
      .from('card_templates')
      .select('id, stem, options')
      .in('id', questionOrder)

    if (error) {
      return { ok: false, error: error.message }
    }

    // Return in question_order sequence
    const cardMap = new Map((cards ?? []).map((c) => [c.id, c]))
    const questions = questionOrder
      .map((id) => {
        const card = cardMap.get(id)
        if (!card) return null
        return {
          cardTemplateId: card.id,
          stem: card.stem,
          options: card.options as string[],
        }
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)

    return { ok: true, data: questions }
  })
}

/**
 * Get existing answers for an in-progress session.
 * Used to restore selection state when resuming a session.
 */
export async function getExistingAnswers(
  sessionId: string
): Promise<ActionResultV2<{ cardTemplateId: string; selectedIndex: number }[]>> {
  return withOrgUser(async ({ user, supabase }) => {
    const { data: answers, error } = await supabase
      .from('assessment_answers')
      .select('card_template_id, selected_index')
      .eq('session_id', sessionId)
      .not('selected_index', 'is', null)

    if (error) {
      return { ok: false, error: error.message }
    }

    const result = (answers ?? []).map((a) => ({
      cardTemplateId: a.card_template_id,
      selectedIndex: a.selected_index as number,
    }))

    return { ok: true, data: result }
  })
}

/**
 * Get detailed assessment results for creators.
 * Includes all sessions with user email for candidate identification.
 */
export async function getAssessmentResultsDetailed(
  assessmentId: string
): Promise<ActionResultV2<{
  sessions: (AssessmentSession & { user_email: string })[]
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

    if (error) {
      return { ok: false, error: error.message }
    }

    // Filter by org
    const orgSessions = (data ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Bulk-fetch user emails from profiles table
    const userIds = [...new Set(orgSessions.map((s) => s.user_id))]
    const userEmailMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) {
          userEmailMap.set(p.id, p.email)
        }
      }
    }

    const sessions = orgSessions.map((s) => ({
      ...s,
      user_email: userEmailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`,
    })) as (AssessmentSession & { user_email: string })[]

    // Calculate stats from completed sessions
    const completed = sessions.filter((s) => s.status === 'completed')
    const avgScore = completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.score ?? 0), 0) / completed.length)
      : 0
    const passRate = completed.length > 0
      ? Math.round((completed.filter((s) => s.passed).length / completed.length) * 100)
      : 0

    return {
      ok: true,
      data: {
        sessions,
        stats: { avgScore, passRate, totalAttempts: sessions.length },
      },
    }
  })
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

    // Get all completed session IDs for this assessment
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id')
      .eq('assessment_id', assessmentId)
      .eq('status', 'completed')

    if (!sessions || sessions.length === 0) {
      return { ok: true, data: { questions: [] } }
    }

    const sessionIds = sessions.map((s) => s.id)

    // Get all answers for these sessions
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('card_template_id, is_correct')
      .in('session_id', sessionIds)

    if (!answers) {
      return { ok: true, data: { questions: [] } }
    }

    // Aggregate per question
    const questionMap = new Map<string, { total: number; correct: number }>()
    for (const a of answers) {
      const entry = questionMap.get(a.card_template_id) ?? { total: 0, correct: 0 }
      entry.total++
      if (a.is_correct) entry.correct++
      questionMap.set(a.card_template_id, entry)
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
        }
      })
      .sort((a, b) => a.percentCorrect - b.percentCorrect)

    return { ok: true, data: { questions } }
  })
}

/**
 * Report a tab switch during an assessment session.
 * Increments the tab_switch_count on the session row.
 */
export async function reportTabSwitch(
  sessionId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Use RPC or raw update — increment tab_switch_count
    // Since Supabase doesn't support increment natively in the JS client,
    // we read-then-write (acceptable for low-frequency tab switches)
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, tab_switch_count')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found' }
    }

    const newCount = ((session.tab_switch_count as number) ?? 0) + 1

    await supabase
      .from('assessment_sessions')
      .update({ tab_switch_count: newCount })
      .eq('id', sessionId)

    return { ok: true }
  })
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
  recentSessions: Array<{
    assessmentTitle: string
    userEmail: string
    score: number | null
    passed: boolean | null
    completedAt: string | null
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
        id, score, passed, completed_at, user_id,
        assessments!inner(org_id, title)
      `)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(100)

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    const totalAttempts = orgSessions.length
    const avgPassRate = totalAttempts > 0
      ? Math.round((orgSessions.filter((s) => s.passed).length / totalAttempts) * 100)
      : 0

    // Recent 5 sessions with profile emails
    const recent = orgSessions.slice(0, 5)
    const userIds = [...new Set(recent.map((s) => s.user_id))]
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

    const recentSessions = recent.map((s) => ({
      assessmentTitle: (s.assessments as unknown as { title: string }).title,
      userEmail: emailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`,
      score: s.score,
      passed: s.passed,
      completedAt: s.completed_at,
    }))

    return {
      ok: true,
      data: {
        memberCount: memberCount ?? 0,
        assessmentCount: assessmentCount ?? 0,
        totalAttempts,
        avgPassRate,
        recentSessions,
      },
    }
  })
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
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Fetch emails
    const userIds = [...new Set(orgSessions.map((s) => s.user_id))]
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

    // Build CSV
    const header = 'Candidate,Score,Passed,Tab Switches,Completed At'
    const rows = orgSessions.map((s) => {
      const email = emailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`
      const score = s.score ?? 0
      const passed = s.passed ? 'Yes' : 'No'
      const tabSwitches = s.tab_switch_count ?? 0
      const completedAt = s.completed_at ? new Date(s.completed_at).toISOString() : ''
      // Escape email in case it contains commas
      return `"${email}",${score},${passed},${tabSwitches},${completedAt}`
    })

    const csv = [header, ...rows].join('\n')
    return { ok: true, data: csv }
  })
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
  })
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

    // Build answer map: card_template_id → is_correct
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
  })
}
