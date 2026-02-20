'use server'

/**
 * V13: Organization Server Actions
 * CRUD operations for organizations and membership management.
 */

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { withUser, withOrgUser } from '@/actions/_helpers'
import { hasMinimumRole } from '@/lib/org-authorization'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { ACTIVE_ORG_COOKIE } from '@/lib/org-context'
import type { ActionResultV2 } from '@/types/actions'
import type { Organization, OrganizationMember, OrganizationMemberWithProfile, OrgRole, AssessmentDefaults } from '@/types/database'
import { createOrgSchema, updateOrgSettingsSchema } from '@/lib/validations'
import { logAuditEvent } from '@/actions/audit-actions'

/**
 * Create a new organization. The creating user becomes the owner.
 */
export async function createOrganization(
  name: string,
  slug: string
): Promise<ActionResultV2<Organization>> {
  return withUser(async ({ user, supabase }) => {
    const validation = createOrgSchema.safeParse({ name, slug })
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Validation failed' }
    }

    // Use SECURITY DEFINER function to atomically create org + add owner.
    // This avoids the RLS chicken-and-egg problem where INSERT ... RETURNING
    // needs SELECT access, but SELECT policy requires org membership that
    // doesn't exist yet.
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('create_organization_with_owner', {
        p_name: name,
        p_slug: slug,
      })

    if (rpcError) {
      const msg = rpcError.message
      if (msg.includes('Slug already taken')) {
        return { ok: false, error: 'This URL slug is already taken' }
      }
      return { ok: false, error: msg }
    }

    const orgId = rpcData as string

    // Fetch the created org (now visible via SELECT policy since user is owner)
    const { data: org, error: fetchError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single()

    if (fetchError || !org) {
      return { ok: false, error: 'Organization created but failed to fetch details' }
    }

    revalidatePath('/dashboard')
    return { ok: true, data: org as Organization }
  }, RATE_LIMITS.sensitive)
}

/**
 * Get all organizations the current user belongs to.
 */
export async function getMyOrganizations(): Promise<ActionResultV2<Array<Organization & { role: OrgRole }>>> {
  return withUser(async ({ user, supabase }) => {
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        role,
        organizations (
          id,
          name,
          slug,
          settings,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })

    if (error) {
      return { ok: false, error: error.message }
    }

    const orgs = (data ?? [])
      .filter((m) => m.organizations)
      .map((m) => ({
        ...(m.organizations as unknown as Organization),
        role: m.role as OrgRole,
      }))

    return { ok: true, data: orgs }
  })
}

/**
 * Get members of the current user's active organization.
 * Requires at least 'admin' role to see member details.
 */
export async function getOrgMembers(): Promise<ActionResultV2<OrganizationMemberWithProfile[]>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!hasMinimumRole(role, 'admin')) {
      return { ok: false, error: 'Only admins can view member details' }
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('org_id', org.id)
      .order('joined_at', { ascending: true })

    if (error) {
      return { ok: false, error: error.message }
    }

    const members = (data ?? []) as OrganizationMember[]

    // Enrich with profile data
    const userIds = members.map((m) => m.user_id)
    const profileMap = new Map<string, { email: string; full_name: string | null }>()

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.id, { email: p.email, full_name: p.full_name })
        }
      }
    }

    const enriched: OrganizationMemberWithProfile[] = members.map((m) => ({
      ...m,
      email: profileMap.get(m.user_id)?.email ?? `user-${m.user_id.slice(0, 8)}`,
      full_name: profileMap.get(m.user_id)?.full_name ?? null,
    }))

    return { ok: true, data: enriched }
  })
}

/**
 * Update organization settings (name, features, branding).
 * Requires at least 'admin' role.
 */
