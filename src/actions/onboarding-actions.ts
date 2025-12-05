'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { isSupportedSpecialty } from '@/lib/onboarding-constants'

/**
 * Result type for enrollment actions
 * Requirements: 4.1, 4.2
 */
export interface EnrollResult {
  success: boolean
  enrolledCount: number
  error?: string
}

/**
 * Enrolls a user in the starter pack for their selected specialty.
 * Creates user_decks subscription records for all public decks.
 * Uses upsert to prevent duplicate subscriptions.
 * 
 * Requirements: 4.1, 4.2, 4.4, 4.5
 * 
 * @param specialty - The user's selected specialty (e.g., 'OBGYN')
 * @returns EnrollResult with success status and count of enrolled decks
 */
export async function enrollInStarterPack(specialty: string): Promise<EnrollResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, enrolledCount: 0, error: 'Authentication required' }
  }

  // For V1, only OBGYN is supported
  if (!isSupportedSpecialty(specialty)) {
    // Gracefully handle unsupported specialties - just return success with 0 enrollments
    return { success: true, enrolledCount: 0 }
  }

  const supabase = await createSupabaseServerClient()

  // Get all public deck templates for the starter pack
  // For V1, we enroll users in ALL public decks (OBGYN content)
  const { data: publicDecks, error: decksError } = await supabase
    .from('deck_templates')
    .select('id')
    .eq('visibility', 'public')

  if (decksError) {
    return { success: false, enrolledCount: 0, error: decksError.message }
  }

  if (!publicDecks || publicDecks.length === 0) {
    // No public decks available - still success, just nothing to enroll
    return { success: true, enrolledCount: 0 }
  }

  // Upsert subscriptions for each deck (prevents duplicates)
  // Requirements: 4.2 - is_active = true, 4.4 - upsert logic
  const subscriptions = publicDecks.map(deck => ({
    user_id: user.id,
    deck_template_id: deck.id,
    is_active: true,
  }))

  const { error: upsertError } = await supabase
    .from('user_decks')
    .upsert(subscriptions, {
      onConflict: 'user_id,deck_template_id',
    })

  if (upsertError) {
    return { success: false, enrolledCount: 0, error: upsertError.message }
  }

  // Revalidate paths so dashboard shows enrolled decks
  // Requirements: 4.5
  revalidatePath('/dashboard')
  revalidatePath('/library')
  revalidatePath('/library/my')

  return { success: true, enrolledCount: publicDecks.length }
}
