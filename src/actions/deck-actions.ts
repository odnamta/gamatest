'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { withUser, withOrgUser, type AuthContext, type OrgAuthContext } from './_helpers'
import { createDeckSchema } from '@/lib/validations'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { formatZodErrors } from '@/lib/zod-utils'
import type { ActionResultV2 } from '@/types/actions'

/**
 * V8.0/V9.1: Server Action for creating a new deck.
 * Creates deck_template and auto-subscribes author via user_decks.
 * V9.1: Added subject field for multi-specialty AI support.
 * Requirements: 2.1, 9.3, V8 2.2, V9.1 3.1
 */
export async function createDeckAction(
  prevState: ActionResultV2,
  formData: FormData
): Promise<ActionResultV2> {
  const rawData = { title: formData.get('title') }

  const validationResult = createDeckSchema.safeParse(rawData)
  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  // Rate limit check
  const rateLimitResult = checkRateLimit(`user:${user.id}:createDeck`, RATE_LIMITS.standard)
  if (!rateLimitResult.allowed) {
    return { ok: false, error: 'Rate limit exceeded. Please try again later.' }
  }

  const { title } = validationResult.data
  // V9.1: Get subject from form data, default to General
  const subject = (formData.get('subject') as string)?.trim() || 'General'

  const supabase = await createSupabaseServerClient()

  // V13: Resolve user's active org for content scoping
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (!membership?.org_id) {
    return { ok: false, error: 'No active organization found. Please join an organization first.' }
  }

  // V8.0/V9.1/V13: Create deck_template with subject and org_id
  const { data: deckTemplate, error: createError } = await supabase
    .from('deck_templates')
    .insert({ title, author_id: user.id, visibility: 'private', subject, org_id: membership.org_id })
    .select()
    .single()

  if (createError) {
    return { ok: false, error: createError.message }
  }

  // V8.0: Auto-subscribe author via user_decks
  await supabase.from('user_decks').insert({
    user_id: user.id,
    deck_template_id: deckTemplate.id,
    is_active: true,
  })

  revalidatePath('/dashboard')
  return { ok: true, data: deckTemplate }
}

/**
 * V8.0: Server Action for deleting a deck.
 * V11.5.1: Refactored to use withUser helper.
 * Deletes deck_template (cascade handles card_templates).
 * Requirements: 2.3, 9.3, V8 2.4
 */
export async function deleteDeckAction(deckId: string): Promise<ActionResultV2> {
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return { ok: false, error: 'Invalid deck ID' }
  }

  return withOrgUser(async ({ user, supabase }: OrgAuthContext) => {
    // V8.0/V13: Delete deck_template (cascade handles card_templates, user_decks)
    const { error } = await supabase
      .from('deck_templates')
      .delete()
      .eq('id', deckId)
      .eq('author_id', user.id)

    if (error) {
      return { ok: false, error: error.message }
    }

    revalidatePath('/dashboard')
    return { ok: true }
  }, undefined, RATE_LIMITS.standard)
}


/**
 * V8.0: Server Action for fetching all user's deck_templates.
 * V11.5.1: Refactored to use withUser helper.
 * Queries user_decks joined with deck_templates.
 * Requirements: V8 2.1
 */
export async function getUserDecks(): Promise<{ id: string; title: string }[]> {
  const result = await withUser(async ({ user, supabase }: AuthContext) => {
    // V8.0: Query user_decks joined with deck_templates
    const { data: userDecks, error } = await supabase
      .from('user_decks')
      .select(`deck_template_id, deck_templates!inner(id, title)`)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error) {
      console.error('Failed to fetch user decks:', error)
      return { ok: true as const, data: [] as { id: string; title: string }[] }
    }

    const decks = (userDecks || []).map(ud => {
      const dt = ud.deck_templates as unknown as { id: string; title: string }
      return { id: dt.id, title: dt.title }
    }).sort((a, b) => a.title.localeCompare(b.title))

    return { ok: true as const, data: decks }
  })

  // Return empty array if auth failed
  if (!result.ok) return []
  return result.data ?? []
}


// ============================================
// V6.4: Shared Library V2 Functions
// ============================================

import type { DeckTemplate, DeckTemplateWithDueCount } from '@/types/database'
import { CARD_STATUS } from '@/lib/constants'

/**
 * V11.5.1: Extended deck type with draft count for authors
 */
