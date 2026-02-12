'use server'

/**
 * V13 Phase 9: Notification Server Actions
 */

import { withUser, withOrgUser } from '@/actions/_helpers'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'

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
  })
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
  })
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

    // Batch insert notifications
    const rows = members.map((m) => ({
      user_id: m.user_id,
      org_id: org.id,
      type: 'assessment_published',
      title,
      body,
      link,
    }))

    const { error } = await supabase.from('notifications').insert(rows)
    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  })
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

    const { error: insertError } = await supabase.from('notifications').insert(rows)
    if (insertError) {
      return { ok: false, error: insertError.message }
    }

    return { ok: true, data: { notified: pendingMembers.length } }
  })
}
