'use server'

/**
 * Assessment session lifecycle: start, submit answers, complete, expire, monitor.
 */

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { submitAnswerSchema } from '@/lib/validations'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { Assessment, AssessmentSession, AssessmentAnswer } from '@/types/database'
import { generateCertificate } from '@/actions/certificate-actions'
import {
  dispatchResultEmail,
  dispatchCertificateEmail,
  buildUnsubscribeUrl,
  buildFullUrl,
} from '@/lib/email-dispatch'

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
      for (let i = questionIds.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1)
        ;[questionIds[i], questionIds[j]] = [questionIds[j]!, questionIds[i]!]
      }
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
  return withOrgUser(async ({ user, supabase, org }) => {
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

    // Email dispatch for pass/fail result (certificate generated inline for passed)
    try {
      const serviceClient = await createSupabaseServiceClient()
      const [{ data: profile }, { data: assessmentInfo }] = await Promise.all([
        serviceClient
          .from('profiles')
          .select('email, full_name, email_notifications')
          .eq('id', user.id)
          .single(),
        supabase
          .from('assessments')
          .select('title')
          .eq('id', session.assessment_id)
          .single(),
      ])

      if (profile && profile.email_notifications !== false && assessmentInfo) {
        const orgName = org.name
        const candidateName = profile.full_name ?? profile.email
        const unsubUrl = buildUnsubscribeUrl(user.id)

        if (passed) {
          // For passed candidates: await certificate generation, then send email
          try {
            await generateCertificate(sessionId)
          } catch {
            // Non-fatal: certificate generation may fail
          }

          // Re-fetch session to get certificate_url
          const { data: updatedSession } = await serviceClient
            .from('assessment_sessions')
            .select('certificate_url')
            .eq('id', sessionId)
            .single()

          const certUrl = updatedSession?.certificate_url
          if (certUrl) {
            dispatchCertificateEmail({
              to: profile.email,
              subject: `Sertifikat: ${assessmentInfo.title}`,
              orgName,
              candidateName,
              assessmentTitle: assessmentInfo.title,
              score,
              certificateUrl: buildFullUrl(certUrl),
              unsubscribeUrl: unsubUrl,
            }).catch((err) => logger.warn('completeSession.certificateEmail', String(err)))
          } else {
            // Fallback: send result notification if certificate not ready
            dispatchResultEmail({
              to: profile.email,
              subject: `Hasil Asesmen: ${assessmentInfo.title} — LULUS`,
              orgName,
              candidateName,
              assessmentTitle: assessmentInfo.title,
              score,
              passed: true,
              actionUrl: buildFullUrl(`/assessments/${session.assessment_id}/results/${sessionId}`),
              unsubscribeUrl: unsubUrl,
            }).catch((err) => logger.warn('completeSession.resultEmail', String(err)))
          }
        } else {
          // For failed candidates, send ResultNotification with retake link
          dispatchResultEmail({
            to: profile.email,
            subject: `Hasil Asesmen: ${assessmentInfo.title} — TIDAK LULUS`,
            orgName,
            candidateName,
            assessmentTitle: assessmentInfo.title,
            score,
            passed: false,
            actionUrl: buildFullUrl(`/assessments/${session.assessment_id}/take`),
            unsubscribeUrl: unsubUrl,
          }).catch((err) => logger.warn('completeSession.resultNotification', String(err)))
        }
      }
    } catch (emailError) {
      logger.warn('completeSession.emailDispatch', String(emailError))
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

          // Batch-fetch all existing skill scores for this user+org in one query
          const skillDomainIds = skillMappings.map((m) => m.skill_domain_id)
          const { data: existingScores } = await serviceClient
            .from('employee_skill_scores')
            .select('skill_domain_id, score, assessments_taken')
            .eq('org_id', assessment.org_id)
            .eq('user_id', user.id)
            .in('skill_domain_id', skillDomainIds)

          const existingScoreMap = new Map(
            (existingScores ?? []).map((s) => [s.skill_domain_id, { score: s.score, assessments_taken: s.assessments_taken }])
          )

          const upsertRows = skillMappings.map((mapping) => {
            const existing = existingScoreMap.get(mapping.skill_domain_id)
            const oldScore = existing?.score ?? 0
            const oldCount = existing?.assessments_taken ?? 0
            const newScore = (oldScore * oldCount + score) / (oldCount + 1)

            return {
              org_id: assessment.org_id,
              user_id: user.id,
              skill_domain_id: mapping.skill_domain_id,
              score: Math.round(newScore * 10) / 10,
              assessments_taken: oldCount + 1,
              last_assessed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          })

          await serviceClient.from('employee_skill_scores').upsert(upsertRows, {
            onConflict: 'org_id,user_id,skill_domain_id',
          })
        }
      }
    } catch (skillError) {
      // Non-fatal: log but don't fail the session completion
      logger.warn('completeSession.skillScore', String(skillError))
    }

    revalidatePath('/assessments')
    return { ok: true, data: { score, passed, total, correct } }
  }, undefined, RATE_LIMITS.standard)
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
      .eq('assessments.org_id', org.id)
      .limit(1000)

    if (!sessions || sessions.length === 0) {
      return { ok: true, data: { expired: 0 } }
    }

    // Find genuinely expired ones (org already filtered at query level)
    const now = Date.now()
    const stale = sessions.filter((s) => {
      const a = s.assessments as unknown as { org_id: string; time_limit_minutes: number }
      const startedMs = new Date(s.started_at).getTime()
      const expiresMs = startedMs + a.time_limit_minutes * 60 * 1000
      return now > expiresMs
    })

    if (stale.length === 0) {
      return { ok: true, data: { expired: 0 } }
    }

    // Batch-fetch all answers for stale sessions in a single query
    const staleSessionIds = stale.map((s) => s.id)
    const { data: allAnswers } = await supabase
      .from('assessment_answers')
      .select('session_id, is_correct')
      .in('session_id', staleSessionIds)

    // Group answers by session_id
    const answersBySession = new Map<string, Array<{ is_correct: boolean | null }>>()
    for (const a of allAnswers ?? []) {
      const arr = answersBySession.get(a.session_id) ?? []
      arr.push({ is_correct: a.is_correct })
      answersBySession.set(a.session_id, arr)
    }

    // Parallelize session updates
    const nowIso = new Date().toISOString()
    const updateResults = await Promise.all(
      stale.map(async (s) => {
        const a = s.assessments as unknown as { pass_score: number }
        const answers = answersBySession.get(s.id) ?? []

        const total = answers.length
        const correct = answers.filter((ans) => ans.is_correct === true).length
        const score = total > 0 ? Math.round((correct / total) * 100) : 0
        const passed = score >= a.pass_score

        const { error } = await supabase
          .from('assessment_sessions')
          .update({
            status: 'timed_out',
            completed_at: nowIso,
            score,
            passed,
            time_remaining_seconds: 0,
          })
          .eq('id', s.id)

        return !error
      })
    )
    const expiredCount = updateResults.filter(Boolean).length

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