export async function updateOrgSettings(
  orgId: string,
  updates: { name?: string; settings?: Record<string, unknown> }
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Only admins and owners can update org settings' }
    }

    const validation = updateOrgSettingsSchema.safeParse({ orgId, ...updates })
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Validation failed' }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.name) updateData.name = updates.name
    if (updates.settings) {
      // Deep merge settings
      const currentSettings = org.settings ?? {}
      updateData.settings = { ...currentSettings, ...updates.settings }
    }

    const { error } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', orgId)

    if (error) {
      return { ok: false, error: error.message }
    }

    logAuditEvent(supabase, org.id, user.id, 'settings.updated', {
      metadata: { changes: Object.keys(updates) },
    })

    revalidatePath('/dashboard')
    return { ok: true }
  }, orgId)
}

/**
 * Get activity summary for org members: completed session count per user.
 */
export async function getOrgMemberActivity(): Promise<ActionResultV2<Record<string, { completedSessions: number; lastActive: string | null }>>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Fetch completed assessment sessions for org members (capped at 5000)
    const { data: sessions } = await supabase
      .from('assessment_sessions')
      .select('user_id, status, completed_at')
      .eq('org_id', org.id)
      .eq('status', 'completed')
      .limit(5000)

    const activity: Record<string, { completedSessions: number; lastActive: string | null }> = {}
    for (const s of sessions || []) {
      if (!activity[s.user_id]) {
        activity[s.user_id] = { completedSessions: 0, lastActive: null }
      }
      activity[s.user_id].completedSessions++
      if (!activity[s.user_id].lastActive || (s.completed_at && s.completed_at > activity[s.user_id].lastActive!)) {
        activity[s.user_id].lastActive = s.completed_at
      }
    }

    return { ok: true, data: activity }
  })
}

/**
 * Update a member's role within the organization.
 * Requires 'owner' or 'admin' role. Cannot change own role or demote owners.
 */
export async function updateMemberRole(
  memberId: string,
  newRole: OrgRole
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Fetch the target member
    const { data: target, error: fetchError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('id', memberId)
      .eq('org_id', org.id)
      .single()

    if (fetchError || !target) {
      return { ok: false, error: 'Member not found' }
    }

    // Cannot change own role
    if (target.user_id === user.id) {
      return { ok: false, error: 'Cannot change your own role' }
    }

    // Only owner can promote to admin/owner
    if (newRole === 'owner' && role !== 'owner') {
      return { ok: false, error: 'Only owners can transfer ownership' }
    }

    // Cannot demote another owner unless you're owner
    if (target.role === 'owner' && role !== 'owner') {
      return { ok: false, error: 'Cannot modify owner role' }
    }

    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('id', memberId)
      .eq('org_id', org.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    logAuditEvent(supabase, org.id, user.id, 'member.role_changed', {
      targetType: 'user', targetId: target.user_id,
      metadata: { from: target.role, to: newRole },
    })

    revalidatePath('/dashboard')
    return { ok: true }
  })
}

/**
 * Remove a member from the organization.
 * Members can remove themselves. Admins/owners can remove others.
 * Cannot remove the last owner.
 */
export async function removeMember(
  memberId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    // Fetch the target member
    const { data: target, error: fetchError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('id', memberId)
      .eq('org_id', org.id)
      .single()

    if (fetchError || !target) {
      return { ok: false, error: 'Member not found' }
    }

    // Check permissions: self-removal always OK, otherwise need admin+
    const isSelf = target.user_id === user.id
    if (!isSelf && role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Insufficient permissions' }
    }

    // Only owners can remove other owners
    if (target.role === 'owner' && !isSelf && role !== 'owner') {
      return { ok: false, error: 'Only owners can remove other owners' }
    }

    // Cannot remove the last owner
    if (target.role === 'owner') {
      const { count } = await supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('role', 'owner')

      if ((count ?? 0) <= 1) {
        return { ok: false, error: 'Cannot remove the last owner' }
      }
    }

    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('org_id', org.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    logAuditEvent(supabase, org.id, user.id, 'member.removed', {
      targetType: 'user', targetId: target.user_id,
      metadata: { role: target.role, selfRemoval: isSelf },
    })

    revalidatePath('/dashboard')
    return { ok: true }
  })
}

/**
 * Check if a feature is enabled for the user's current org.
 */
