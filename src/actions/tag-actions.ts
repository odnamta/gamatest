'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import type { Tag } from '@/types/database'

/**
 * Tag Server Actions
 * Requirements: V5 Feature Set 1 - Tagging System
 */

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  color: z.string().min(1, 'Color is required'),
})

const updateTagSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID'),
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  color: z.string().min(1, 'Color is required'),
})

// Result types
export type TagActionResult =
  | { ok: true; tag?: Tag }
  | { ok: false; error: string }

/**
 * Create a new tag for the current user.
 * Validates uniqueness of tag name per user.
 * Req: 1.1, 1.2
 */
export async function createTag(
  name: string,
  color: string
): Promise<TagActionResult> {
  const validation = createTagSchema.safeParse({ name, color })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Check for duplicate name
  const { data: existing } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .single()

  if (existing) {
    return { ok: false, error: `Tag "${name}" already exists` }
  }


  // Create the tag
  const { data: tag, error } = await supabase
    .from('tags')
    .insert({
      user_id: user.id,
      name: name.trim(),
      color,
    })
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, tag }
}

/**
 * Get all tags for the current user.
 * Req: 1.1
 */
export async function getUserTags(): Promise<Tag[]> {
  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  const { data: tags } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  return tags || []
}

/**
 * Update an existing tag.
 * Req: 1.1, 1.2
 */
export async function updateTag(
  tagId: string,
  name: string,
  color: string
): Promise<TagActionResult> {
  const validation = updateTagSchema.safeParse({ tagId, name, color })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify ownership
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (!existingTag) {
    return { ok: false, error: 'Tag not found' }
  }

  // Check for duplicate name (excluding current tag)
  const { data: duplicate } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', name.trim())
    .neq('id', tagId)
    .single()

  if (duplicate) {
    return { ok: false, error: `Tag "${name}" already exists` }
  }

  // Update the tag
  const { data: tag, error } = await supabase
    .from('tags')
    .update({ name: name.trim(), color })
    .eq('id', tagId)
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, tag }
}

/**
 * Delete a tag. Cascades to card_tags automatically.
 * Req: 1.6
 */
export async function deleteTag(tagId: string): Promise<TagActionResult> {
  if (!tagId) {
    return { ok: false, error: 'Tag ID is required' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify ownership
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (!existingTag) {
    return { ok: false, error: 'Tag not found' }
  }

  // Delete the tag (cascades to card_tags)
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)

  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true }
}


// ============================================
// Card-Tag Association Actions
// ============================================

/**
 * Assign tags to a card. Replaces existing tags.
 * Req: 1.3
 */
export async function assignTagsToCard(
  cardId: string,
  tagIds: string[]
): Promise<TagActionResult> {
  if (!cardId) {
    return { ok: false, error: 'Card ID is required' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify card ownership via deck
  const { data: card } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .eq('id', cardId)
    .single()

  if (!card) {
    return { ok: false, error: 'Card not found' }
  }

  const deckData = card.decks as unknown as { user_id: string }
  if (deckData.user_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // Remove existing tags
  await supabase
    .from('card_tags')
    .delete()
    .eq('card_id', cardId)

  // Add new tags (if any)
  if (tagIds.length > 0) {
    const cardTags = tagIds.map((tagId) => ({
      card_id: cardId,
      tag_id: tagId,
    }))

    const { error } = await supabase
      .from('card_tags')
      .insert(cardTags)

    if (error) {
      return { ok: false, error: error.message }
    }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${card.deck_id}`)

  return { ok: true }
}

/**
 * Remove a single tag from a card.
 * Req: 1.4
 */
export async function removeTagFromCard(
  cardId: string,
  tagId: string
): Promise<TagActionResult> {
  if (!cardId || !tagId) {
    return { ok: false, error: 'Card ID and Tag ID are required' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify card ownership via deck
  const { data: card } = await supabase
    .from('cards')
    .select('id, deck_id, decks!inner(user_id)')
    .eq('id', cardId)
    .single()

  if (!card) {
    return { ok: false, error: 'Card not found' }
  }

  const deckData = card.decks as unknown as { user_id: string }
  if (deckData.user_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // Remove the tag association
  const { error } = await supabase
    .from('card_tags')
    .delete()
    .eq('card_id', cardId)
    .eq('tag_id', tagId)

  if (error) {
    return { ok: false, error: error.message }
  }

  // Revalidate deck page
  revalidatePath(`/decks/${card.deck_id}`)

  return { ok: true }
}

/**
 * Get all tags for a specific card.
 * Req: 1.3
 */
export async function getCardTags(cardId: string): Promise<Tag[]> {
  if (!cardId) {
    return []
  }

  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from('card_tags')
    .select('tags(*)')
    .eq('card_id', cardId)

  if (!data) {
    return []
  }

  // Extract tags from the join result
  return data
    .map((row) => row.tags as unknown as Tag)
    .filter((tag): tag is Tag => tag !== null)
}
