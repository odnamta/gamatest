'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { createCardSchema } from '@/lib/validations'
import { getCardDefaults } from '@/lib/card-defaults'
import type { ActionResult } from '@/types/actions'

/**
 * V8.0: Server Action for creating a new card (flashcard).
 * Creates card_template and user_card_progress in V2 schema.
 * Requirements: 3.1, 3.2, 9.3, V8 2.2
 */
export async function createCardAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const rawData = {
    deckId: formData.get('deckId'),
    front: formData.get('front'),
    back: formData.get('back'),
    imageUrl: formData.get('imageUrl') || '',
  }

  // Parse tag IDs from form data
  const tagIds: string[] = []
  let t = 0
  while (formData.has(`tagId_${t}`)) {
    const tagId = formData.get(`tagId_${t}`)
    if (typeof tagId === 'string') {
      tagIds.push(tagId)
    }
    t++
  }

  // Server-side Zod validation (Requirement 9.3)
  const validationResult = createCardSchema.safeParse(rawData)
  
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

  const { deckId, front, back } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // V8.0: Verify user owns the deck_template (not legacy deck)
  const { data: deckTemplate, error: deckError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (deckError || !deckTemplate) {
    return { success: false, error: 'Deck not found in V2 schema. Please run migration.' }
  }

  if (deckTemplate.author_id !== user.id) {
    return { success: false, error: 'Access denied' }
  }

  // V8.0: Create card_template (flashcards stored as MCQ with front/back as stem/explanation)
  // V11.2: Include author_id (required field)
  const { data: cardTemplate, error: insertError } = await supabase
    .from('card_templates')
    .insert({
      deck_template_id: deckId,
      author_id: user.id,
      stem: front,
      options: ['True', 'False'], // Flashcards use simple options
      correct_index: 0,
      explanation: back,
    })
    .select()
    .single()

  if (insertError || !cardTemplate) {
    return { success: false, error: insertError?.message || 'Failed to create card' }
  }

  // V8.0: Create user_card_progress with default SM-2 values
  const defaults = getCardDefaults()
  await supabase
    .from('user_card_progress')
    .insert({
      user_id: user.id,
      card_template_id: cardTemplate.id,
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
      repetitions: 0,
      suspended: false,
    })

  // Assign tags to the new card_template (if any)
  if (tagIds.length > 0) {
    const cardTemplateTags = tagIds.map((tagId) => ({
      card_template_id: cardTemplate.id,
      tag_id: tagId,
    }))
    await supabase.from('card_template_tags').insert(cardTemplateTags)
  }

  // Revalidate deck details page to show new card
  revalidatePath(`/decks/${deckId}`)

  return { success: true, data: cardTemplate }
}


/**
 * Result type for card update/delete operations
 */
export type CardActionResult = 
  | { ok: true }
  | { ok: false; error: string }

/**
 * Input type for updating a flashcard
 */
interface UpdateFlashcardInput {
  cardId: string
  type: 'flashcard'
  front: string
  back: string
  imageUrl?: string
}

/**
 * Input type for updating an MCQ
 */
interface UpdateMCQInput {
  cardId: string
  type: 'mcq'
  stem: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export type UpdateCardInput = UpdateFlashcardInput | UpdateMCQInput

/**
 * V8.0: Server Action for updating an existing card.
 * Updates card_templates table only (no legacy fallback).
 * Requirements: FR-2, FR-4, V8 2.3, V8 4.1
 */
export async function updateCard(input: UpdateCardInput): Promise<CardActionResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // V8.0: Fetch card_template and verify ownership via deck_template
  const { data: cardTemplate, error: cardError } = await supabase
    .from('card_templates')
    .select('id, deck_template_id, deck_templates!inner(author_id)')
    .eq('id', input.cardId)
    .single()

  if (cardError || !cardTemplate) {
    // V8.0: No fallback to legacy cards table
    return { ok: false, error: 'Card not found in V2 schema' }
  }

