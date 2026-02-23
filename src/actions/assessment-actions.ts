'use server'

/**
 * V13: Assessment Server Actions
 * CRUD for assessments, session management, scoring.
 */

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createAssessmentSchema, updateAssessmentSchema, submitAnswerSchema } from '@/lib/validations'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { AssessmentTemplate, AssessmentTemplateConfig } from '@/types/database'
import { notifyOrgCandidates } from '@/actions/notification-actions'
import { logAuditEvent } from '@/actions/audit-actions'
import { generateCertificate } from '@/actions/certificate-actions'
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
    accessCode?: string
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
      .eq('org_id', org.id)
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
        access_code: input.accessCode || null,
        status: 'draft',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    logAuditEvent(supabase, org.id, user.id, 'assessment.created', {
      targetType: 'assessment', targetId: assessment.id, metadata: { title: input.title },
    })

    revalidatePath('/assessments')
    return { ok: true, data: assessment as Assessment }
  }, undefined, RATE_LIMITS.standard)
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
      .limit(500)

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
  return withOrgUser(async ({ user, supabase, org, role }) => {
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

    logAuditEvent(supabase, org.id, user.id, 'assessment.published', {
      targetType: 'assessment', targetId: assessmentId, metadata: { title: assessment.title },
    })

    // Notify org members about the new assessment
    notifyOrgCandidates(
      'New Assessment Available',
      `"${assessment.title}" is now available to take.`,
      `/assessments`
    ).catch(() => { /* fire-and-forget */ })

    revalidatePath('/assessments')
    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Archive an assessment (published → archived).
 * Creator+ only.
 */
export async function archiveAssessment(
  assessmentId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
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

    logAuditEvent(supabase, org.id, user.id, 'assessment.archived', {
      targetType: 'assessment', targetId: assessmentId,
    })

    revalidatePath('/assessments')
    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Revert a published assessment back to draft.
 * Only allowed if there are no in-progress sessions.
 * Creator+ only.
 */
export async function unpublishAssessment(
  assessmentId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Check for active in-progress sessions
    const { data: activeSessions } = await supabase
      .from('assessment_sessions')
      .select('id')
      .eq('assessment_id', assessmentId)
      .eq('status', 'in_progress')
      .limit(1)

    if (activeSessions && activeSessions.length > 0) {
      return { ok: false, error: 'Cannot revert — there are active sessions in progress' }
    }

    const { error } = await supabase
      .from('assessments')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .eq('status', 'published')

    if (error) return { ok: false, error: error.message }

    logAuditEvent(supabase, org.id, user.id, 'assessment.unpublished', {
      targetType: 'assessment', targetId: assessmentId,
    })

    revalidatePath('/assessments')
    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Batch publish multiple draft assessments.
 * Creator+ only.
 */
export async function batchPublishAssessments(
  assessmentIds: string[]
): Promise<ActionResultV2<{ published: number }>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data, error } = await supabase
      .from('assessments')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .in('id', assessmentIds)
      .eq('org_id', org.id)
      .eq('status', 'draft')
      .select('id')

    if (error) return { ok: false, error: error.message }

    revalidatePath('/assessments')
    return { ok: true, data: { published: data?.length ?? 0 } }
  }, undefined, RATE_LIMITS.bulk)
}

/**
 * Batch archive multiple published assessments.
 * Creator+ only.
 */
export async function batchArchiveAssessments(
  assessmentIds: string[]
): Promise<ActionResultV2<{ archived: number }>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data, error } = await supabase
      .from('assessments')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .in('id', assessmentIds)
      .eq('org_id', org.id)
      .eq('status', 'published')
      .select('id')

    if (error) return { ok: false, error: error.message }

    revalidatePath('/assessments')
    return { ok: true, data: { archived: data?.length ?? 0 } }
  }, undefined, RATE_LIMITS.bulk)
}

/**
 * Batch delete multiple assessments (draft or archived only).
 * Creator+ only.
 */
