'use server'

/**
 * V16: Audit Log Server Actions
 *
 * logAuditEvent — fire-and-forget helper to record admin actions.
 * getAuditLogs — paginated, filterable audit log viewer for admins.
 */

import { withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { hasMinimumRole } from '@/lib/org-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { AuditAction, AuditLogWithActor } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Fire-and-forget audit log helper.
 * Call this from other server actions to record an event.
 * Does NOT throw — silently fails to avoid breaking the parent action.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  orgId: string,
  actorId: string,
  action: AuditAction,
  opts?: {
    targetType?: string
    targetId?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      org_id: orgId,
      actor_id: actorId,
      action,
      target_type: opts?.targetType ?? null,
      target_id: opts?.targetId ?? null,
      metadata: opts?.metadata ?? {},
    })
  } catch {
    // Silently fail — audit logging should never break the main flow
  }
}

/**
 * Get paginated audit logs for the current org. Admin+ only.
 */
export async function getAuditLogs(opts?: {
  actionFilter?: AuditAction
  limit?: number
  offset?: number
}): Promise<ActionResultV2<{ logs: AuditLogWithActor[]; total: number }>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'admin')) {
      return { ok: false, error: 'Insufficient permissions — admin required' }
    }

    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100)
    const offset = Math.max(opts?.offset ?? 0, 0)

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })

    if (opts?.actionFilter) {
      query = query.eq('action', opts.actionFilter)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      return { ok: false, error: error.message }
    }

    const logs = data ?? []

    // Enrich with actor emails
    const actorIds = [...new Set(logs.map((l) => l.actor_id))]
    const { data: profiles } = actorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', actorIds)
      : { data: [] as { id: string; email: string; full_name: string | null }[] }

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { email: p.email, name: p.full_name }])
    )

    const enriched: AuditLogWithActor[] = logs.map((l) => ({
      ...l,
      actor_email: profileMap.get(l.actor_id)?.email ?? `user-${l.actor_id.slice(0, 8)}`,
      actor_name: profileMap.get(l.actor_id)?.name ?? null,
    }))

    return { ok: true, data: { logs: enriched, total: count ?? 0 } }
  }, undefined, RATE_LIMITS.standard)
}
