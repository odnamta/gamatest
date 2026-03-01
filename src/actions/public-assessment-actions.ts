'use server'

/**
 * V21: Public Assessment Server Actions
 * Handles the entire public test-taking flow for /t/[code] routes.
 * Uses service role client (bypasses RLS) since candidates are unauthenticated.
 */

import crypto from 'crypto'
import { headers } from 'next/headers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { publicRegistrationSchema } from '@/lib/validations'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { generateCertificate } from '@/actions/certificate-actions'
import type { ActionResultV2 } from '@/types/actions'
import type { Assessment } from '@/types/database'

// ============================================
// Session Token Helpers (HMAC-signed)
// ============================================

const SESSION_TOKEN_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-fallback-secret'

/** Create an HMAC-signed session token: base64url(sessionId:hmac) */
function createSessionToken(sessionId: string): string {
  const hmac = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(sessionId).digest('hex')
  return Buffer.from(`${sessionId}:${hmac}`).toString('base64url')
}

/** Verify and extract session ID from a signed token. Returns null if invalid. */
function verifySessionToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const colonIdx = decoded.indexOf(':')
    if (colonIdx === -1) return null
    const sessionId = decoded.slice(0, colonIdx)
    const providedHmac = decoded.slice(colonIdx + 1)
    const expectedHmac = crypto.createHmac('sha256', SESSION_TOKEN_SECRET).update(sessionId).digest('hex')
    if (providedHmac.length !== expectedHmac.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(providedHmac), Buffer.from(expectedHmac))) return null
    return sessionId
  } catch {
    return null
  }
}

// ============================================
// 1. getPublicAssessment
// ============================================

/**
 * Fetch a published assessment by its public_code.
 * Returns assessment metadata + org name. Validates schedule window.
 */
export async function getPublicAssessment(
  code: string
): Promise<ActionResultV2<{
  assessment: Assessment
  orgName: string
  orgSlug: string
}>> {
  try {
    const supabase = await createSupabaseServiceClient()

    const { data, error } = await supabase
      .from('assessments')
      .select(`
        id, title, description, time_limit_minutes, pass_score,
        question_count, shuffle_questions, shuffle_options,
        show_results, max_attempts, allow_review,
        start_date, end_date, access_code, public_code, status,
        deck_template_id, org_id, created_by, cooldown_minutes,
        created_at, updated_at,
        organizations!inner(id, name, slug)
      `)
      .eq('public_code', code.toUpperCase())
      .eq('status', 'published')
      .single()

    if (error || !data) {
      return { ok: false, error: 'Asesmen tidak ditemukan atau sudah ditutup' }
    }

    // Check schedule window
    const now = new Date()
    if (data.start_date && new Date(data.start_date) > now) {
      return { ok: false, error: 'Asesmen belum dibuka' }
    }
    if (data.end_date && new Date(data.end_date) < now) {
      return { ok: false, error: 'Asesmen sudah ditutup' }
    }

    const org = data.organizations as unknown as { id: string; name: string; slug: string }

    // Build assessment object without the joined org
    const { organizations: _org, ...assessmentData } = data
    const assessment = assessmentData as unknown as Assessment

    return {
      ok: true,
      data: {
        assessment,
        orgName: org.name,
        orgSlug: org.slug,
      },
    }
  } catch (err) {
    logger.error('getPublicAssessment', err)
    return { ok: false, error: 'Asesmen tidak ditemukan atau sudah ditutup' }
  }
}

// ============================================
// 2. registerAndStartSession
// ============================================

/**
 * Main registration + session start flow for public test links.
 * Rate limited by IP. Creates user if needed. Returns session info.
 */
