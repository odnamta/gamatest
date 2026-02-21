'use server'

/**
 * V13: Invitation Server Actions
 * Manage member invitations for organizations.
 */

import { revalidatePath } from 'next/cache'
import { withUser, withOrgUser } from '@/actions/_helpers'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { inviteMemberSchema } from '@/lib/validations'
import type { ActionResultV2 } from '@/types/actions'
import type { Invitation, OrgRole } from '@/types/database'

/**
 * Invite a member to the organization by email.
 * Requires admin+ role. Creates a pending invitation with a unique token.
 */
export async function inviteMember(
  email: string,
  role: OrgRole
): Promise<ActionResultV2<Invitation>> {
  return withOrgUser(async ({ user, supabase, org, role: userRole }) => {
    if (userRole !== 'owner' && userRole !== 'admin') {
      return { ok: false, error: 'Only admins and owners can invite members' }
    }

    const validation = inviteMemberSchema.safeParse({ orgId: org.id, email, role })
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message ?? 'Validation failed' }
    }

    // Cannot invite as owner
    if (role === 'owner') {
      return { ok: false, error: 'Cannot invite someone as owner. Promote after joining.' }
    }

    // V20.6: Check if already a member — fetch user ID first to avoid nested query
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (targetProfile) {
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('org_id', org.id)
        .eq('user_id', targetProfile.id)
        .maybeSingle()

      if (existingMember) {
        return { ok: false, error: 'This user is already a member' }
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('org_id', org.id)
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existingInvite) {
      return { ok: false, error: 'An invitation is already pending for this email' }
    }

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        org_id: org.id,
        email,
        role,
        invited_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: invitation as Invitation }
  })
}

/**
 * Get all pending invitations for the current org.
 * Admin+ only.
 */
export async function getOrgInvitations(): Promise<ActionResultV2<Invitation[]>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('org_id', org.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: (data ?? []) as Invitation[] }
  })
}

/**
 * Accept an invitation using the token.
 * Creates org membership for the authenticated user.
 */
export async function acceptInvitation(
  token: string
): Promise<ActionResultV2<void>> {
  return withUser(async ({ user, supabase }) => {
    // Use service client for invitation operations — the token itself is the
    // auth proof; the invited user has no RLS-based access to the invitations table.
    const serviceClient = await createSupabaseServiceClient()

    // Find the invitation
    const { data: invitation, error: fetchError } = await serviceClient
      .from('invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (fetchError || !invitation) {
      return { ok: false, error: 'Invalid or expired invitation' }
    }

    // Check email matches (if user has email)
    if (user.email && invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return { ok: false, error: 'This invitation was sent to a different email address' }
    }

    // Check not already a member
    const { data: existing } = await supabase
      .from('organization_members')
      .select('id')
      .eq('org_id', invitation.org_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Mark invitation as accepted even if already member
      await serviceClient
        .from('invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id)
      return { ok: false, error: 'You are already a member of this organization' }
    }

    // Create membership (regular client — user is joining, RLS allows this)
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        org_id: invitation.org_id,
        user_id: user.id,
        role: invitation.role,
      })

    if (memberError) {
      return { ok: false, error: 'Failed to join organization' }
    }

    // Mark invitation as accepted
    await serviceClient
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    revalidatePath('/dashboard')
    return { ok: true }
  })
}

/**
 * Revoke a pending invitation.
 * Admin+ only.
 */
export async function revokeInvitation(
  invitationId: string
): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ supabase, org, role }) => {
    if (role !== 'owner' && role !== 'admin') {
      return { ok: false, error: 'Insufficient permissions' }
    }

    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', invitationId)
      .eq('org_id', org.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true }
  })
}
