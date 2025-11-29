'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { createCardSchema } from '@/lib/validations'
import { getCardDefaults } from '@/lib/card-defaults'
import type { ActionResult } from '@/types/actions'

/**
 * Server Action for creating a new card.
 * Validates input with Zod and creates card with default SM-2 values.
 * Requirements: 3.1, 3.2, 9.3
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

  const { deckId, front, back, imageUrl } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // Verify user owns the deck (RLS will also enforce this)
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .single()

  if (deckError || !deck) {
    return { success: false, error: 'Deck not found or access denied' }
  }

  // Create new card with default SM-2 values (Requirement 3.1)
  const defaults = getCardDefaults()
  const { data, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      front,
      back,
      image_url: imageUrl || null,
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Assign tags to the new card (if any)
  if (tagIds.length > 0 && data) {
    const cardTags = tagIds.map((tagId) => ({
      card_id: data.id,
      tag_id: tagId,
    }))
    await supabase.from('card_tags').insert(cardTags)
  }

  // Revalidate deck details page to show new card
  revalidatePath(`/decks/${deckId}`)

  return { success: true, data }
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
 * Server Action for updating an existing card.
 * Handles both flashcard and MCQ types.
 * Requirements: FR-2, FR-4
 */
export async function updateCard(input: UpdateCardInput): Promise<CardActionResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch card and verify ownership via deck
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .eq('id', input.cardId)
    .single()

  if (cardError || !card) {
    return { ok: false, error: 'Card not found' }
  }

  // Check ownership
  const deckData = card.decks as unknown as { user_id: string }
  if (deckData.user_id !== user.id) {
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
      front: input.front.trim(),
      back: input.back.trim(),
      image_url: input.imageUrl?.trim() || null,
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

  // Update the card
  const { error: updateError } = await supabase
    .from('cards')
    .update(updatePayload)
    .eq('id', input.cardId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${card.deck_id}`)

  return { ok: true }
}

/**
 * Server Action for deleting a card.
 * Requirements: FR-3, FR-4
 */
export async function deleteCard(cardId: string): Promise<CardActionResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch card and verify ownership via deck
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .eq('id', cardId)
    .single()

  if (cardError || !card) {
    return { ok: false, error: 'Card not found' }
  }

  // Check ownership
  const deckData = card.decks as unknown as { user_id: string }
  if (deckData.user_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // Delete the card
  const { error: deleteError } = await supabase
    .from('cards')
    .delete()
    .eq('id', cardId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${card.deck_id}`)

  return { ok: true }
}


/**
 * Server Action for duplicating a card.
 * Creates a new card with all data copied and "(copy)" appended to stem/front.
 * Requirements: B.2, B.3, B.4
 */
export async function duplicateCard(cardId: string): Promise<CardActionResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch original card with ownership check
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*, decks!inner(user_id)')
    .eq('id', cardId)
    .single()

  if (cardError || !card) {
    return { ok: false, error: 'Card not found' }
  }

  // Check ownership
  const deckData = card.decks as unknown as { user_id: string }
  if (deckData.user_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // Build new card data with "(copy)" suffix
  const defaults = getCardDefaults()
  const newCardData: Record<string, unknown> = {
    deck_id: card.deck_id,
    card_type: card.card_type,
    interval: defaults.interval,
    ease_factor: defaults.ease_factor,
    next_review: defaults.next_review.toISOString(),
  }

  if (card.card_type === 'mcq') {
    newCardData.stem = (card.stem || '') + ' (copy)'
    newCardData.options = card.options
    newCardData.correct_index = card.correct_index
    newCardData.explanation = card.explanation
    // MCQ cards need front/back to satisfy NOT NULL constraint (empty strings like createMCQAction)
    newCardData.front = card.front || ''
    newCardData.back = card.back || ''
  } else {
    newCardData.front = (card.front || '') + ' (copy)'
    newCardData.back = card.back
    newCardData.image_url = card.image_url
  }

  // Insert new card (Supabase generates new UUID)
  const { error: insertError } = await supabase
    .from('cards')
    .insert(newCardData)

  if (insertError) {
    return { ok: false, error: insertError.message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${card.deck_id}`)

  return { ok: true }
}


/**
 * Server Action for bulk deleting cards.
 * Requirements: C.4, C.5
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

  // Verify ownership of all cards via deck join
  const { data: cards, error: fetchError } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .in('id', cardIds)

  if (fetchError || !cards) {
    return { ok: false, error: 'Could not verify card ownership' }
  }

  // Check all cards belong to user
  const unauthorized = cards.some((card) => {
    const deckData = card.decks as unknown as { user_id: string }
    return deckData.user_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: 'Access denied to one or more cards' }
  }

  // Delete all cards
  const { error: deleteError } = await supabase
    .from('cards')
    .delete()
    .in('id', cardIds)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  // Revalidate affected deck pages
  const deckIds = [...new Set(cards.map((c) => c.deck_id))]
  for (const deckId of deckIds) {
    revalidatePath(`/decks/${deckId}`)
  }

  return { ok: true, count: cardIds.length }
}

/**
 * Server Action for bulk moving cards to another deck.
 * Requirements: C.6, C.7
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

  // Verify ownership of target deck
  const { data: targetDeck, error: targetError } = await supabase
    .from('decks')
    .select('id')
    .eq('id', targetDeckId)
    .eq('user_id', user.id)
    .single()

  if (targetError || !targetDeck) {
    return { ok: false, error: 'Target deck not found or access denied' }
  }

  // Verify ownership of all source cards
  const { data: cards, error: fetchError } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .in('id', cardIds)

  if (fetchError || !cards) {
    return { ok: false, error: 'Could not verify card ownership' }
  }

  const unauthorized = cards.some((card) => {
    const deckData = card.decks as unknown as { user_id: string }
    return deckData.user_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: 'Access denied to one or more cards' }
  }

  // Move all cards to target deck
  const { error: updateError } = await supabase
    .from('cards')
    .update({ deck_id: targetDeckId })
    .in('id', cardIds)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // Revalidate source and target deck pages
  const sourceDeckIds = [...new Set(cards.map((c) => c.deck_id))]
  for (const deckId of sourceDeckIds) {
    revalidatePath(`/decks/${deckId}`)
  }
  revalidatePath(`/decks/${targetDeckId}`)

  return { ok: true, count: cardIds.length }
}