export async function registerAndStartSession(
  code: string,
  input: { name: string; email?: string; phone?: string; accessCode?: string }
): Promise<ActionResultV2<{
  sessionId: string
  sessionToken: string
  timeRemainingSeconds: number
  questionCount: number
}>> {
  try {
    // Rate limit by IP
    const hdrs = await headers()
    const clientIp = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? hdrs.get('x-real-ip')
      ?? 'unknown'

    const rl = await checkRateLimit(`pub:${clientIp}`, RATE_LIMITS.publicRegistration)
    if (!rl.allowed) {
      return { ok: false, error: 'Terlalu banyak percobaan. Coba lagi nanti.' }
    }

    // Validate input
    const validation = publicRegistrationSchema.safeParse(input)
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Data tidak valid' }
    }

    const supabase = await createSupabaseServiceClient()

    // Fetch assessment by public_code
    const { data: assessmentRow, error: aError } = await supabase
      .from('assessments')
      .select('*')
      .eq('public_code', code.toUpperCase())
      .eq('status', 'published')
      .single()

    if (aError || !assessmentRow) {
      return { ok: false, error: 'Asesmen tidak ditemukan atau sudah ditutup' }
    }

    const assessment = assessmentRow as Assessment

    // Validate access code if required (constant-time comparison)
    if (assessment.access_code) {
      if (!input.accessCode) {
        return { ok: false, error: 'Kode akses diperlukan' }
      }
      const expected = Buffer.from(assessment.access_code, 'utf8')
      const provided = Buffer.from(input.accessCode, 'utf8')
      if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return { ok: false, error: 'Kode akses salah' }
      }
    }

    // Check schedule window
    const now = new Date()
    if (assessment.start_date && new Date(assessment.start_date) > now) {
      return { ok: false, error: 'Asesmen belum dibuka' }
    }
    if (assessment.end_date && new Date(assessment.end_date) < now) {
      return { ok: false, error: 'Asesmen sudah ditutup' }
    }

    // Determine the candidate email (use provided email or generate placeholder from phone)
    const candidateEmail = (input.email && input.email.length > 0)
      ? input.email.toLowerCase().trim()
      : `${crypto.randomUUID().slice(0, 8)}@guest.cekatan.com`

    const candidatePhone = (input.phone && input.phone.length > 0)
      ? input.phone.trim()
      : null

    // Check if user already exists by email or phone
    let userId: string | null = null

    // Try email match first
    if (input.email && input.email.length > 0) {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', candidateEmail)
        .maybeSingle()

      if (existingProfile) {
        userId = existingProfile.id
      }
    }

    // If no email match, try phone match
    if (!userId && candidatePhone) {
      const { data: phoneProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', candidatePhone)
        .maybeSingle()

      if (phoneProfile) {
        userId = phoneProfile.id
      }
    }

    // Create or update user
    if (!userId) {
      // Create new Supabase auth user
      const randomPassword = crypto.randomBytes(32).toString('hex')
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: candidateEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          full_name: input.name.trim(),
          onboarded: true,
        },
      })

      if (createError || !newUser.user) {
        logger.error('registerAndStartSession', createError ?? 'createUser failed')
        return { ok: false, error: 'Gagal membuat akun. Coba lagi.' }
      }

      userId = newUser.user.id

      // Update profile with phone if provided
      if (candidatePhone) {
        await supabase
          .from('profiles')
          .update({ phone: candidatePhone })
          .eq('id', userId)
      }
    } else {
      // User exists — only update fields that are currently empty
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', userId)
        .single()

      const updates: Record<string, string> = {}
      if (!existingProfile?.full_name) {
        updates.full_name = input.name.trim()
      }
      if (candidatePhone && !existingProfile?.phone) {
        updates.phone = candidatePhone
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
      }
    }

    // Add to org as 'candidate' if not already a member
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', assessment.org_id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existingMember) {
      await supabase
        .from('organization_members')
        .insert({
          org_id: assessment.org_id,
          user_id: userId,
          role: 'candidate',
        })
    }

    // Check max attempts
    if (assessment.max_attempts) {
      const { count } = await supabase
        .from('assessment_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('assessment_id', assessment.id)
        .eq('user_id', userId)

      if ((count ?? 0) >= assessment.max_attempts) {
        return { ok: false, error: 'Jumlah percobaan maksimum telah tercapai' }
      }
    }

    // Check for existing in_progress session (resume it)
    const { data: existingSession } = await supabase
      .from('assessment_sessions')
      .select('id, time_remaining_seconds, question_order')
      .eq('assessment_id', assessment.id)
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (existingSession) {
      const questionOrder = existingSession.question_order as string[]
      return {
        ok: true,
        data: {
          sessionId: existingSession.id,
          sessionToken: createSessionToken(existingSession.id),
          timeRemainingSeconds: existingSession.time_remaining_seconds ?? assessment.time_limit_minutes * 60,
          questionCount: questionOrder.length,
        },
      }
    }

    // Select questions from deck
    const { data: cards, error: cError } = await supabase
      .from('card_templates')
      .select('id')
      .eq('deck_template_id', assessment.deck_template_id)

    if (cError || !cards || cards.length === 0) {
      return { ok: false, error: 'Tidak ada pertanyaan tersedia' }
    }

    // Shuffle if needed, then slice to question_count
    let questionIds = cards.map((c) => c.id)
    if (assessment.shuffle_questions) {
      // Fisher-Yates with crypto.getRandomValues for unbiased shuffle
      const arr = questionIds
      for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1)
        ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
      }
      questionIds = arr
    }
    questionIds = questionIds.slice(0, assessment.question_count)

    // Create assessment session
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .insert({
        assessment_id: assessment.id,
        user_id: userId,
        question_order: questionIds,
        time_remaining_seconds: assessment.time_limit_minutes * 60,
        status: 'in_progress',
        ip_address: clientIp !== 'unknown' ? clientIp : null,
      })
      .select('id')
      .single()

    if (sError || !session) {
      logger.error('registerAndStartSession', sError ?? 'session create failed')
      return { ok: false, error: 'Gagal memulai sesi' }
    }

    // Create empty assessment_answer rows
    const answerRows = questionIds.map((cardId) => ({
      session_id: session.id,
      card_template_id: cardId,
    }))

    const { error: answerError } = await supabase.from('assessment_answers').insert(answerRows)
    if (answerError) {
      // Rollback: delete the session we just created
      await supabase.from('assessment_sessions').delete().eq('id', session.id)
      logger.error('registerAndStartSession.answerInsert', answerError)
      return { ok: false, error: 'Gagal menyiapkan soal' }
    }

    return {
      ok: true,
      data: {
        sessionId: session.id,
        sessionToken: createSessionToken(session.id),
        timeRemainingSeconds: assessment.time_limit_minutes * 60,
        questionCount: questionIds.length,
      },
    }
  } catch (err) {
    logger.error('registerAndStartSession', err)
    return { ok: false, error: 'Gagal memulai sesi' }
  }
}

