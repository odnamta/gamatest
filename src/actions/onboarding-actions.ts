'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'

/**
 * Result type for profile update actions
 */
export interface ProfileUpdateResult {
  success: boolean
  error?: string
}

/**
 * Updates user profile metadata (display name).
 *
 * @param displayName - The user's display name
 * @returns ProfileUpdateResult with success status
 */
export async function updateUserProfile(
  displayName: string
): Promise<ProfileUpdateResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  const updateData: Record<string, unknown> = {}
  if (displayName !== undefined) {
    updateData.full_name = displayName
    updateData.name = displayName
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: { ...user.user_metadata, ...updateData },
  })

  if (updateError) {
    return { success: false, error: 'Unable to update profile. Please try again.' }
  }

  // Sync full_name to profiles table
  if (displayName !== undefined) {
    await supabase
      .from('profiles')
      .update({ full_name: displayName })
      .eq('id', user.id)
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')

  return { success: true }
}
