'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { withOrgUser } from './_helpers'
import { canManageRoleProfiles, canAssignRoles } from '@/lib/skill-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { RoleProfile, RoleSkillRequirement, EmployeeRoleAssignment, SkillPriority } from '@/types/database'

// V20.6: Validation schemas for role actions
const updateRoleProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  description: z.string().max(500, 'Description too long').optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format').optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
})

/**
 * V19.1: Create a new role profile for the org.
 */
export async function createRoleProfile(input: {
  name: string
  description?: string
  color?: string
}): Promise<ActionResultV2<RoleProfile>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageRoleProfiles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { data, error } = await supabase
      .from('role_profiles')
      .insert({
        org_id: org.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        color: input.color || '#6366f1',
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'A role profile with this name already exists' }
      }
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data }
  })
}

/**
 * V19.1: Update a role profile.
 */
export async function updateRoleProfile(
  id: string,
  updates: { name?: string; description?: string; color?: string; sort_order?: number }
): Promise<ActionResultV2<RoleProfile>> {
  // V20.6: Validate ID format
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, error: 'Invalid role profile ID' }
  }

  // V20.6: Validate updates with Zod schema
  const validation = updateRoleProfileSchema.safeParse(updates)
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageRoleProfiles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const validated = validation.data
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (validated.name !== undefined) updateData.name = validated.name.trim()
    if (validated.description !== undefined) updateData.description = validated.description.trim() || null
    if (validated.color !== undefined) updateData.color = validated.color
    if (validated.sort_order !== undefined) updateData.sort_order = validated.sort_order

    const { data, error } = await supabase
      .from('role_profiles')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', org.id)
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data }
  })
}

/**
 * V19.1: Delete a role profile and all its requirements/assignments.
 */
export async function deleteRoleProfile(id: string): Promise<ActionResultV2<null>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageRoleProfiles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { error } = await supabase
      .from('role_profiles')
      .delete()
      .eq('id', id)
      .eq('org_id', org.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data: null }
  })
}

/**
 * V19.1: Get all role profiles for the org.
 */
export async function getOrgRoleProfiles(): Promise<ActionResultV2<(RoleProfile & { skill_count: number; employee_count: number })[]>> {
  return withOrgUser(async ({ supabase, org }) => {
    const { data, error } = await supabase
      .from('role_profiles')
      .select('*, role_skill_requirements(count), employee_role_assignments(count)')
      .eq('org_id', org.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, error: error.message }
    }

    const profiles = (data ?? []).map((row) => {
      const { role_skill_requirements, employee_role_assignments, ...profile } = row
      return {
        ...profile,
        skill_count: (role_skill_requirements as { count: number }[])?.[0]?.count ?? 0,
        employee_count: (employee_role_assignments as { count: number }[])?.[0]?.count ?? 0,
      }
    })

    return { ok: true, data: profiles }
  })
}

/**
 * V19.1: Get a single role profile with its skill requirements.
 */
export async function getRoleProfileWithRequirements(
  roleProfileId: string
): Promise<ActionResultV2<{
  profile: RoleProfile
  requirements: (RoleSkillRequirement & { skill_name: string; skill_color: string })[]
}>> {
  return withOrgUser(async ({ supabase, org }) => {
    const { data: profile, error: profileError } = await supabase
      .from('role_profiles')
      .select('*')
      .eq('id', roleProfileId)
      .eq('org_id', org.id)
      .single()

    if (profileError || !profile) {
      return { ok: false, error: 'Role profile not found' }
    }

    const { data: requirements, error: reqError } = await supabase
      .from('role_skill_requirements')
      .select('*, skill_domains!inner(name, color)')
      .eq('role_profile_id', roleProfileId)

    if (reqError) {
      return { ok: false, error: reqError.message }
    }

    const mappedRequirements = (requirements ?? []).map((row) => {
      const domain = row.skill_domains as unknown as { name: string; color: string }
      return {
        ...row,
        skill_name: domain.name,
        skill_color: domain.color,
        skill_domains: undefined,
      }
    })

    return { ok: true, data: { profile, requirements: mappedRequirements } }
  })
}

/**
 * V19.1: Set skill requirements for a role profile.
 * Replaces all existing requirements.
 */
export async function setRoleSkillRequirements(
  roleProfileId: string,
  requirements: { skill_domain_id: string; target_score: number; priority: SkillPriority }[]
): Promise<ActionResultV2<null>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageRoleProfiles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    // Verify the role profile belongs to this org
    const { data: profile } = await supabase
      .from('role_profiles')
      .select('id')
      .eq('id', roleProfileId)
      .eq('org_id', org.id)
      .single()

    if (!profile) {
      return { ok: false, error: 'Role profile not found' }
    }

    // Delete existing requirements
    await supabase
      .from('role_skill_requirements')
      .delete()
      .eq('role_profile_id', roleProfileId)

    // Insert new requirements
    if (requirements.length > 0) {
      const { error } = await supabase
        .from('role_skill_requirements')
        .insert(
          requirements.map((r) => ({
            role_profile_id: roleProfileId,
            skill_domain_id: r.skill_domain_id,
            target_score: r.target_score,
            priority: r.priority,
          }))
        )

      if (error) {
        return { ok: false, error: error.message }
      }
    }

    revalidatePath('/skills')
    return { ok: true, data: null }
  })
}

/**
 * V19.1: Assign an employee to a role profile.
 */