export async function batchDeleteAssessments(
  assessmentIds: string[]
): Promise<ActionResultV2<{ deleted: number }>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Only allow deleting draft/archived assessments (not published with active sessions)
    const { data, error } = await supabase
      .from('assessments')
      .delete()
      .in('id', assessmentIds)
      .eq('org_id', org.id)
      .in('status', ['draft', 'archived'])
      .select('id')

    if (error) return { ok: false, error: error.message }

    const deleted = data?.length ?? 0
    if (deleted > 0) {
      logAuditEvent(supabase, org.id, user.id, 'assessment.deleted', {
        metadata: { count: deleted, ids: data?.map((d) => d.id) },
      })
    }

    revalidatePath('/assessments')
    return { ok: true, data: { deleted } }
  }, undefined, RATE_LIMITS.bulk)
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
    accessCode?: string | null
  }
): Promise<ActionResultV2<Assessment>> {
  // Validate inputs
  const validation = updateAssessmentSchema.safeParse({ assessmentId, ...input })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0]?.message || 'Invalid input' }
  }

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
    if (input.accessCode !== undefined) updates.access_code = input.accessCode || null

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
  }, undefined, RATE_LIMITS.standard)
}

// ============================================
// Session Management
// ============================================

/**
 * Start an assessment session.
 * Selects questions, creates session and empty answer rows.
 */
export async function startAssessmentSession(
  assessmentId: string,
  accessCode?: string
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

    // Validate access code if set (constant-time comparison to prevent timing attacks)
    if (assessment.access_code) {
      if (!accessCode) {
        return { ok: false, error: 'Invalid access code' }
      }
      const expected = Buffer.from(assessment.access_code, 'utf8')
      const provided = Buffer.from(accessCode, 'utf8')
      if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return { ok: false, error: 'Invalid access code' }
      }
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

    // Capture client IP from headers
    const hdrs = await headers()
    const clientIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? hdrs.get('x-real-ip') ?? null

    // Create session
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .insert({
        assessment_id: assessmentId,
        user_id: user.id,
        question_order: questionIds,
        time_remaining_seconds: assessment.time_limit_minutes * 60,
        status: 'in_progress',
        ip_address: clientIp,
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
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Submit an answer for a question in an active session.
 */
export async function submitAnswer(
  sessionId: string,
  cardTemplateId: string,
  selectedIndex: number,
  timeRemainingSeconds?: number,
  timeSpentSeconds?: number
): Promise<ActionResultV2<{ isCorrect: boolean }>> {
  return withOrgUser(async ({ user, supabase }) => {
    const validation = submitAnswerSchema.safeParse({ sessionId, cardTemplateId, selectedIndex })
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Validation failed' }
    }

    // Verify session is active and belongs to user
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, status, question_order')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found or already completed' }
    }

    // Verify the card belongs to this session's question set
    const questionOrder = session.question_order as string[]
    if (!questionOrder.includes(cardTemplateId)) {
      return { ok: false, error: 'Question not part of this session' }
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
        ...(timeSpentSeconds !== undefined && { time_spent_seconds: Math.round(timeSpentSeconds) }),
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
  }, undefined, RATE_LIMITS.standard)
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

    // Auto-generate certificate if passed
    if (passed) {
      generateCertificate(sessionId).catch((err) => {
        console.warn('[completeSession] Certificate generation failed:', err)
      })
    }

    // V19: Update skill scores if skills_mapping is enabled
    // Uses service role client to bypass RLS (system-level score calculation)
    try {
      const { data: assessment } = await supabase
        .from('assessments')
        .select('deck_template_id, org_id')
        .eq('id', session.assessment_id)
        .single()

      if (assessment) {
        const { data: skillMappings } = await supabase
          .from('deck_skill_mappings')
          .select('skill_domain_id')
          .eq('deck_template_id', assessment.deck_template_id)

        if (skillMappings && skillMappings.length > 0) {
          const serviceClient = await createSupabaseServiceClient()

          for (const mapping of skillMappings) {
            const { data: existing } = await serviceClient
              .from('employee_skill_scores')
              .select('score, assessments_taken')
              .eq('org_id', assessment.org_id)
              .eq('user_id', user.id)
              .eq('skill_domain_id', mapping.skill_domain_id)
              .single()

            const oldScore = existing?.score ?? 0
            const oldCount = existing?.assessments_taken ?? 0
            const newScore = (oldScore * oldCount + score) / (oldCount + 1)

            await serviceClient.from('employee_skill_scores').upsert({
              org_id: assessment.org_id,
              user_id: user.id,
              skill_domain_id: mapping.skill_domain_id,
              score: Math.round(newScore * 10) / 10,
              assessments_taken: oldCount + 1,
              last_assessed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'org_id,user_id,skill_domain_id',
            })
          }
        }
      }
    } catch (skillError) {
      // Non-fatal: log but don't fail the session completion
      console.warn('[completeSession] V19: Skill score update failed:', skillError)
    }

    revalidatePath('/assessments')
    return { ok: true, data: { score, passed, total, correct } }
  }, undefined, RATE_LIMITS.standard)
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
  })
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
      .limit(200)

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
 * Get current user's past attempts for a specific assessment.
 * Returns sessions + assessment metadata for retake eligibility.
 */
