'use server'

import { revalidatePath } from 'next/cache'
import { withOrgUser } from './_helpers'
import { canManageSkillDomains, canLinkDeckToSkill, canViewOrgSkillScores } from '@/lib/skill-authorization'
import type { ActionResultV2 } from '@/types/actions'
import type { SkillDomain, EmployeeSkillScore } from '@/types/database'

/**
 * V19: Create a new skill domain for the org.
 */
export async function createSkillDomain(input: {
  name: string
  description?: string
  color?: string
}): Promise<ActionResultV2<SkillDomain>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageSkillDomains(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { data, error } = await supabase
      .from('skill_domains')
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
        return { ok: false, error: 'A skill domain with this name already exists' }
      }
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data }
  })
}

/**
 * V19: Update an existing skill domain.
 */
export async function updateSkillDomain(
  id: string,
  updates: { name?: string; description?: string; color?: string; sort_order?: number }
): Promise<ActionResultV2<SkillDomain>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageSkillDomains(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const updateData: Record<string, unknown> = {}
    if (updates.name !== undefined) updateData.name = updates.name.trim()
    if (updates.description !== undefined) updateData.description = updates.description.trim() || null
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order

    const { data, error } = await supabase
      .from('skill_domains')
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
 * V19: Delete a skill domain.
 */
export async function deleteSkillDomain(id: string): Promise<ActionResultV2<null>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canManageSkillDomains(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    const { error } = await supabase
      .from('skill_domains')
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
 * V19: Get all skill domains for the current org.
 */
export async function getOrgSkillDomains(): Promise<ActionResultV2<SkillDomain[]>> {
  return withOrgUser(async ({ supabase, org }) => {
    const { data, error } = await supabase
      .from('skill_domains')
      .select('*')
      .eq('org_id', org.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: data ?? [] }
  })
}

/**
 * V19: Link a deck template to a skill domain.
 */
export async function linkDeckToSkill(
  deckTemplateId: string,
  skillDomainId: string
): Promise<ActionResultV2<null>> {
  return withOrgUser(async ({ supabase, role }) => {
    if (!canLinkDeckToSkill(role)) {
      return { ok: false, error: 'Creator access required' }
    }

    const { error } = await supabase
      .from('deck_skill_mappings')
      .insert({ deck_template_id: deckTemplateId, skill_domain_id: skillDomainId })

    if (error) {
      if (error.code === '23505') {
        return { ok: true, data: null } // Already linked, that's fine
      }
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    revalidatePath(`/decks/${deckTemplateId}`)
    return { ok: true, data: null }
  })
}

/**
 * V19: Unlink a deck template from a skill domain.
 */
export async function unlinkDeckFromSkill(
  deckTemplateId: string,
  skillDomainId: string
): Promise<ActionResultV2<null>> {
  return withOrgUser(async ({ supabase, role }) => {
    if (!canLinkDeckToSkill(role)) {
      return { ok: false, error: 'Creator access required' }
    }

    const { error } = await supabase
      .from('deck_skill_mappings')
      .delete()
      .eq('deck_template_id', deckTemplateId)
      .eq('skill_domain_id', skillDomainId)

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/skills')
    return { ok: true, data: null }
  })
}

/**
 * V19: Get skill scores for a user (or current user if no userId).
 */
export async function getEmployeeSkillScores(
  userId?: string
): Promise<ActionResultV2<(EmployeeSkillScore & { skill_name: string; skill_color: string })[]>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const targetUserId = userId || user.id

    const { data, error } = await supabase
      .from('employee_skill_scores')
      .select('*, skill_domains!inner(name, color)')
      .eq('org_id', org.id)
      .eq('user_id', targetUserId)

    if (error) {
      return { ok: false, error: error.message }
    }

    const scores = (data ?? []).map((row) => {
      const domain = row.skill_domains as unknown as { name: string; color: string }
      return {
        ...row,
        skill_name: domain.name,
        skill_color: domain.color,
        skill_domains: undefined,
      }
    })

    return { ok: true, data: scores }
  })
}

/**
 * V19: Get org-wide skill heatmap (employees × skills matrix).
 * Admin+ only.
 */
export async function getOrgSkillHeatmap(): Promise<ActionResultV2<{
  domains: { id: string; name: string; color: string }[]
  employees: { userId: string; email: string; scores: Record<string, number | null> }[]
}>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (!canViewOrgSkillScores(role)) {
      return { ok: false, error: 'Admin access required' }
    }

    // Get all skill domains
    const { data: domains } = await supabase
      .from('skill_domains')
      .select('id, name, color')
      .eq('org_id', org.id)
      .order('sort_order')

    if (!domains || domains.length === 0) {
      return { ok: true, data: { domains: [], employees: [] } }
    }

    // Get all employee skill scores
    const { data: allScores } = await supabase
      .from('employee_skill_scores')
      .select('user_id, skill_domain_id, score')
      .eq('org_id', org.id)

    // Get org members with emails
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, profiles!inner(full_name)')
      .eq('org_id', org.id)

    // Also get auth emails via profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', (members ?? []).map((m) => m.user_id))

    const profileMap = new Map<string, { email: string; name: string }>()
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { email: p.email || 'Unknown', name: p.full_name || '' })
    }

    // Build matrix
    const scoreMap = new Map<string, Record<string, number | null>>()
    for (const s of allScores ?? []) {
      if (!scoreMap.has(s.user_id)) {
        scoreMap.set(s.user_id, {})
      }
      scoreMap.get(s.user_id)![s.skill_domain_id] = s.score
    }

    const employees = Array.from(scoreMap.entries()).map(([userId, scores]) => ({
      userId,
      email: profileMap.get(userId)?.email ?? 'Unknown',
      scores,
    }))

    return {
      ok: true,
      data: {
        domains: domains.map((d) => ({ id: d.id, name: d.name, color: d.color })),
        employees,
      },
    }
  })
}
