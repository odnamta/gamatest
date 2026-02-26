'use server'

import { revalidatePath } from 'next/cache'
import { withUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Updates user profile metadata (display name).
 *
 * @param displayName - The user's display name
 * @returns ActionResultV2 with success status
 */
export async function updateUserProfile(
  displayName: string
): Promise<ActionResultV2> {
  return withUser(async ({ user, supabase }) => {
    try {
      const updateData: Record<string, unknown> = {}
      if (displayName !== undefined) {
        updateData.full_name = displayName
        updateData.name = displayName
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: { ...user.user_metadata, ...updateData },
      })

      if (updateError) {
        return { ok: false, error: 'Unable to update profile. Please try again.' }
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

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, RATE_LIMITS.sensitive)
}
