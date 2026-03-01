'use server'

/**
 * V13 Phase 9: Notification Server Actions
 */

import { withUser, withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/org-authorization'
import { logger } from '@/lib/logger'
import type { ActionResultV2 } from '@/types/actions'
import {
  dispatchAssessmentEmail,
  buildUnsubscribeUrl,
  buildFullUrl,
} from '@/lib/email-dispatch'

export interface Notification {
  id: string
  user_id: string
  org_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

/**
 * Get notifications for the current user in the active org.
 */
export async function getMyNotifications(): Promise<ActionResultV2<Notification[]>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: (data ?? []) as Notification[] }
  })
}

/**
 * Get unread notification count for badge display.
 */
export async function getUnreadNotificationCount(): Promise<ActionResultV2<number>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('org_id', org.id)
      .is('read_at', null)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: count ?? 0 }
  })
}

/**
 * Get paginated notifications with optional type filter.
 */
export async function getNotificationsPaginated(opts?: {
  typeFilter?: string
  limit?: number
  offset?: number
}): Promise<ActionResultV2<{ notifications: Notification[]; total: number }>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const limit = opts?.limit ?? 30
    const offset = opts?.offset ?? 0

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })

    if (opts?.typeFilter) {
      query = query.eq('type', opts.typeFilter)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: { notifications: (data ?? []) as Notification[], total: count ?? 0 } }
  })
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(
  notificationId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase }) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead(): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('org_id', org.id)
      .is('read_at', null)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Notify all candidates in the org about a new published assessment.
 * Called by publishAssessment. Creator+ only.
 */
export async function notifyOrgCandidates(
  title: string,
  body: string,
  link: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get all members (exclude the publisher)
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)
      .neq('user_id', user.id)

    if (!members || members.length === 0) {
      return { ok: true }
    }

    // Batch insert notifications via service role (system-level cross-user operation)
    const rows = members.map((m) => ({
      user_id: m.user_id,
      org_id: org.id,
      type: 'assessment_published',
      title,
      body,
      link,
    }))

    const serviceClient = await createSupabaseServiceClient()
    const { error } = await serviceClient.from('notifications').insert(rows)
    if (error) {
      return { ok: false, error: error.message }
    }

    // Fire-and-forget email dispatch
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, email, email_notifications')
      .in('id', members.map((m) => m.user_id))

    for (const profile of profiles ?? []) {
      if (profile.email_notifications === false) continue
      dispatchAssessmentEmail({
        to: profile.email,
        subject: title,
        orgName: org.name,
        assessmentTitle: title,
        message: body,
        actionUrl: buildFullUrl(link),
        unsubscribeUrl: buildUnsubscribeUrl(profile.id),
      }).catch((err) => logger.warn('notifyOrgCandidates.email', String(err)))
    }

    return { ok: true }
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Send a reminder notification for a specific assessment to candidates
 * who haven't completed it yet. Creator+ only.
 * Returns the number of candidates notified.
 */
export async function sendAssessmentReminder(
  assessmentId: string
): Promise<ActionResultV2<{ notified: number }>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get the assessment
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, title, status')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!assessment) {
      return { ok: false, error: 'Assessment not found' }
    }

    if (assessment.status !== 'published') {
      return { ok: false, error: 'Can only send reminders for published assessments' }
    }

    // Get all org members except the creator
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)
      .neq('user_id', user.id)

    if (!members || members.length === 0) {
      return { ok: true, data: { notified: 0 } }
    }

    // Get users who have completed this assessment
    const { data: completedSessions } = await supabase
      .from('assessment_sessions')
      .select('user_id')
      .eq('assessment_id', assessmentId)
      .eq('status', 'completed')

    const completedUserIds = new Set((completedSessions ?? []).map((s) => s.user_id))

    // Filter to only candidates who haven't completed it
    const pendingMembers = members.filter((m) => !completedUserIds.has(m.user_id))

    if (pendingMembers.length === 0) {
      return { ok: true, data: { notified: 0 } }
    }

    const rows = pendingMembers.map((m) => ({
      user_id: m.user_id,
      org_id: org.id,
      type: 'assessment_reminder',
      title: 'Assessment Reminder',
      body: `Don't forget to complete "${assessment.title}".`,
      link: `/assessments`,
    }))

    const serviceClient = await createSupabaseServiceClient()
    const { error: insertError } = await serviceClient.from('notifications').insert(rows)
    if (insertError) {
      return { ok: false, error: insertError.message }
    }

    // Fire-and-forget email dispatch
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, email, email_notifications')
      .in('id', pendingMembers.map((m) => m.user_id))

    for (const profile of profiles ?? []) {
      if (profile.email_notifications === false) continue
      dispatchAssessmentEmail({
        to: profile.email,
        subject: 'Assessment Reminder',
        orgName: org.name,
        assessmentTitle: assessment.title,
        message: `Don't forget to complete "${assessment.title}".`,
        actionUrl: buildFullUrl('/assessments'),
        unsubscribeUrl: buildUnsubscribeUrl(profile.id),
      }).catch((err) => logger.warn('sendAssessmentReminder.email', String(err)))
    }

    return { ok: true, data: { notified: pendingMembers.length } }
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Send deadline approaching notifications for assessments with end_date
 * within the next 24 hours. Targets candidates who haven't completed.
 * Creator+ only.
 */