export async function getMyAttemptsForAssessment(
  assessmentId: string
): Promise<ActionResultV2<{
  attempts: Array<{ id: string; score: number | null; passed: boolean | null; status: string; completed_at: string | null; created_at: string }>
  maxAttempts: number | null
  cooldownMinutes: number | null
  canRetake: boolean
  cooldownEndsAt: string | null
}>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, max_attempts, cooldown_minutes, status')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!assessment) return { ok: false, error: 'Assessment not found' }

    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, score, passed, status, completed_at, created_at')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const attempts = (sessions ?? []).map((s) => ({
      id: s.id,
      score: s.score,
      passed: s.passed,
      status: s.status,
      completed_at: s.completed_at,
      created_at: s.created_at,
    }))

    const completedCount = attempts.filter((a) => a.status === 'completed' || a.status === 'timed_out').length
    const maxReached = assessment.max_attempts ? completedCount >= assessment.max_attempts : false

    let cooldownEndsAt: string | null = null
    let inCooldown = false
    if (assessment.cooldown_minutes && attempts.length > 0) {
      const last = attempts.find((a) => a.completed_at)
      if (last?.completed_at) {
        const end = new Date(last.completed_at)
        end.setMinutes(end.getMinutes() + assessment.cooldown_minutes)
        if (new Date() < end) {
          inCooldown = true
          cooldownEndsAt = end.toISOString()
        }
      }
    }

    const canRetake = assessment.status === 'published' && !maxReached && !inCooldown

    return {
      ok: true,
      data: {
        attempts,
        maxAttempts: assessment.max_attempts,
        cooldownMinutes: assessment.cooldown_minutes,
        canRetake,
        cooldownEndsAt,
      },
    }
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
    // Verify session belongs to the calling user
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found' }
    }

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
      .limit(1000)

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
  })
}

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
    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, tab_switch_count, tab_switch_log')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'in_progress')
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found' }
    }

    const newCount = ((session.tab_switch_count as number) ?? 0) + 1
    const log = Array.isArray(session.tab_switch_log) ? session.tab_switch_log : []
    log.push({ timestamp: new Date().toISOString(), type: 'tab_hidden' })

    await supabase
      .from('assessment_sessions')
      .update({ tab_switch_count: newCount, tab_switch_log: log })
      .eq('id', sessionId)

    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Get proctoring violations for a specific session.
 * Creator+ only.
 */