export interface DeckTemplateWithCounts extends DeckTemplateWithDueCount {
  draft_count: number
  isAuthor: boolean
}

/**
 * Fetches user's deck_templates (authored + subscribed via user_decks).
 * Includes due count from user_card_progress.
 * V11.5.1: Also includes draft_count for author's decks. Refactored to use withUser.
 * 
 * V6.4: Shared Library Read Path
 */
export async function getDeckTemplates(): Promise<DeckTemplateWithCounts[]> {
  const result = await withUser(async ({ user, supabase }: AuthContext) => {
    const now = new Date().toISOString()

    // Get user's subscribed deck_templates via user_decks
    const { data: userDecks, error: userDecksError } = await supabase
      .from('user_decks')
      .select(`
        deck_template_id,
        deck_templates!inner(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (userDecksError) {
      console.error('Failed to fetch deck templates:', userDecksError)
      return { ok: true as const, data: [] as DeckTemplateWithCounts[] }
    }

    if (!userDecks || userDecks.length === 0) {
      return { ok: true as const, data: [] as DeckTemplateWithCounts[] }
    }

    // Get due counts for each deck_template
    const deckTemplateIds = userDecks.map(ud => ud.deck_template_id)
    
    // V11.5.1: Get all card_templates with status for draft counting
    const { data: cardTemplates, error: ctError } = await supabase
      .from('card_templates')
      .select('id, deck_template_id, status')
      .in('deck_template_id', deckTemplateIds)

    if (ctError) {
      console.error('Failed to fetch card templates:', ctError)
    }

    // Create map of card_template_id -> deck_template_id
    const cardToDeckMap = new Map<string, string>()
    for (const ct of cardTemplates || []) {
      cardToDeckMap.set(ct.id, ct.deck_template_id)
    }

    // V11.5.1: Build draft count map (only for author's decks)
    const draftCountMap = new Map<string, number>()
    for (const ct of cardTemplates || []) {
      if (ct.status === CARD_STATUS.Draft) {
        draftCountMap.set(ct.deck_template_id, (draftCountMap.get(ct.deck_template_id) || 0) + 1)
      }
    }

    // Get due progress records
    const cardTemplateIdList = Array.from(cardToDeckMap.keys())
    const { data: dueProgress, error: dueError } = await supabase
      .from('user_card_progress')
      .select('card_template_id')
      .eq('user_id', user.id)
      .lte('next_review', now)
      .eq('suspended', false)
      .in('card_template_id', cardTemplateIdList)

    if (dueError) {
      console.error('Failed to fetch due counts:', dueError)
    }

    // Build due count map
    const dueCountMap = new Map<string, number>()
    for (const record of dueProgress || []) {
      const deckTemplateId = cardToDeckMap.get(record.card_template_id)
      if (deckTemplateId) {
        dueCountMap.set(deckTemplateId, (dueCountMap.get(deckTemplateId) || 0) + 1)
      }
    }

    // Map to DeckTemplateWithCounts
    const decks = userDecks.map(ud => {
      const dt = ud.deck_templates as unknown as DeckTemplate
      const isAuthor = dt.author_id === user.id
      return {
        ...dt,
        due_count: dueCountMap.get(dt.id) || 0,
        // V11.5.1: Only include draft_count for author's decks
        draft_count: isAuthor ? (draftCountMap.get(dt.id) || 0) : 0,
        isAuthor,
      }
    })

    return { ok: true as const, data: decks }
  })

  // Return empty array if auth failed
  if (!result.ok) return []
  return result.data ?? []
}

/**
 * Fetches user's deck_templates for dropdown selection.
 * V11.5.1: Refactored to use withUser helper.
 * Simpler version without due counts.
 * 
 * V6.4: Used by ConfigureSessionModal for deck selection.
 */
export async function getUserDeckTemplates(): Promise<{ id: string; title: string }[]> {
  const result = await withUser(async ({ user, supabase }: AuthContext) => {
    const { data: userDecks, error } = await supabase
      .from('user_decks')
      .select(`
        deck_template_id,
        deck_templates!inner(id, title)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (error) {
      console.error('Failed to fetch user deck templates:', error)
      return { ok: true as const, data: [] as { id: string; title: string }[] }
    }

    const decks = (userDecks || []).map(ud => {
      const dt = ud.deck_templates as unknown as { id: string; title: string }
      return { id: dt.id, title: dt.title }
    }).sort((a, b) => a.title.localeCompare(b.title))

    return { ok: true as const, data: decks }
  })

  // Return empty array if auth failed
  if (!result.ok) return []
  return result.data ?? []
}

/**
 * Creates a new deck_template and auto-subscribes the author.
 * 
 * V6.4: Write Path
 */
export async function createDeckTemplateAction(
  prevState: ActionResultV2,
  formData: FormData
): Promise<ActionResultV2> {
  const rawData = {
    title: formData.get('title'),
  }

  const validationResult = createDeckSchema.safeParse(rawData)

  if (!validationResult.success) {
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  // Rate limit check
  const rateLimitResult = checkRateLimit(`user:${user.id}:createDeckTemplate`, RATE_LIMITS.standard)
  if (!rateLimitResult.allowed) {
    return { ok: false, error: 'Rate limit exceeded. Please try again later.' }
  }

  const { title } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // V13: Resolve user's active org for content scoping
  const { data: membership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()

  if (!membership?.org_id) {
    return { ok: false, error: 'No active organization found' }
  }

  // V13: Create deck_template with org_id
  const { data: deckTemplate, error: createError } = await supabase
    .from('deck_templates')
    .insert({
      title,
      author_id: user.id,
      visibility: 'private',
      org_id: membership.org_id,
    })
    .select()
    .single()

  if (createError) {
    return { ok: false, error: createError.message }
  }

  // Auto-subscribe author via user_decks
  const { error: subscribeError } = await supabase
    .from('user_decks')
    .insert({
      user_id: user.id,
      deck_template_id: deckTemplate.id,
      is_active: true,
    })

  if (subscribeError) {
    console.error('Failed to auto-subscribe author:', subscribeError)
    // Don't fail the whole operation, deck was created
  }

  revalidatePath('/dashboard')

  return { ok: true, data: deckTemplate }
}


// ============================================
// V8.6: Deck Renaming
// ============================================

/**
 * V8.6: Server Action for updating a deck's title.
 * Only the author can rename their deck.
 * 
 * Requirements: 3.2, 3.3
 * 
 * @param deckId - The deck_template ID to update
 * @param newTitle - The new title (1-100 characters)
 * @returns ActionResultV2 with ok/error
 */
export async function updateDeckTitle(
  deckId: string,
  newTitle: string
): Promise<ActionResultV2<{ title: string }>> {
  // Validate deck ID format
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return { ok: false, error: 'Invalid deck ID' }
  }

  // Validate title length (1-100 characters)
  const trimmedTitle = newTitle.trim()
  if (!trimmedTitle || trimmedTitle.length < 1) {
    return { ok: false, error: 'Title cannot be empty' }
  }
  if (trimmedTitle.length > 100) {
    return { ok: false, error: 'Title must be at most 100 characters' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // V8.6: Fetch deck to verify author
  const { data: deckTemplate, error: fetchError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (fetchError || !deckTemplate) {
    return { ok: false, error: 'Deck not found' }
  }

  // V8.6: Check user is author
  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: 'Only the author can rename this deck' }
  }

  // V8.6: Update the title
  const { error: updateError } = await supabase
    .from('deck_templates')
    .update({ title: trimmedTitle })
    .eq('id', deckId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate paths
  revalidatePath(`/decks/${deckId}`)
  revalidatePath('/dashboard')

  return { ok: true, data: { title: trimmedTitle } }
}


// ============================================
// V9.1: Deck Subject Management
// ============================================

/**
 * V9.1: Server Action for updating a deck's subject.
 * Only the author can change the subject.
 * 
 * Requirements: V9.1 3.2
 * 
 * @param deckId - The deck_template ID to update
 * @param newSubject - The new subject area
 * @returns ActionResultV2 with ok/error
 */
export async function updateDeckSubject(
  deckId: string,
  newSubject: string
): Promise<ActionResultV2<{ subject: string }>> {
  // Validate deck ID format
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return { ok: false, error: 'Invalid deck ID' }
  }

  // Validate subject (allow empty to reset to default)
  const trimmedSubject = newSubject.trim() || 'General'
  if (trimmedSubject.length > 100) {
    return { ok: false, error: 'Subject must be at most 100 characters' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch deck to verify author
  const { data: deckTemplate, error: fetchError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (fetchError || !deckTemplate) {
    return { ok: false, error: 'Deck not found' }
  }

  // Check user is author
  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: 'Only the author can change the subject' }
  }

  // Update the subject
  const { error: updateError } = await supabase
    .from('deck_templates')
    .update({ subject: trimmedSubject })
    .eq('id', deckId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate paths
  revalidatePath(`/decks/${deckId}`)
  revalidatePath(`/decks/${deckId}/add-bulk`)

  return { ok: true, data: { subject: trimmedSubject } }
}

/**
 * V9.1: Get deck subject for AI operations.
 * Returns the subject or default if not set.
 * 
 * @param deckId - The deck_template ID
 * @returns Subject string or default
 */
export async function getDeckSubject(deckId: string): Promise<string> {
  const supabase = await createSupabaseServerClient()
  
  const { data: deckTemplate } = await supabase
    .from('deck_templates')
    .select('subject')
    .eq('id', deckId)
    .single()

  return deckTemplate?.subject?.trim() || 'General'
}


// ============================================
// V10.6.1: Author Progress Sync
// ============================================

/**
 * V10.6.1: Sync author progress for a deck.
 * Creates user_card_progress rows for all cards the author doesn't have progress for.
 * Uses ON CONFLICT DO NOTHING for idempotency.
 * 
 * This fixes the "0 Cards Due" issue for authors who create decks but haven't studied yet.
 * 
 * @param deckId - The deck_template ID to sync
 * @returns ActionResultV2 with ok/error
 */
export async function syncAuthorProgress(deckId: string): Promise<ActionResultV2<{ synced: number }>> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify user is author
  const { data: deck, error: deckError } = await supabase
    .from('deck_templates')
    .select('author_id')
    .eq('id', deckId)
    .single()

  if (deckError || !deck) {
    return { ok: false, error: 'Deck not found' }
  }

  if (deck.author_id !== user.id) {
    return { ok: false, error: 'Only the author can sync progress' }
  }

  // Get all card IDs in this deck
  const { data: cards, error: cardsError } = await supabase
    .from('card_templates')
    .select('id')
    .eq('deck_template_id', deckId)

  if (cardsError) {
    return { ok: false, error: cardsError.message }
  }

  if (!cards || cards.length === 0) {
    return { ok: true, data: { synced: 0 } }
  }

  // Bulk insert progress rows (ON CONFLICT DO NOTHING)
  const progressRows = cards.map(card => ({
    user_id: user.id,
    card_template_id: card.id,
    interval: 0,
    ease_factor: 2.5,
    repetitions: 0,
    next_review: new Date().toISOString(),
    suspended: false,
    correct_count: 0,
    total_attempts: 0,
    is_flagged: false,
  }))

  const { error: upsertError } = await supabase
    .from('user_card_progress')
    .upsert(progressRows, {
      onConflict: 'user_id,card_template_id',
      ignoreDuplicates: true,
    })

  if (upsertError) {
    return { ok: false, error: upsertError.message }
  }

  revalidatePath(`/decks/${deckId}`)
  revalidatePath('/study')
  revalidatePath('/dashboard')

  return { ok: true, data: { synced: cards.length } }
}


// ============================================
// V10.4: Deck Visibility Management
// ============================================

import type { DeckVisibility } from '@/types/database'

/**
 * V10.4: Server Action for updating a deck's visibility.
 * Only the author can change visibility settings.
 * 
 * Requirements: 5.1, 5.4, 5.5
 * 
 * @param deckId - The deck_template ID to update
 * @param visibility - The new visibility setting ('private' | 'public')
 * @returns ActionResultV2 with ok/error
 */
export async function updateDeckVisibilityAction(
  deckId: string,
  visibility: DeckVisibility
): Promise<ActionResultV2<{ visibility: DeckVisibility }>> {
  // Validate deck ID format
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return { ok: false, error: 'Invalid deck ID' }
  }

  // Validate visibility value
  if (visibility !== 'private' && visibility !== 'public') {
    return { ok: false, error: 'Invalid visibility value. Must be "private" or "public"' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch deck to verify author
  const { data: deckTemplate, error: fetchError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (fetchError || !deckTemplate) {
    return { ok: false, error: 'Deck not found' }
  }

  // Check user is author - only authors can change visibility
  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: 'Only the author can change deck visibility' }
  }

  // Update the visibility
  const { error: updateError } = await supabase
    .from('deck_templates')
    .update({ visibility })
    .eq('id', deckId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate paths
  revalidatePath(`/decks/${deckId}`)
  revalidatePath('/library')
  revalidatePath('/dashboard')

  return { ok: true, data: { visibility } }
}