export async function sendDeadlineReminders(): Promise<ActionResultV2<{ notified: number; assessments: number }>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Find published assessments with end_date in the next 24h
    const { data: assessments } = await supabase
      .from('assessments')
      .select('id, title, end_date')
      .eq('org_id', org.id)
      .eq('status', 'published')
      .not('end_date', 'is', null)
      .gte('end_date', now.toISOString())
      .lte('end_date', in24h.toISOString())

    if (!assessments || assessments.length === 0) {
      return { ok: true, data: { notified: 0, assessments: 0 } }
    }

    // Get all org members except creators
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)
      .eq('role', 'candidate')

    if (!members || members.length === 0) {
      return { ok: true, data: { notified: 0, assessments: assessments.length } }
    }

    let totalNotified = 0
    const serviceClient = await createSupabaseServiceClient()

    // Single query to get all completed/timed_out sessions across all assessments
    const assessmentIds = assessments.map((a) => a.id)
    const { data: allCompletedSessions } = await supabase
      .from('assessment_sessions')
      .select('user_id, assessment_id')
      .in('assessment_id', assessmentIds)
      .in('status', ['completed', 'timed_out'])

    // Group completed user_ids by assessment_id
    const completedByAssessment = new Map<string, Set<string>>()
    for (const s of allCompletedSessions ?? []) {
      if (!completedByAssessment.has(s.assessment_id)) {
        completedByAssessment.set(s.assessment_id, new Set())
      }
      completedByAssessment.get(s.assessment_id)!.add(s.user_id)
    }

    for (const assessment of assessments) {
      const completedIds = completedByAssessment.get(assessment.id) ?? new Set<string>()
      const pending = members.filter((m) => !completedIds.has(m.user_id))

      if (pending.length === 0) continue

      const endDate = new Date(assessment.end_date!)
      const hoursLeft = Math.round((endDate.getTime() - now.getTime()) / (60 * 60 * 1000))

      const rows = pending.map((m) => ({
        user_id: m.user_id,
        org_id: org.id,
        type: 'assessment_deadline_approaching',
        title: 'Deadline Approaching',
        body: `"${assessment.title}" closes in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}. Complete it before it closes.`,
        link: `/assessments/${assessment.id}/take`,
      }))

      const { error } = await serviceClient.from('notifications').insert(rows)
      if (!error) {
        totalNotified += pending.length

        // Fire-and-forget email dispatch
        const { data: profiles } = await serviceClient
          .from('profiles')
          .select('id, email, email_notifications')
          .in('id', pending.map((m) => m.user_id))

        const bodyText = `"${assessment.title}" closes in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}. Complete it before it closes.`
        for (const profile of profiles ?? []) {
          if (profile.email_notifications === false) continue
          dispatchAssessmentEmail({
            to: profile.email,
            subject: 'Deadline Approaching',
            orgName: org.name,
            assessmentTitle: assessment.title,
            message: bodyText,
            actionUrl: buildFullUrl(`/assessments/${assessment.id}/take`),
            unsubscribeUrl: buildUnsubscribeUrl(profile.id),
          }).catch((err) => logger.warn('sendDeadlineReminders.email', String(err)))
        }
      }
    }

    return { ok: true, data: { notified: totalNotified, assessments: assessments.length } }
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Assign an assessment to all candidates who haven't started it yet.
 * Sends an 'assessment_assigned' notification. Creator+ only.
 */
