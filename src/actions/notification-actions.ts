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
