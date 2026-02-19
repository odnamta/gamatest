/**
 * V13: Organization Context — Server-side resolution
 *
 * Resolves the user's active organization from:
 * 1. The `active_org_id` cookie (if set)
 * 2. The user's first organization membership (fallback)
 *
 * Used by the (app) layout to provide org context to all pages.
 */

import { cookies } from 'next/headers'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import type { Organization, OrgRole } from '@/types/database'

export const ACTIVE_ORG_COOKIE = 'cekatan_active_org_id'

export interface OrgContext {
  org: Organization
  role: OrgRole
}

/**
 * Resolves the active organization for the current user.
 * Returns null if user has no org memberships.
 */
export async function resolveActiveOrg(): Promise<OrgContext | null> {
  const user = await getUser()
  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value

  // Build query for org membership
  let query = supabase
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

  // If we have a saved org preference, try that first
  if (savedOrgId) {
    query = query.eq('org_id', savedOrgId)
  }

  const { data: membership, error } = await query
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  // If saved org didn't work (e.g. user was removed), fall back to first org
  if ((error || !membership) && savedOrgId) {
    const { data: fallback } = await supabase
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
      .limit(1)
      .single()

    if (!fallback || !fallback.organizations) return null

    return {
      org: fallback.organizations as unknown as Organization,
      role: fallback.role as OrgRole,
    }
  }

  if (!membership || !membership.organizations) return null

  return {
    org: membership.organizations as unknown as Organization,
    role: membership.role as OrgRole,
  }
}