export async function assignAssessmentToAll(
  assessmentId: string
): Promise<ActionResultV2<{ notified: number }>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Get the assessment
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, title, status')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!assessment) {
      return { ok: false, error: 'Assessment not found' }
    }

    if (assessment.status !== 'published') {
      return { ok: false, error: 'Can only assign published assessments' }
    }

    // Get all candidates
    const { data: candidates } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)
      .eq('role', 'candidate')

    if (!candidates || candidates.length === 0) {
      return { ok: true, data: { notified: 0 } }
    }

    // Get users who already have sessions (started or completed)
    const { data: existingSessions } = await supabase
      .from('assessment_sessions')
      .select('user_id')
      .eq('assessment_id', assessmentId)

    const startedUserIds = new Set((existingSessions ?? []).map((s) => s.user_id))

    // Filter to candidates who haven't started
    const pending = candidates.filter((c) => !startedUserIds.has(c.user_id))

    if (pending.length === 0) {
      return { ok: true, data: { notified: 0 } }
    }

    const rows = pending.map((c) => ({
      user_id: c.user_id,
      org_id: org.id,
      type: 'assessment_assigned',
      title: 'Assessment Assigned',
      body: `You have been assigned "${assessment.title}". Please complete it.`,
      link: `/assessments/${assessment.id}/take`,
    }))

    const serviceClient = await createSupabaseServiceClient()
    const { error } = await serviceClient.from('notifications').insert(rows)
    if (error) {
      return { ok: false, error: error.message }
    }

    // Send email notifications (fire-and-forget)
    const pendingUserIds = pending.map(c => c.user_id)
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, email, full_name, email_notifications')
      .in('id', pendingUserIds)

    for (const profile of profiles ?? []) {
      if (!profile.email_notifications) continue
      dispatchAssessmentEmail({
        to: profile.email,
        subject: `Assessment ditugaskan: ${assessment.title} — ${org.name}`,
        orgName: org.name,
        assessmentTitle: assessment.title,
        message: `Anda ditugaskan untuk mengerjakan "${assessment.title}". Silakan kerjakan sebelum batas waktu.`,
        actionUrl: buildFullUrl(`/assessments/${assessment.id}/take`),
        unsubscribeUrl: buildUnsubscribeUrl(profile.id),
      }).catch(() => {})
    }

    return { ok: true, data: { notified: pending.length } }
  }, undefined, RATE_LIMITS.bulk)
}

/**
 * Bulk assign an assessment to specific candidates by user ID.
 * Sends 'assessment_assigned' notifications only to candidates who haven't started. Creator+ only.
 */
export async function bulkAssignAssessment(
  assessmentId: string,
  candidateUserIds: string[]
): Promise<ActionResultV2<{ notified: number; alreadyStarted: number }>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'creator')) {
      return { ok: false, error: 'Insufficient permissions' }
    }

    if (candidateUserIds.length === 0) {
      return { ok: true, data: { notified: 0, alreadyStarted: 0 } }
    }

    // Verify assessment exists and is published
    const { data: assessment } = await supabase
      .from('assessments')
      .select('id, title, status')
      .eq('id', assessmentId)
      .eq('org_id', org.id)
      .single()

    if (!assessment) {
      return { ok: false, error: 'Assessment not found' }
    }

    if (assessment.status !== 'published') {
      return { ok: false, error: 'Can only assign published assessments' }
    }

    // Check which candidates already have sessions
    const { data: existingSessions } = await supabase
      .from('assessment_sessions')
      .select('user_id')
      .eq('assessment_id', assessmentId)
      .in('user_id', candidateUserIds)

    const startedIds = new Set((existingSessions ?? []).map((s) => s.user_id))
    const pending = candidateUserIds.filter((id) => !startedIds.has(id))

    if (pending.length === 0) {
      return { ok: true, data: { notified: 0, alreadyStarted: candidateUserIds.length } }
    }

    const rows = pending.map((userId) => ({
      user_id: userId,
      org_id: org.id,
      type: 'assessment_assigned',
      title: 'Assessment Assigned',
      body: `You have been assigned "${assessment.title}". Please complete it.`,
      link: `/assessments/${assessment.id}/take`,
    }))

    const serviceClient = await createSupabaseServiceClient()
    const { error } = await serviceClient.from('notifications').insert(rows)
    if (error) {
      return { ok: false, error: error.message }
    }

    // Send email notifications (fire-and-forget)
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, email, full_name, email_notifications')
      .in('id', pending)

    for (const profile of profiles ?? []) {
      if (!profile.email_notifications) continue
      dispatchAssessmentEmail({
        to: profile.email,
        subject: `Assessment ditugaskan: ${assessment.title} — ${org.name}`,
        orgName: org.name,
        assessmentTitle: assessment.title,
        message: `Anda ditugaskan untuk mengerjakan "${assessment.title}". Silakan kerjakan sebelum batas waktu.`,
        actionUrl: buildFullUrl(`/assessments/${assessment.id}/take`),
        unsubscribeUrl: buildUnsubscribeUrl(profile.id),
      }).catch(() => {})
    }

    return { ok: true, data: { notified: pending.length, alreadyStarted: startedIds.size } }
  }, undefined, RATE_LIMITS.bulk)
}