export async function getSessionViolations(
  sessionId: string
): Promise<ActionResultV2<{
  tabSwitchCount: number
  tabSwitchLog: Array<{ timestamp: string; type: string }>
  userEmail: string
  assessmentTitle: string
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(org_id, title)')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return { ok: false, error: 'Session not found' }
    }

    const assessmentData = session.assessments as unknown as { org_id: string; title: string }
    if (assessmentData.org_id !== org.id) {
      return { ok: false, error: 'Session not found' }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', session.user_id)
      .single()

    return {
      ok: true,
      data: {
        tabSwitchCount: session.tab_switch_count ?? 0,
        tabSwitchLog: Array.isArray(session.tab_switch_log) ? session.tab_switch_log : [],
        userEmail: profile?.email ?? `user-${session.user_id.slice(0, 8)}`,
        assessmentTitle: assessmentData.title,
      },
    }
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
  activeCandidatesThisWeek: number
  topPerformers: Array<{ email: string; avgScore: number; totalCompleted: number }>
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
        activeCandidatesThisWeek,
        topPerformers,
        recentSessions,
      },
    }
  })
}

/**
 * List org candidates with their assessment summary stats.
 * Creator+ only.
 */
export async function getOrgCandidateList(): Promise<ActionResultV2<
  Array<{
    userId: string
    email: string
    fullName: string | null
    totalCompleted: number
    avgScore: number
    lastActiveAt: string | null
  }>
>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get candidate members
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('org_id', org.id)
      .eq('role', 'candidate')

    if (!members || members.length === 0) {
      return { ok: true, data: [] }
    }

    const userIds = members.map((m) => m.user_id)

    // Profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds)
    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { email: p.email, fullName: p.full_name }])
    )

    // Get completed sessions for these users
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('user_id, score, completed_at, assessments!inner(org_id)')
      .eq('status', 'completed')
      .in('user_id', userIds)

    const orgSessions = (sessions ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Aggregate per user
    const userStats = new Map<string, { total: number; scoreSum: number; lastAt: string | null }>()
    for (const s of orgSessions) {
      const entry = userStats.get(s.user_id) ?? { total: 0, scoreSum: 0, lastAt: null }
      entry.total++
      entry.scoreSum += s.score ?? 0
      if (!entry.lastAt || (s.completed_at && s.completed_at > entry.lastAt)) {
        entry.lastAt = s.completed_at
      }
      userStats.set(s.user_id, entry)
    }

    const result = userIds.map((uid) => {
      const profile = profileMap.get(uid)
      const stats = userStats.get(uid)
      return {
        userId: uid,
        email: profile?.email ?? `user-${uid.slice(0, 8)}`,
        fullName: profile?.fullName ?? null,
        totalCompleted: stats?.total ?? 0,
        avgScore: stats && stats.total > 0 ? Math.round(stats.scoreSum / stats.total) : 0,
        lastActiveAt: stats?.lastAt ?? null,
      }
    })

    // Sort by most recently active first
    result.sort((a, b) => {
      if (!a.lastActiveAt && !b.lastActiveAt) return 0
      if (!a.lastActiveAt) return 1
      if (!b.lastActiveAt) return -1
      return b.lastActiveAt.localeCompare(a.lastActiveAt)
    })

    return { ok: true, data: result }
  })
}

/**
 * Export all org candidates with stats as CSV.
 * Creator+ only.
 */
export async function exportCandidatesCsv(): Promise<ActionResultV2<string>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const listResult = await getOrgCandidateList()
    if (!listResult.ok) {
      return { ok: false, error: listResult.error }
    }

    const candidates = listResult.data ?? []
    const header = 'Name,Email,Exams Completed,Average Score,Last Active'
    const rows = candidates.map((c) => {
      const name = c.fullName ? `"${c.fullName}"` : ''
      const email = `"${c.email}"`
      const lastActive = c.lastActiveAt ? new Date(c.lastActiveAt).toISOString() : ''
      return `${name},${email},${c.totalCompleted},${c.avgScore},${lastActive}`
    })

    const csv = [header, ...rows].join('\n')
    return { ok: true, data: csv }
  })
}

/**
 * Get a single candidate's assessment history across all org assessments.
 * Creator+ only.
 */