  // Check ownership via deck_template
  const deckData = cardTemplate.deck_templates as unknown as { author_id: string }
  if (deckData.author_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // Build update payload based on card type
  let updatePayload: Record<string, unknown>

  if (input.type === 'flashcard') {
    // Validate flashcard fields
    if (!input.front?.trim() || !input.back?.trim()) {
      return { ok: false, error: 'Front and back are required' }
    }
    updatePayload = {
      stem: input.front.trim(),
      explanation: input.back.trim(),
    }
  } else {
    // Validate MCQ fields
    if (!input.stem?.trim()) {
      return { ok: false, error: 'Question stem is required' }
    }
    if (!input.options || input.options.length < 2) {
      return { ok: false, error: 'At least 2 options are required' }
    }
    if (input.correctIndex < 0 || input.correctIndex >= input.options.length) {
      return { ok: false, error: 'Invalid correct answer index' }
    }
    updatePayload = {
      stem: input.stem.trim(),
      options: input.options.map(o => o.trim()),
      correct_index: input.correctIndex,
      explanation: input.explanation?.trim() || null,
    }
  }

  // V8.0: Update card_template only
  const { error: updateError } = await supabase
    .from('card_templates')
    .update(updatePayload)
    .eq('id', input.cardId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${cardTemplate.deck_template_id}`)

  return { ok: true }
}

/**
 * V8.0: Server Action for deleting a card.
 * Deletes from card_templates only (no legacy fallback).
 * Requirements: FR-3, FR-4, V8 2.4, V8 4.1
 */
export async function deleteCard(cardId: string): Promise<CardActionResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // V8.0: Fetch card_template and verify ownership via deck_template
  const { data: cardTemplate, error: cardError } = await supabase
    .from('card_templates')
    .select('id, deck_template_id, deck_templates!inner(author_id)')
    .eq('id', cardId)
    .single()

  if (cardError || !cardTemplate) {
    // V8.0: No fallback to legacy cards table
    return { ok: false, error: 'Card not found in V2 schema' }
  }

  // Check ownership via deck_template
  const deckData = cardTemplate.deck_templates as unknown as { author_id: string }
  if (deckData.author_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // V8.0: Delete user_card_progress first (for all users who have progress on this card)
  await supabase
    .from('user_card_progress')
    .delete()
    .eq('card_template_id', cardId)

  // V8.0: Delete card_template (cascade will handle card_template_tags)
  const { error: deleteError } = await supabase
    .from('card_templates')
    .delete()
    .eq('id', cardId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${cardTemplate.deck_template_id}`)

  return { ok: true }
}


/**
 * V8.0: Server Action for duplicating a card.
 * Creates new card_template and user_card_progress.
 * Requirements: B.2, B.3, B.4, V8 2.2
 */
export async function duplicateCard(cardId: string): Promise<CardActionResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // V8.0: Fetch original card_template with ownership check
  const { data: cardTemplate, error: cardError } = await supabase
    .from('card_templates')
    .select('*, deck_templates!inner(author_id)')
    .eq('id', cardId)
    .single()

  if (cardError || !cardTemplate) {
    return { ok: false, error: 'Card not found in V2 schema' }
  }

