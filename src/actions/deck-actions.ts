'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { createDeckSchema } from '@/lib/validations'
import type { ActionResult } from '@/types/actions'

/**
 * Server Action for creating a new deck.
 * Validates input with Zod and creates deck via Supabase.
 * Requirements: 2.1, 9.3
 * 
 * When used with useActionState, the first argument is the previous state
 * and the second argument is the FormData.
 */
export async function createDeckAction(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    title: formData.get('title'),
  }

  // Server-side Zod validation (Requirement 9.3)
  const validationResult = createDeckSchema.safeParse(rawData)
  
  if (!validationResult.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of validationResult.error.issues) {
      const field = issue.path[0] as string
      if (!fieldErrors[field]) {
        fieldErrors[field] = []
      }
      fieldErrors[field].push(issue.message)
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const { title } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // Create new deck linked to authenticated user (Requirement 2.1)
  const { data, error } = await supabase
    .from('decks')
    .insert({
      user_id: user.id,
      title,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate dashboard to show new deck
  revalidatePath('/dashboard')

  return { success: true, data }
}

/**
 * Server Action for deleting a deck.
 * Removes the deck and all associated cards (via cascade delete).
 * Requirements: 2.3, 9.3
 */
export async function deleteDeckAction(deckId: string): Promise<ActionResult> {
  // Validate deckId is a valid UUID
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return { success: false, error: 'Invalid deck ID' }
  }

  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Delete deck (RLS ensures user can only delete own decks)
  // Cascade delete removes all associated cards (Requirement 2.3)
  const { error } = await supabase
    .from('decks')
    .delete()
    .eq('id', deckId)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidate dashboard to reflect deletion
  revalidatePath('/dashboard')

  return { success: true }
}


/**
 * Server Action for fetching all user's decks.
 * V6.3: Used by ConfigureSessionModal for deck selection.
 */
export async function getUserDecks(): Promise<{ id: string; title: string }[]> {
  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('decks')
    .select('id, title')
    .eq('user_id', user.id)
    .order('title', { ascending: true })

  if (error) {
    console.error('Failed to fetch user decks:', error)
    return []
  }

  return data || []
}