export async function getCandidateProgress(
  userId: string
): Promise<ActionResultV2<{
  candidate: { email: string; fullName: string | null }
  sessions: Array<{
    assessmentTitle: string
    score: number | null
    passed: boolean | null
    completedAt: string | null
    tabSwitchCount: number
    tabSwitchLog: Array<{ timestamp: string; type: string }>
    status: string
  }>
  summary: { totalCompleted: number; avgScore: number; passRate: number }
}>> {
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

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    // Get all sessions
    const { data: sessionsData } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(org_id, title)')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false, nullsFirst: false })

    const orgSessions = (sessionsData ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    const sessions = orgSessions.map((s) => ({
      assessmentTitle: (s.assessments as unknown as { title: string }).title,
      score: s.score,
      passed: s.passed,
      completedAt: s.completed_at,
      tabSwitchCount: s.tab_switch_count ?? 0,
      tabSwitchLog: Array.isArray(s.tab_switch_log) ? s.tab_switch_log as Array<{ timestamp: string; type: string }> : [],
      status: s.status,
    }))

    const completed = sessions.filter((s) => s.status === 'completed')
    const totalCompleted = completed.length
    const avgScore = totalCompleted > 0
      ? Math.round(completed.reduce((sum, s) => sum + (s.score ?? 0), 0) / totalCompleted)
      : 0
    const passRate = totalCompleted > 0
      ? Math.round((completed.filter((s) => s.passed).length / totalCompleted) * 100)
      : 0

    return {
      ok: true,
      data: {
        candidate: {
          email: profile?.email ?? `user-${userId.slice(0, 8)}`,
          fullName: profile?.full_name ?? null,
        },
        sessions,
        summary: { totalCompleted, avgScore, passRate },
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
      .in('status', ['completed', 'timed_out', 'in_progress'])
      .order('started_at', { ascending: false })

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
    const header = 'Candidate,Status,Score,Passed,Tab Switches,Started At,Completed At'
    const rows = orgSessions.map((s) => {
      const email = emailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`
      return [
        `"${email}"`,
        s.status,
        s.score ?? '',
        s.passed ? 'Yes' : s.passed === false ? 'No' : '',
        s.tab_switch_count ?? 0,
        s.started_at,
        s.completed_at ?? '',
      ].join(',')
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

/**
 * Auto-expire stale in-progress sessions that have exceeded their time limit.
 * Calculates final score from submitted answers and marks status as 'timed_out'.
 * Safe to call on any page load — only affects genuinely expired sessions.
 */
export async function expireStaleSessions(): Promise<ActionResultV2<{ expired: number }>> {
  return withOrgUser(async ({ supabase, org }) => {
    // Get all in-progress sessions for this org's assessments
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, started_at, user_id, assessments!inner(org_id, time_limit_minutes, pass_score)')
      .eq('status', 'in_progress')

    if (!sessions || sessions.length === 0) {
      return { ok: true, data: { expired: 0 } }
    }

    // Filter to this org and find genuinely expired ones
    const now = Date.now()
    const stale = sessions.filter((s) => {
      const a = s.assessments as unknown as { org_id: string; time_limit_minutes: number }
      if (a.org_id !== org.id) return false
      const startedMs = new Date(s.started_at).getTime()
      const expiresMs = startedMs + a.time_limit_minutes * 60 * 1000
      return now > expiresMs
    })

    if (stale.length === 0) {
      return { ok: true, data: { expired: 0 } }
    }

    // Process each stale session
    let expiredCount = 0
    for (const s of stale) {
      const a = s.assessments as unknown as { pass_score: number }

      // Get answers to calculate score
      const { data: answers } = await supabase
        .from('assessment_answers')
        .select('is_correct')
        .eq('session_id', s.id)

      const total = answers?.length ?? 0
      const correct = answers?.filter((ans) => ans.is_correct === true).length ?? 0
      const score = total > 0 ? Math.round((correct / total) * 100) : 0
      const passed = score >= a.pass_score

      const { error } = await supabase
        .from('assessment_sessions')
        .update({
          status: 'timed_out',
          completed_at: new Date().toISOString(),
          score,
          passed,
          time_remaining_seconds: 0,
        })
        .eq('id', s.id)

      if (!error) expiredCount++
    }

    if (expiredCount > 0) {
      revalidatePath('/assessments')
    }

    return { ok: true, data: { expired: expiredCount } }
  }, undefined, RATE_LIMITS.bulk)
}

/**
 * Get active in-progress sessions for an assessment.
 * Creator+ only. Used for live monitoring.
 */
export async function getActiveSessionsForAssessment(
  assessmentId: string
): Promise<ActionResultV2<Array<{
  sessionId: string
  userEmail: string
  startedAt: string
  timeRemainingSeconds: number | null
  questionsAnswered: number
  totalQuestions: number
  tabSwitchCount: number
}>>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id, user_id, started_at, time_remaining_seconds, tab_switch_count, question_order, assessments!inner(org_id, question_count, time_limit_minutes)')
      .eq('assessment_id', assessmentId)
      .eq('status', 'in_progress')

    if (!sessions || sessions.length === 0) {
      return { ok: true, data: [] }
    }

    // Filter to org
    const orgSessions = sessions.filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    if (orgSessions.length === 0) {
      return { ok: true, data: [] }
    }

    // Get user emails
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

    // Get answer counts per session
    const sessionIds = orgSessions.map((s) => s.id)
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('session_id, is_correct')
      .in('session_id', sessionIds)
      .not('selected_index', 'is', null)

    const answerCounts = new Map<string, number>()
    if (answers) {
      for (const a of answers) {
        answerCounts.set(a.session_id, (answerCounts.get(a.session_id) ?? 0) + 1)
      }
    }

    const now = Date.now()
    const result = orgSessions.map((s) => {
      const a = s.assessments as unknown as { question_count: number; time_limit_minutes: number }
      // Calculate estimated time remaining from server perspective
      const startedMs = new Date(s.started_at).getTime()
      const elapsedSeconds = Math.floor((now - startedMs) / 1000)
      const totalSeconds = a.time_limit_minutes * 60
      const estimatedRemaining = Math.max(0, totalSeconds - elapsedSeconds)

      return {
        sessionId: s.id,
        userEmail: emailMap.get(s.user_id) ?? `user-${s.user_id.slice(0, 8)}`,
        startedAt: s.started_at,
        timeRemainingSeconds: s.time_remaining_seconds ?? estimatedRemaining,
        questionsAnswered: answerCounts.get(s.id) ?? 0,
        totalQuestions: a.question_count,
        tabSwitchCount: s.tab_switch_count ?? 0,
      }
    })

    return { ok: true, data: result }
  })
}

// ============================================
// Candidate Management
// ============================================

/**
 * Reset all assessment attempts for a candidate in the org.
 * Deletes their sessions and answers. Creator+ only.
 */
export async function resetCandidateAttempts(
  userId: string
): Promise<ActionResultV2<{ deleted: number }>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
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

    // Get org assessment IDs
    const { data: orgAssessments } = await supabase
      .from('assessments')
      .select('id')
      .eq('org_id', org.id)

    if (!orgAssessments || orgAssessments.length === 0) {
      return { ok: true, data: { deleted: 0 } }
    }

    const assessmentIds = orgAssessments.map((a) => a.id)

    // Get sessions to delete
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('id')
      .eq('user_id', userId)
      .in('assessment_id', assessmentIds)

    if (!sessions || sessions.length === 0) {
      return { ok: true, data: { deleted: 0 } }
    }

    const sessionIds = sessions.map((s) => s.id)

    // Delete answers first (FK constraint)
    await supabase
      .from('assessment_answers')
      .delete()
      .in('session_id', sessionIds)

    // Delete sessions
    const { error } = await supabase
      .from('assessment_sessions')
      .delete()
      .in('id', sessionIds)

    if (error) {
      return { ok: false, error: error.message }
    }

    logAuditEvent(supabase, org.id, user.id, 'candidate.attempts_reset', {
      targetType: 'user', targetId: userId, metadata: { sessionsDeleted: sessions.length },
    })

    return { ok: true, data: { deleted: sessions.length } }
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Export a candidate's assessment profile data as JSON.
 * Returns all session results for the candidate in the org. Creator+ only.
 */
export async function exportCandidateProfile(
  userId: string
): Promise<ActionResultV2<{
  candidate: { email: string; fullName: string | null }
  exportedAt: string
  sessions: Array<{
    assessmentTitle: string
    status: string
    score: number | null
    passed: boolean | null
    completedAt: string | null
    startedAt: string
    tabSwitchCount: number
    answers: Array<{
      questionText: string
      selectedOption: string | null
      correctOption: string
      isCorrect: boolean
      timeSpentSeconds: number | null
    }>
  }>
}>> {
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

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single()

    // Get all sessions with assessment info
    const { data: sessionsData } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(org_id, title)')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })

    const orgSessions = (sessionsData ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    // Get all answers for these sessions
    const sessionIds = orgSessions.map((s) => s.id)
    const { data: allAnswers } = sessionIds.length > 0
      ? await supabase
          .from('assessment_answers')
          .select('*')
          .in('session_id', sessionIds)
      : { data: [] as never[] }

    const answersBySession = new Map<string, typeof allAnswers>()
    for (const answer of (allAnswers ?? [])) {
      const arr = answersBySession.get(answer.session_id) ?? []
      arr.push(answer)
      answersBySession.set(answer.session_id, arr)
    }

    const sessions = orgSessions.map((s) => {
      const answers = (answersBySession.get(s.id) ?? []).map((a: Record<string, unknown>) => ({
        questionText: (a.question_text as string) ?? '',
        selectedOption: (a.selected_option_id as string) ?? null,
        correctOption: (a.correct_option_id as string) ?? '',
        isCorrect: (a.is_correct as boolean) ?? false,
        timeSpentSeconds: (a.time_spent_seconds as number) ?? null,
      }))

      return {
        assessmentTitle: (s.assessments as unknown as { title: string }).title,
        status: s.status,
        score: s.score,
        passed: s.passed,
        completedAt: s.completed_at,
        startedAt: s.started_at,
        tabSwitchCount: s.tab_switch_count ?? 0,
        answers,
      }
    })

    return {
      ok: true,
      data: {
        candidate: {
          email: profile?.email ?? `user-${userId.slice(0, 8)}`,
          fullName: profile?.full_name ?? null,
        },
        exportedAt: new Date().toISOString(),
        sessions,
      },
    }
  })
}

/**
 * Import candidates from CSV data.
 * Expects rows with: email (required), name (optional), role (optional, defaults to 'candidate').
 * Creates profiles if needed, adds as org members. Creator+ only.
 */
export async function importCandidatesCsv(
  csvText: string
): Promise<ActionResultV2<{ imported: number; skipped: number; errors: string[] }>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const lines = csvText.trim().split('\n')
    if (lines.length < 2) {
      return { ok: false, error: 'CSV must have a header row and at least one data row' }
    }

    // Parse header
    const header = lines[0].toLowerCase().split(',').map((h) => h.trim())
    const emailIdx = header.indexOf('email')
    if (emailIdx === -1) {
      return { ok: false, error: 'CSV must have an "email" column' }
    }
    const nameIdx = header.indexOf('name')
    const roleIdx = header.indexOf('role')

    // Get existing members
    const { data: existingMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)

    // Get existing profiles by email
    const existingUserIds = new Set((existingMembers ?? []).map((m) => m.user_id))

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim())
      const email = cols[emailIdx]?.toLowerCase()

      if (!email || !email.includes('@')) {
        errors.push(`Row ${i + 1}: invalid email "${cols[emailIdx] ?? ''}"`)
        continue
      }

      const name = nameIdx >= 0 ? cols[nameIdx] || null : null
      const memberRole = roleIdx >= 0 && cols[roleIdx] ? cols[roleIdx].toLowerCase() : 'candidate'

      if (!['candidate', 'creator', 'admin'].includes(memberRole)) {
        errors.push(`Row ${i + 1}: invalid role "${memberRole}" — using candidate`)
      }
      const validRole = ['candidate', 'creator', 'admin'].includes(memberRole) ? memberRole : 'candidate'

      // Check if user with this email exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingProfile) {
        // User exists — check if already a member
        if (existingUserIds.has(existingProfile.id)) {
          skipped++
          continue
        }

        // Add as member
        const { error: memberError } = await supabase
          .from('organization_members')
          .insert({
            org_id: org.id,
            user_id: existingProfile.id,
            role: validRole,
          })

        if (memberError) {
          errors.push(`Row ${i + 1}: ${memberError.message}`)
        } else {
          imported++
          existingUserIds.add(existingProfile.id)
        }
      } else {
        // User doesn't exist — create an invitation instead
        const token = crypto.randomUUID()
        const expires = new Date()
        expires.setDate(expires.getDate() + 30)

        const { error: inviteError } = await supabase
          .from('invitations')
          .insert({
            org_id: org.id,
            email,
            role: validRole,
            invited_by: user.id,
            token,
            expires_at: expires.toISOString(),
          })

        if (inviteError) {
          // Might be duplicate invitation
          if (inviteError.message.includes('duplicate') || inviteError.message.includes('unique')) {
            skipped++
          } else {
            errors.push(`Row ${i + 1}: ${inviteError.message}`)
          }
        } else {
          imported++
        }
      }
    }

    if (imported > 0) {
      logAuditEvent(supabase, org.id, user.id, 'candidate.imported', {
        metadata: { imported, skipped, errorCount: errors.length },
      })
    }

    return { ok: true, data: { imported, skipped, errors } }
  }, undefined, RATE_LIMITS.bulk)
}

// ── Assessment Templates ───────────────────────────────────────────────────

/**
 * Save an assessment configuration as a reusable template.
 */
export async function saveAssessmentTemplate(
  input: { name: string; description?: string; config: AssessmentTemplateConfig }
): Promise<ActionResultV2<AssessmentTemplate>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Requires creator role' }
    }

    const { data, error } = await supabase
      .from('assessment_templates')
      .insert({
        org_id: org.id,
        name: input.name,
        description: input.description ?? null,
        config: input.config,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: data as AssessmentTemplate }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * List all assessment templates for the current org.
 */
export async function getAssessmentTemplates(): Promise<ActionResultV2<AssessmentTemplate[]>> {
  return withOrgUser(async ({ supabase, org }) => {
    const { data, error } = await supabase
      .from('assessment_templates')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: (data ?? []) as AssessmentTemplate[] }
  })
}

/**
 * Delete an assessment template.
 */
export async function deleteAssessmentTemplate(
  templateId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Requires creator role' }
    }

    const { error } = await supabase
      .from('assessment_templates')
      .delete()
      .eq('id', templateId)
      .eq('org_id', org.id)

    if (error) return { ok: false, error: error.message }
    return { ok: true, data: undefined }
  }, undefined, RATE_LIMITS.standard)
}

// ============================================
// Question Preview (Creator)
// ============================================

type PreviewQuestion = {
  id: string
  stem: string
  options: string[]
  correctIndex: number
}

/**
 * Fetches a sample of questions from an assessment's deck for creator preview.
 * Returns up to `limit` questions with correct answers visible.
 */
export async function getAssessmentPreviewQuestions(
  assessmentId: string,
  limit = 10,
): Promise<ActionResultV2<PreviewQuestion[]>> {
  return withOrgUser(async ({ supabase, org }) => {
    if (!hasMinimumRole('creator', 'creator')) {
      return { ok: false, error: 'Creator role required' }
    }

    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, deck_template_id')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!assessment) {
      return { ok: false, error: 'Assessment not found' }
    }

    const { data: cards, error } = await supabase
      .from('card_templates')
      .select('id, stem, options, correct_index')
      .eq('deck_template_id', assessment.deck_template_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return { ok: false, error: error.message }

    const questions: PreviewQuestion[] = (cards ?? []).map((c) => ({
      id: c.id,
      stem: c.stem,
      options: c.options ?? [],
      correctIndex: c.correct_index ?? 0,
    }))

    return { ok: true, data: questions }
  })
}