// ============================================
// 3. getPublicQuestions
// ============================================

/**
 * Fetch questions for an active public session.
 * Returns questions with existing answers (for resume).
 */
export async function getPublicQuestions(
  sessionIdOrToken: string
): Promise<ActionResultV2<{
  questions: Array<{
    cardTemplateId: string
    stem: string
    options: string[]
    selectedIndex: number | null
  }>
  timeRemainingSeconds: number
  assessmentTitle: string
  allowReview: boolean
  shuffleOptions: boolean
}>> {
  try {
    const sessionId = verifySessionToken(sessionIdOrToken)
    if (!sessionId) {
      return { ok: false, error: 'Token sesi tidak valid' }
    }

    const supabase = await createSupabaseServiceClient()

    // Fetch session with assessment info
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(title, allow_review, shuffle_options)')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single()

    if (sError || !session) {
      return { ok: false, error: 'Sesi tidak ditemukan atau sudah selesai' }
    }

    const assessmentInfo = session.assessments as unknown as {
      title: string
      allow_review: boolean
      shuffle_options: boolean
    }

    const questionOrder = session.question_order as string[]

    // Fetch existing answers for this session
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('card_template_id, selected_index')
      .eq('session_id', sessionId)

    const answerMap = new Map<string, number | null>()
    for (const a of answers ?? []) {
      answerMap.set(a.card_template_id, a.selected_index)
    }

    // Fetch card templates in question order
    const { data: cards, error: cError } = await supabase
      .from('card_templates')
      .select('id, stem, options')
      .in('id', questionOrder)

    if (cError || !cards) {
      return { ok: false, error: 'Tidak ada pertanyaan tersedia' }
    }

    // Build a map for ordering
    const cardMap = new Map(cards.map((c) => [c.id, c]))

    // Return questions in the session's question_order
    const questions = questionOrder
      .map((id) => {
        const card = cardMap.get(id)
        if (!card) return null
        return {
          cardTemplateId: card.id,
          stem: card.stem,
          options: card.options as string[],
          selectedIndex: answerMap.get(card.id) ?? null,
        }
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)

    return {
      ok: true,
      data: {
        questions,
        timeRemainingSeconds: session.time_remaining_seconds ?? 0,
        assessmentTitle: assessmentInfo.title,
        allowReview: assessmentInfo.allow_review,
        shuffleOptions: assessmentInfo.shuffle_options,
      },
    }
  } catch (err) {
    logger.error('getPublicQuestions', err)
    return { ok: false, error: 'Sesi tidak ditemukan atau sudah selesai' }
  }
}

// ============================================
// 4. submitPublicAnswer
// ============================================

/**
 * Submit an answer for a question in a public session.
 * Verifies session is active, card belongs to session, scores answer.
 */
export async function submitPublicAnswer(
  sessionIdOrToken: string,
  cardTemplateId: string,
  selectedIndex: number,
  timeRemainingSeconds?: number,
  timeSpentSeconds?: number
): Promise<ActionResultV2<{ isCorrect: boolean }>> {
  try {
    const sessionId = verifySessionToken(sessionIdOrToken)
    if (!sessionId) {
      return { ok: false, error: 'Token sesi tidak valid' }
    }

    // Rate limit by session token: 120 answers per minute (2 per second burst)
    const rl = await checkRateLimit(`pub-answer:${sessionId}`, RATE_LIMITS.standard)
    if (!rl.allowed) {
      return { ok: false, error: 'Terlalu banyak permintaan. Coba lagi.' }
    }

    const supabase = await createSupabaseServiceClient()

    // Verify session is active
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .select('id, status, question_order')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single()

    if (sError || !session) {
      return { ok: false, error: 'Sesi tidak ditemukan atau sudah selesai' }
    }

    // Verify the card belongs to this session
    const questionOrder = session.question_order as string[]
    if (!questionOrder.includes(cardTemplateId)) {
      return { ok: false, error: 'Pertanyaan bukan bagian dari sesi ini' }
    }

    // Get the correct answer
    const { data: card } = await supabase
      .from('card_templates')
      .select('correct_index')
      .eq('id', cardTemplateId)
      .single()

    if (!card) {
      return { ok: false, error: 'Pertanyaan tidak ditemukan' }
    }

    const isCorrect = selectedIndex === card.correct_index

    // Update the answer
    const { error: uError } = await supabase
      .from('assessment_answers')
      .update({
        selected_index: selectedIndex,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
        ...(timeSpentSeconds !== undefined && { time_spent_seconds: Math.round(timeSpentSeconds) }),
      })
      .eq('session_id', sessionId)
      .eq('card_template_id', cardTemplateId)

    if (uError) {
      return { ok: false, error: uError.message }
    }

    // Persist timer snapshot for session resume
    if (timeRemainingSeconds !== undefined && timeRemainingSeconds >= 0) {
      await supabase
        .from('assessment_sessions')
        .update({ time_remaining_seconds: timeRemainingSeconds })
        .eq('id', sessionId)
    }

    return { ok: true, data: { isCorrect } }
  } catch (err) {
    logger.error('submitPublicAnswer', err)
    return { ok: false, error: 'Sesi tidak ditemukan atau sudah selesai' }
  }
}

// ============================================
// 5. completePublicSession
// ============================================

/**
 * Complete a public session. Calculates score, determines pass/fail.
 */
export async function completePublicSession(
  sessionIdOrToken: string
): Promise<ActionResultV2<{
  score: number
  passed: boolean
  total: number
  correct: number
}>> {
  try {
    const sessionId = verifySessionToken(sessionIdOrToken)
    if (!sessionId) {
      return { ok: false, error: 'Token sesi tidak valid' }
    }

    // Rate limit session completion: 5 per minute per session
    const rl = await checkRateLimit(`pub-complete:${sessionId}`, RATE_LIMITS.sensitive)
    if (!rl.allowed) {
      return { ok: false, error: 'Terlalu banyak permintaan. Coba lagi.' }
    }

    const supabase = await createSupabaseServiceClient()

    // Verify session
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .select('*, assessments!inner(pass_score, title, org_id)')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single()

    if (sError || !session) {
      return { ok: false, error: 'Sesi tidak ditemukan atau sudah selesai' }
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
    const { error: uError } = await supabase
      .from('assessment_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        score,
        passed,
      })
      .eq('id', sessionId)

    if (uError) {
      return { ok: false, error: uError.message }
    }

    // Generate certificate for passing candidates
    if (passed) {
      try {
        await generateCertificate(sessionId)
      } catch {
        // Non-fatal: certificate generation may fail
        logger.warn('completePublicSession.certificate', 'Certificate generation failed for session ' + sessionId)
      }
    }

    return { ok: true, data: { score, passed, total, correct } }
  } catch (err) {
    logger.error('completePublicSession', err)
    return { ok: false, error: 'Sesi tidak ditemukan' }
  }
}

// ============================================
// 5b. reportPublicTabSwitch
// ============================================

/**
 * Report a tab switch during a public assessment session.
 * Increments tab_switch_count and appends to tab_switch_log.
 */
export async function reportPublicTabSwitch(
  sessionIdOrToken: string
): Promise<ActionResultV2<void>> {
  try {
    const sessionId = verifySessionToken(sessionIdOrToken)
    if (!sessionId) {
      return { ok: false, error: 'Token sesi tidak valid' }
    }

    const supabase = await createSupabaseServiceClient()

    const { data: session } = await supabase
      .from('assessment_sessions')
      .select('id, tab_switch_count, tab_switch_log')
      .eq('id', sessionId)
      .eq('status', 'in_progress')
      .single()

    if (!session) {
      return { ok: false, error: 'Sesi tidak ditemukan' }
    }

    const newCount = ((session.tab_switch_count as number) ?? 0) + 1
    const log = Array.isArray(session.tab_switch_log) ? session.tab_switch_log : []
    log.push({ timestamp: new Date().toISOString(), type: 'tab_hidden' })

    await supabase
      .from('assessment_sessions')
      .update({ tab_switch_count: newCount, tab_switch_log: log })
      .eq('id', sessionId)

    return { ok: true }
  } catch (err) {
    logger.error('reportPublicTabSwitch', err)
    return { ok: false, error: 'Gagal melaporkan pelanggaran' }
  }
}

// ============================================
// 6. getPublicResults
// ============================================

/**
 * Fetch results for a completed public session.
 */
export async function getPublicResults(
  sessionIdOrToken: string
): Promise<ActionResultV2<{
  score: number
  passed: boolean
  total: number
  correct: number
  assessmentTitle: string
  orgName: string
  timeLimitMinutes: number
  passScore: number
  completedAt: string | null
  certificateUrl: string | null
}>> {
  try {
    const sessionId = verifySessionToken(sessionIdOrToken)
    if (!sessionId) {
      return { ok: false, error: 'Token sesi tidak valid' }
    }

    const supabase = await createSupabaseServiceClient()

    // Fetch session with assessment + org
    const { data: session, error: sError } = await supabase
      .from('assessment_sessions')
      .select(`
        id, score, passed, completed_at, certificate_url, status,
        assessments!inner(
          title, time_limit_minutes, pass_score, org_id,
          organizations!inner(name)
        )
      `)
      .eq('id', sessionId)
      .eq('status', 'completed')
      .single()

    if (sError || !session) {
      return { ok: false, error: 'Hasil tidak ditemukan' }
    }

    const assessmentInfo = session.assessments as unknown as {
      title: string
      time_limit_minutes: number
      pass_score: number
      org_id: string
      organizations: { name: string }
    }

    // Count answers
    const { data: answers } = await supabase
      .from('assessment_answers')
      .select('is_correct')
      .eq('session_id', sessionId)

    const total = answers?.length ?? 0
    const correct = answers?.filter((a) => a.is_correct === true).length ?? 0

    return {
      ok: true,
      data: {
        score: session.score ?? 0,
        passed: session.passed ?? false,
        total,
        correct,
        assessmentTitle: assessmentInfo.title,
        orgName: assessmentInfo.organizations.name,
        timeLimitMinutes: assessmentInfo.time_limit_minutes,
        passScore: assessmentInfo.pass_score,
        completedAt: session.completed_at,
        certificateUrl: session.certificate_url,
      },
    }
  } catch (err) {
    logger.error('getPublicResults', err)
    return { ok: false, error: 'Hasil tidak ditemukan' }
  }
}