  // Check ownership via deck_template
  const deckData = cardTemplate.deck_templates as unknown as { author_id: string }
  if (deckData.author_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // V8.0: Create new card_template with "(copy)" suffix
  // V11.2: Include author_id (required field)
  const { data: newCardTemplate, error: insertError } = await supabase
    .from('card_templates')
    .insert({
      deck_template_id: cardTemplate.deck_template_id,
      author_id: user.id,
      stem: (cardTemplate.stem || '') + ' (copy)',
      options: cardTemplate.options,
      correct_index: cardTemplate.correct_index,
      explanation: cardTemplate.explanation,
    })
    .select()
    .single()

  if (insertError || !newCardTemplate) {
    return { ok: false, error: insertError?.message || 'Failed to duplicate card' }
  }

  // V8.0: Create user_card_progress for the duplicate
  const defaults = getCardDefaults()
  await supabase
    .from('user_card_progress')
    .insert({
      user_id: user.id,
      card_template_id: newCardTemplate.id,
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
      repetitions: 0,
      suspended: false,
    })

  // Revalidate deck page
  revalidatePath(`/decks/${cardTemplate.deck_template_id}`)

  return { ok: true }
}


/**
 * V8.0: Server Action for bulk deleting cards.
 * Deletes from card_templates only.
 * Requirements: C.4, C.5, V8 2.4
 */
export async function bulkDeleteCards(cardIds: string[]): Promise<CardActionResult & { count?: number }> {
  if (!cardIds.length) {
    return { ok: false, error: 'No cards selected' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // V8.0: Verify ownership of all card_templates via deck_template join
  const { data: cardTemplates, error: fetchError } = await supabase
    .from('card_templates')
    .select('id, deck_template_id, deck_templates!inner(author_id)')
    .in('id', cardIds)

  if (fetchError || !cardTemplates) {
    return { ok: false, error: 'Could not verify card ownership' }
  }

  // Check all cards belong to user
  const unauthorized = cardTemplates.some((ct) => {
    const deckData = ct.deck_templates as unknown as { author_id: string }
    return deckData.author_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: 'Access denied to one or more cards' }
  }

  // V8.0: Delete user_card_progress for all cards
  await supabase
    .from('user_card_progress')
    .delete()
    .in('card_template_id', cardIds)

  // V8.0: Delete all card_templates
  const { error: deleteError } = await supabase
    .from('card_templates')
    .delete()
    .in('id', cardIds)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  // Revalidate affected deck pages
  const deckIds = [...new Set(cardTemplates.map((ct) => ct.deck_template_id))]
  for (const deckId of deckIds) {
    revalidatePath(`/decks/${deckId}`)
  }

  return { ok: true, count: cardIds.length }
}

/**
 * V8.0: Server Action for bulk moving cards to another deck.
 * Updates deck_template_id in card_templates.
 * Requirements: C.6, C.7, V8 2.3
 */
export async function bulkMoveCards(
  cardIds: string[],
  targetDeckId: string
): Promise<CardActionResult & { count?: number }> {
  if (!cardIds.length) {
    return { ok: false, error: 'No cards selected' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // V8.0: Verify ownership of target deck_template
  const { data: targetDeck, error: targetError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', targetDeckId)
    .single()

  if (targetError || !targetDeck) {
    return { ok: false, error: 'Target deck not found in V2 schema' }
  }

  if (targetDeck.author_id !== user.id) {
    return { ok: false, error: 'Access denied to target deck' }
  }

  // V8.0: Verify ownership of all source card_templates
  const { data: cardTemplates, error: fetchError } = await supabase
    .from('card_templates')
    .select('id, deck_template_id, deck_templates!inner(author_id)')
    .in('id', cardIds)

  if (fetchError || !cardTemplates) {
    return { ok: false, error: 'Could not verify card ownership' }
  }

  const unauthorized = cardTemplates.some((ct) => {
    const deckData = ct.deck_templates as unknown as { author_id: string }
    return deckData.author_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: 'Access denied to one or more cards' }
  }

  // V8.0: Move all card_templates to target deck_template
  const { error: updateError } = await supabase
    .from('card_templates')
    .update({ deck_template_id: targetDeckId })
    .in('id', cardIds)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate source and target deck pages
  const sourceDeckIds = [...new Set(cardTemplates.map((ct) => ct.deck_template_id))]
  for (const deckId of sourceDeckIds) {
    revalidatePath(`/decks/${deckId}`)
  }
  revalidatePath(`/decks/${targetDeckId}`)

  return { ok: true, count: cardIds.length }
}


// ============================================
// V8.3: Deduplication Types
// ============================================

import { identifyDuplicates } from '@/lib/deduplication'

// ============================================
// V9.1: Bulk Selection Support
// ============================================

/**
 * V9.1: Get all card template IDs in a deck.
 * Used by "Select All in Deck" feature for bulk operations.
 * Requirements: 1.4
 * 
 * @param deckId - The deck_template ID
 * @returns Array of card_template IDs, or empty array on error
 */
export async function getAllCardIdsInDeck(deckId: string): Promise<string[]> {
  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  // Verify user has access (is author or subscriber)
  const { data: deckTemplate } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (!deckTemplate) {
    return []
  }

  // Check if user is author or has subscription
  if (deckTemplate.author_id !== user.id) {
    const { data: subscription } = await supabase
      .from('user_decks')
      .select('id')
      .eq('user_id', user.id)
      .eq('deck_template_id', deckId)
      .eq('is_active', true)
      .single()

    if (!subscription) {
      return []
    }
  }

  // Fetch all card_template IDs for this deck
  const { data: cardTemplates, error } = await supabase
    .from('card_templates')
    .select('id')
    .eq('deck_template_id', deckId)
    .order('created_at', { ascending: true })

  if (error || !cardTemplates) {
    console.error('Failed to fetch card IDs:', error)
    return []
  }

  return cardTemplates.map(ct => ct.id)
}

export interface DeduplicationResult {
  ok: boolean
  deletedCount?: number
  error?: string
}

/**
 * V8.3: Server Action for removing duplicate MCQ cards from a deck.
 * Finds cards with identical normalized stems and keeps the oldest one.
 * Requirements: 3.1, 3.2, 3.3, 3.5
 */
export async function removeDuplicateCards(deckId: string): Promise<DeduplicationResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify user owns the deck_template
  const { data: deckTemplate, error: deckError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (deckError || !deckTemplate) {
    return { ok: false, error: 'Deck not found' }
  }

  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // Fetch all cards in the deck (V2 schema: all card_templates are MCQ-style)
  const { data: cards, error: fetchError } = await supabase
    .from('card_templates')
    .select('id, stem, created_at')
    .eq('deck_template_id', deckId)
    .order('created_at', { ascending: true })

  if (fetchError) {
    return { ok: false, error: fetchError.message }
  }

  if (!cards || cards.length === 0) {
    return { ok: true, deletedCount: 0 }
  }

  // Identify duplicates using pure function
  const toDelete = identifyDuplicates(cards)

  if (toDelete.length === 0) {
    return { ok: true, deletedCount: 0 }
  }

  // Delete duplicate card_templates (CASCADE handles user_card_progress and card_template_tags)
  try {
    const { error: deleteError } = await supabase
      .from('card_templates')
      .delete()
      .in('id', toDelete)

    if (deleteError) {
      return { ok: false, error: `Failed to delete duplicates: ${deleteError.message}` }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during deletion'
    return { ok: false, error: message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${deckId}`)

  return { ok: true, deletedCount: toDelete.length }
}
