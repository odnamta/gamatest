'use server'

/**
 * Candidate management: list, progress, export, import, reset attempts, full profile.
 */

import crypto from 'crypto'
import { withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { AssessmentSession, SessionWithAssessment } from '@/types/database'
import { logAuditEvent } from '@/actions/audit-actions'

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
    roleProfileIds: string[]
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

    // Role profile assignments
    const { data: roleAssignments } = await supabase
      .from('employee_role_assignments')
      .select('user_id, role_profile_id')
      .in('user_id', userIds)
    const userRoles = new Map<string, string[]>()
    for (const ra of roleAssignments ?? []) {
      const existing = userRoles.get(ra.user_id) ?? []
      existing.push(ra.role_profile_id)
      userRoles.set(ra.user_id, existing)
    }

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
        roleProfileIds: userRoles.get(uid) ?? [],
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

    // Parse all rows first to collect emails
    const parsedRows: Array<{ rowNum: number; email: string; name: string | null; role: string }> = []
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

      parsedRows.push({ rowNum: i + 1, email, name, role: validRole })
    }

    // Get existing members
    const { data: existingMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)

    const existingUserIds = new Set((existingMembers ?? []).map((m) => m.user_id))

    // Batch-fetch all profiles by email in one query instead of N queries
    const allEmails = parsedRows.map((r) => r.email)
    const { data: existingProfiles } = allEmails.length > 0
      ? await supabase
          .from('profiles')
          .select('id, email')
          .in('email', allEmails)
      : { data: [] as { id: string; email: string }[] }

    const profileByEmail = new Map(
      (existingProfiles ?? []).map((p) => [p.email.toLowerCase(), p])
    )

    let imported = 0
    let skipped = 0

    for (const row of parsedRows) {
      const existingProfile = profileByEmail.get(row.email)

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
            role: row.role,
          })

        if (memberError) {
          errors.push(`Row ${row.rowNum}: ${memberError.message}`)
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
            email: row.email,
            role: row.role,
            invited_by: user.id,
            token,
            expires_at: expires.toISOString(),
          })

        if (inviteError) {
          // Might be duplicate invitation
          if (inviteError.message.includes('duplicate') || inviteError.message.includes('unique')) {
            skipped++
          } else {
            errors.push(`Row ${row.rowNum}: ${inviteError.message}`)
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

/**
 * Get a candidate's full profile with roles, aggregate stats, and join date.
 * Creator+ only. Used for the redesigned candidate profile page.
 */
export async function getCandidateFullProfile(
  userId: string
): Promise<ActionResultV2<{
  profile: { id: string; email: string; fullName: string | null; avatarUrl: string | null }
  roles: string[]
  totalAssessments: number
  avgScore: number
  passRate: number
  joinedAt: string
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Verify user is in org and get join date
    const { data: member } = await supabase
      .from('organization_members')
      .select('created_at')
      .eq('org_id', org.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!member) {
      return { ok: false, error: 'Candidate not found in this organization' }
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url')
      .eq('id', userId)
      .single()

    if (!profile) return { ok: false, error: 'Profile not found' }

    // Fetch role assignments via employee_role_assignments + role_profiles
    const { data: roleAssignments } = await supabase
      .from('employee_role_assignments')
      .select('role_profile_id, role_profiles(name)')
      .eq('org_id', org.id)
      .eq('user_id', userId)

    const roles = (roleAssignments ?? [])
      .map((ra) => (ra.role_profiles as unknown as { name: string })?.name)
      .filter(Boolean) as string[]

    // Fetch completed assessment sessions scoped to org
    const { data: sessionsData } = await supabase
      .from('assessment_sessions')
      .select('score, passed, status, assessments!inner(org_id)')
      .eq('user_id', userId)
      .in('status', ['completed', 'timed_out'])

    const completedSessions = (sessionsData ?? []).filter((s) => {
      const a = s.assessments as unknown as { org_id: string }
      return a.org_id === org.id
    })

    const totalAssessments = completedSessions.length
    const avgScore = totalAssessments > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / totalAssessments)
      : 0
    const passedCount = completedSessions.filter((s) => s.passed).length
    const passRate = totalAssessments > 0 ? Math.round((passedCount / totalAssessments) * 100) : 0

    return {
      ok: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        },
        roles,
        totalAssessments,
        avgScore,
        passRate,
        joinedAt: member.created_at,
      },
    }
  })
}