export async function assignEmployeeRole(
  userId: string,
  roleProfileId: string
): Promise<ActionResultV2<EmployeeRoleAssignment>> {
  return withOrgUser(async ({ user, supabase, org, role }) => {
    if (!canAssignRoles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { data, error } = await supabase
      .from('employee_role_assignments')
      .insert({
        org_id: org.id,
        user_id: userId,
        role_profile_id: roleProfileId,
        assigned_by: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return { ok: false, error: 'Employee already assigned to this role' }
      }
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data }
  })
}

/**
 * V19.1: Remove an employee from a role profile.
 */
export async function unassignEmployeeRole(
  userId: string,
  roleProfileId: string
): Promise<ActionResultV2<null>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canAssignRoles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { error } = await supabase
      .from('employee_role_assignments')
      .delete()
      .eq('org_id', org.id)
      .eq('user_id', userId)
      .eq('role_profile_id', roleProfileId)

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data: null }
  })
}

/**
 * V19.1: Get role assignments for a user (their assigned roles + gap analysis).
 */
export async function getEmployeeRoleGapAnalysis(
  userId?: string
): Promise<ActionResultV2<{
  roles: {
    profile: RoleProfile
    requirements: { skill_domain_id: string; skill_name: string; skill_color: string; target_score: number; priority: SkillPriority; actual_score: number | null }[]
  }[]
}>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const targetUserId = userId || user.id

    // Get role assignments
    const { data: assignments } = await supabase
      .from('employee_role_assignments')
      .select('role_profile_id, role_profiles!inner(*)')
      .eq('org_id', org.id)
      .eq('user_id', targetUserId)

    if (!assignments || assignments.length === 0) {
      return { ok: true, data: { roles: [] } }
    }

    // Get employee's skill scores
    const { data: scores } = await supabase
      .from('employee_skill_scores')
      .select('skill_domain_id, score')
      .eq('org_id', org.id)
      .eq('user_id', targetUserId)

    const scoreMap = new Map<string, number | null>()
    for (const s of scores ?? []) {
      scoreMap.set(s.skill_domain_id, s.score)
    }

    // Batch-fetch all requirements for assigned roles in a single query
    const roleProfileIds = assignments.map(
      (a) => (a.role_profiles as unknown as RoleProfile).id
    )

    const { data: allRequirements } = await supabase
      .from('role_skill_requirements')
      .select('*, skill_domains!inner(name, color)')
      .in('role_profile_id', roleProfileIds)

    // Group requirements by role_profile_id
    const reqsByRole = new Map<string, typeof allRequirements>()
    for (const r of allRequirements ?? []) {
      const list = reqsByRole.get(r.role_profile_id) ?? []
      list.push(r)
      reqsByRole.set(r.role_profile_id, list)
    }

    const roles = assignments.map((a) => {
      const profile = a.role_profiles as unknown as RoleProfile
      const requirements = reqsByRole.get(profile.id) ?? []

      const mappedReqs = requirements.map((r) => {
        const domain = r.skill_domains as unknown as { name: string; color: string }
        return {
          skill_domain_id: r.skill_domain_id,
          skill_name: domain.name,
          skill_color: domain.color,
          target_score: r.target_score,
          priority: r.priority as SkillPriority,
          actual_score: scoreMap.get(r.skill_domain_id) ?? null,
        }
      })

      return { profile, requirements: mappedReqs }
    })

    return { ok: true, data: { roles } }
  })
}

/**
 * V19.1: Get all employees assigned to a role profile (admin view).
 */
export async function getRoleProfileEmployees(
  roleProfileId: string
): Promise<ActionResultV2<{
  employees: { userId: string; email: string; fullName: string | null; assignedAt: string }[]
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canAssignRoles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { data: assignments } = await supabase
      .from('employee_role_assignments')
      .select('user_id, assigned_at')
      .eq('org_id', org.id)
      .eq('role_profile_id', roleProfileId)

    if (!assignments || assignments.length === 0) {
      return { ok: true, data: { employees: [] } }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', assignments.map((a) => a.user_id))

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { email: p.email || 'Unknown', fullName: p.full_name }])
    )

    const employees = assignments.map((a) => ({
      userId: a.user_id,
      email: profileMap.get(a.user_id)?.email ?? 'Unknown',
      fullName: profileMap.get(a.user_id)?.fullName ?? null,
      assignedAt: a.assigned_at,
    }))

    return { ok: true, data: { employees } }
  })
}

/**
 * V19.1: Get org members not yet assigned to a specific role (for assignment dropdown).
 */
export async function getUnassignedMembers(
  roleProfileId: string
): Promise<ActionResultV2<{ userId: string; email: string; fullName: string | null }[]>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canAssignRoles(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    // Get all org members
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('org_id', org.id)

    // Get already assigned
    const { data: assigned } = await supabase
      .from('employee_role_assignments')
      .select('user_id')
      .eq('org_id', org.id)
      .eq('role_profile_id', roleProfileId)

    const assignedSet = new Set((assigned ?? []).map((a) => a.user_id))
    const unassignedIds = (members ?? [])
      .map((m) => m.user_id)
      .filter((id) => !assignedSet.has(id))

    if (unassignedIds.length === 0) {
      return { ok: true, data: [] }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', unassignedIds)

    const result = (profiles ?? []).map((p) => ({
      userId: p.id,
      email: p.email || 'Unknown',
      fullName: p.full_name,
    }))

    return { ok: true, data: result }
  })
}