export async function hasOrgFeature(
  featureName: string
): Promise<ActionResultV2<boolean>> {
  return withOrgUser(async ({ org }) => {
    const features = (org.settings?.features ?? {}) as unknown as Record<string, boolean>
    const enabled = features[featureName] ?? false
    return { ok: true, data: enabled }
  })
}

/**
 * Get assessment defaults for the current org.
 * Returns stored defaults or platform defaults.
 */
export async function getAssessmentDefaults(): Promise<ActionResultV2<AssessmentDefaults>> {
  return withOrgUser(async ({ org }) => {
    const defaults: AssessmentDefaults = {
      time_limit_minutes: 60,
      pass_score: 70,
      shuffle_questions: true,
      shuffle_options: false,
      show_results: true,
      allow_review: true,
      ...org.settings?.assessment_defaults,
    }
    return { ok: true, data: defaults }
  })
}

/**
 * Switch the user's active organization.
 * Verifies membership before setting the cookie.
 */
export async function switchOrganization(
  orgId: string
): Promise<ActionResultV2<void>> {
  return withUser(async ({ user, supabase }) => {
    // Verify user is a member of the target org
    const { data: membership, error } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single()

    if (error || !membership) {
      return { ok: false, error: 'You are not a member of this organization' }
    }

    // Set active org cookie
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })

    revalidatePath('/', 'layout')
    return { ok: true }
  })
}

/**
 * Transfer ownership to another member. Owner only.
 * Demotes current owner to admin.
 */
export async function transferOwnership(
  targetMemberId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (role !== 'owner') {
      return { ok: false, error: 'Only the owner can transfer ownership' }
    }

    // Fetch target member
    const { data: target } = await supabase
      .from('organization_members')
      .select('*')
      .eq('id', targetMemberId)
      .eq('org_id', org.id)
      .single()

    if (!target) return { ok: false, error: 'Member not found' }
    if (target.user_id === user.id) return { ok: false, error: 'Already the owner' }

    // Promote target to owner
    const { error: promoteErr } = await supabase
      .from('organization_members')
      .update({ role: 'owner' })
      .eq('id', targetMemberId)
      .eq('org_id', org.id)

    if (promoteErr) return { ok: false, error: promoteErr.message }

    // Demote self to admin
    const { error: demoteErr } = await supabase
      .from('organization_members')
      .update({ role: 'admin' })
      .eq('org_id', org.id)
      .eq('user_id', user.id)

    if (demoteErr) return { ok: false, error: demoteErr.message }

    logAuditEvent(supabase, org.id, user.id, 'ownership.transferred', {
      targetType: 'user', targetId: target.user_id,
    })

    revalidatePath('/', 'layout')
    return { ok: true }
  })
}

/**
 * Delete an organization. Owner only.
 * Removes all members, then deletes the org.
 */
export async function deleteOrganization(): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (role !== 'owner') {
      return { ok: false, error: 'Only the owner can delete the organization' }
    }

    // Delete the org directly — ON DELETE CASCADE handles members.
    // We must NOT delete members first: the DELETE RLS policy checks that
    // the current user is an owner, which requires the membership row to exist.
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id)

    if (error) return { ok: false, error: error.message }

    // Clear active org cookie
    const cookieStore = await cookies()
    cookieStore.delete(ACTIVE_ORG_COOKIE)

    revalidatePath('/', 'layout')
    return { ok: true }
  })
}

/**
 * Join an organization by slug as a candidate.
 * Used for self-registration via public join link.
 */
export async function joinOrgBySlug(
  slug: string
): Promise<ActionResultV2<{ orgName: string }>> {
  return withUser(async ({ user, supabase }) => {
    // Find org by slug
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (!org) {
      return { ok: false, error: 'Organization not found' }
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return { ok: false, error: 'You are already a member of this organization' }
    }

    // Add as candidate
    const { error } = await supabase
      .from('organization_members')
      .insert({
        org_id: org.id,
        user_id: user.id,
        role: 'candidate',
      })

    if (error) {
      return { ok: false, error: error.message }
    }

    // Set as active org
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_ORG_COOKIE, org.id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })

    revalidatePath('/', 'layout')
    return { ok: true, data: { orgName: org.name } }
  }, RATE_LIMITS.standard)
}
