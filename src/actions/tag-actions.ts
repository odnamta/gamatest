'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { withUser, withOrgUser, type AuthContext, type OrgAuthContext } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { getCategoryColor } from '@/lib/tag-colors'
import { TAG_CATEGORIES, isValidTagCategory } from '@/lib/constants'
import type { Tag, TagCategory } from '@/types/database'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Tag Server Actions
 * Requirements: V5 Feature Set 1 - Tagging System
 * V9: Added category support with enforced colors
 * V11.5: Uses TAG_CATEGORIES from constants
 */

// V9/V11.5: Tag category schema using constants
const tagCategorySchema = z.enum(TAG_CATEGORIES).default('concept')

// Validation schemas
const createTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  category: tagCategorySchema,
})

const updateTagSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID'),
  name: z.string().min(1, 'Tag name is required').max(50, 'Tag name too long'),
  category: tagCategorySchema.optional(),
})

// V11.5.1: Result types using ActionResultV2
export type TagActionResult = ActionResultV2<Tag>

/**
 * Create a new tag for the current user.
 * V9: Category defaults to 'concept', color is enforced by category.
 * V11.5.1: Refactored to use withUser helper.
 * Validates uniqueness of tag name per user.
 * Req: 1.1, 1.2, V9-1.1, V9-1.2, V9-1.3, V9-1.4, V9-1.5
 */
export async function createTag(
  name: string,
  category: TagCategory = 'concept'
): Promise<TagActionResult> {
  const validation = createTagSchema.safeParse({ name, category })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  return withOrgUser(async ({ user, supabase, org }: OrgAuthContext) => {
    // Check for duplicate name within org (case-insensitive)
    const { data: existing } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', name.trim())
      .single()

    if (existing) {
      return { ok: false, error: `Tag "${name}" already exists` }
    }

    // V9: Enforce color based on category
    const color = getCategoryColor(category)

    // V13: Create the tag with org_id for multi-tenant scoping
    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        user_id: user.id,
        org_id: org.id,
        name: name.trim(),
        color,
        category,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: tag }
  })
}

/**
 * Get all tags for the current user.
 * V11.5.1: Refactored to use withUser helper.
 * Req: 1.1
 */
export async function getUserTags(): Promise<Tag[]> {
  const result = await withOrgUser(async ({ user, supabase, org }: OrgAuthContext) => {
    // V13: Filter tags by org_id. Also include legacy tags (org_id IS NULL) for migration.
    const { data: tags } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .or(`org_id.eq.${org.id},org_id.is.null`)
      .order('name')

    return { ok: true as const, data: tags || [] }
  })

  // Return empty array if auth or org resolution failed
  if (!result.ok) return []
  return result.data ?? []
}

/**
 * Update an existing tag.
 * V9: If category is changed, color is automatically updated to match.
 * V11.5.1: Refactored to use withUser helper.
 * Req: 1.1, 1.2, V9-3.2, V9-3.5
 */
export async function updateTag(
  tagId: string,
  name: string,
  category?: TagCategory
): Promise<TagActionResult> {
  const validation = updateTagSchema.safeParse({ tagId, name, category })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  return withOrgUser(async ({ user, supabase }: OrgAuthContext) => {
    // Verify ownership and get current tag
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id, category')
      .eq('id', tagId)
      .eq('user_id', user.id)
      .single()

    if (!existingTag) {
      return { ok: false, error: 'Tag not found' }
    }

    // Check for duplicate name (excluding current tag, case-insensitive)
    const { data: duplicate } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', user.id)
      .ilike('name', name.trim())
      .neq('id', tagId)
      .single()

    if (duplicate) {
      return { ok: false, error: `Tag "${name}" already exists` }
    }

    // V9: Determine final category and enforce color
    const finalCategory = category ?? existingTag.category
    const color = getCategoryColor(finalCategory)

    // Update the tag with category and enforced color
    const { data: tag, error } = await supabase
      .from('tags')
      .update({ name: name.trim(), category: finalCategory, color })
      .eq('id', tagId)
      .select()
      .single()

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, data: tag }
  })
}

/**
 * Delete a tag. Cascades to card_tags automatically.
 * V11.5.1: Refactored to use withUser helper.
 * Req: 1.6
 */
export async function deleteTag(tagId: string): Promise<ActionResultV2> {
  if (!tagId) {
    return { ok: false, error: 'Tag ID is required' }
  }

  return withOrgUser(async ({ user, supabase }: OrgAuthContext) => {
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
  })
}


// ============================================
// Card-Tag Association Actions
// ============================================

/**
 * Assign tags to a card. Replaces existing tags.
 * V11.5.1: Refactored to use withUser helper.
 * Req: 1.3
 */
export async function assignTagsToCard(
  cardId: string,
  tagIds: string[]
): Promise<ActionResultV2> {
  if (!cardId) {
    return { ok: false, error: 'Card ID is required' }
  }

  return withUser(async ({ user, supabase }: AuthContext) => {
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
  })
}

/**
 * Remove a single tag from a card.
 * V11.5.1: Refactored to use withUser helper.
 * Req: 1.4
 */
export async function removeTagFromCard(
  cardId: string,
  tagId: string
): Promise<ActionResultV2> {
  if (!cardId || !tagId) {
    return { ok: false, error: 'Card ID and Tag ID are required' }
  }

  return withUser(async ({ user, supabase }: AuthContext) => {
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
  })
}

/**
 * Get all tags for a specific card.
 * V11.5.1: Refactored to use withUser helper.
 * Req: 1.3
 */
export async function getCardTags(cardId: string): Promise<Tag[]> {
  if (!cardId) {
    return []
  }

  const result = await withUser(async ({ supabase }: AuthContext) => {
    const { data } = await supabase
      .from('card_tags')
      .select('tags(*)')
      .eq('card_id', cardId)

    if (!data) {
      return { ok: true as const, data: [] as Tag[] }
    }

    // Extract tags from the join result
    const tags = data
      .map((row) => row.tags as unknown as Tag)
      .filter((tag): tag is Tag => tag !== null)

    return { ok: true as const, data: tags }
  })

  // Return empty array if auth failed
  if (!result.ok) return []
  return result.data ?? []
}


// ============================================
// V9.1: Bulk Tagging Actions
// ============================================

/**
 * V9.1: Result type for bulk tag operations
 * V11.5.1: Using ActionResultV2 pattern
 */
export type BulkTagResult = ActionResultV2<{ taggedCount: number }>

/**
 * V9.1: Add a tag to multiple cards in bulk.
 * V11.5.1: Refactored to use withUser helper.
 * Batches inserts in chunks of 100 to prevent timeout.
 * Uses ON CONFLICT DO NOTHING for idempotent behavior.
 * 
 * Requirements: 2.3, 2.4, 2.6, 2.7
 * 
 * @param cardIds - Array of card_template IDs to tag
 * @param tagId - The tag ID to apply
 * @returns BulkTagResult with count of newly tagged cards
 */
export async function bulkAddTagToCards(
  cardIds: string[],
  tagId: string
): Promise<BulkTagResult> {
  if (!cardIds.length) {
    return { ok: false, error: 'No cards selected' }
  }

  if (!tagId) {
    return { ok: false, error: 'Tag ID is required' }
  }

  return withOrgUser(async ({ user, supabase }: OrgAuthContext) => {
    // Verify tag exists and belongs to user
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('id', tagId)
      .eq('user_id', user.id)
      .single()

    if (tagError || !tag) {
      return { ok: false, error: 'Tag not found' }
    }

    // Verify user is author of all cards via deck_template.author_id
    // Fetch all card_templates with their deck_template author info
    const { data: cardTemplates, error: fetchError } = await supabase
      .from('card_templates')
      .select('id, deck_template_id, deck_templates!inner(author_id)')
      .in('id', cardIds)

    if (fetchError || !cardTemplates) {
      return { ok: false, error: 'Could not verify card ownership' }
    }

    // Check that we found all requested cards
    if (cardTemplates.length !== cardIds.length) {
      return { ok: false, error: 'Some cards were not found' }
    }

    // Check all cards belong to user (author check)
    const unauthorized = cardTemplates.some((ct) => {
      const deckData = ct.deck_templates as unknown as { author_id: string }
      return deckData.author_id !== user.id
    })

    if (unauthorized) {
      return { ok: false, error: 'Only the author can tag these cards' }
    }

    // Batch inserts in chunks of 100 to prevent timeout
    const BATCH_SIZE = 100
    let totalTagged = 0

    for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
      const batch = cardIds.slice(i, i + BATCH_SIZE)
      const cardTagRows = batch.map((cardId) => ({
        card_template_id: cardId,
        tag_id: tagId,
      }))

      // Use upsert with ON CONFLICT DO NOTHING for idempotence
      const { error: insertError, count } = await supabase
        .from('card_template_tags')
        .upsert(cardTagRows, { 
          onConflict: 'card_template_id,tag_id',
          ignoreDuplicates: true,
          count: 'exact'
        })

      if (insertError) {
        console.error('Bulk tag insert error:', insertError)
        return { ok: false, error: 'Failed to tag cards. Please try again.' }
      }

      totalTagged += count || 0
    }

    // Revalidate affected deck pages
    const deckIds = [...new Set(cardTemplates.map((ct) => ct.deck_template_id))]
    for (const deckId of deckIds) {
      revalidatePath(`/decks/${deckId}`)
    }

    return { ok: true, data: { taggedCount: totalTagged } }
  }, undefined, RATE_LIMITS.bulk)
}


// ============================================
// V9.2: AI Retro-Tagging Actions
// ============================================

import { openai } from '@/lib/openai-client'
import { GOLDEN_TOPIC_TAGS, getCanonicalTopicTag } from '@/lib/golden-list'

/**
 * V9.2: Result type for auto-tag operations
 * V11.5.1: Using ActionResultV2 pattern
 */
export type AutoTagResult = ActionResultV2<{ taggedCount: number; skippedCount: number }>

/**
 * V9.2: Auto-tag cards using AI classification.
 * V9.3: Added chunk limit (max 5), parallel processing, and subject parameter.
 * V11.5.1: Refactored to use withUser helper.
 * Sends card content to OpenAI for topic and concept classification.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 4.1
 * V9.3 Requirements: 2.1 (chunk limit), 2.2 (parallel), 2.3 (concurrent), 2.4 (result shape), 3.4/4.1 (subject)
 * 
 * Property 6: Reject if cardIds.length > 5
 * Property 7: Accept if cardIds.length 1-5
 * Property 8: taggedCount + skippedCount = input card count
 * Property 10: Subject included in AI prompt
 * 
 * @param cardIds - Array of card_template IDs to auto-tag (max 5)
 * @param subject - Optional subject area for context-aware prompting
 * @returns AutoTagResult with counts of tagged and skipped cards
 */
export async function autoTagCards(
  cardIds: string[],
  subject?: string
): Promise<AutoTagResult> {
  // V9.3: Chunk limit validation - reject if > 5 cards
  if (cardIds.length > 5) {
    return { ok: false, error: 'Maximum 5 cards per request' }
  }

  if (!cardIds.length) {
    return { ok: false, error: 'No cards selected' }
  }

  // V13: Resolve auth + org context for tag creation with org_id
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'AUTH_REQUIRED' }
  }

  const supabase = await createSupabaseServerClient()

  // V13: Resolve user's active org for tag scoping
  const { data: orgMembership } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single()
  if (!orgMembership?.org_id) {
    return { ok: false, error: 'No active organization found' }
  }
  const activeOrgId = orgMembership.org_id

  // Fetch card templates with their deck info for authorization
  const { data: cardTemplates, error: fetchError } = await supabase
    .from('card_templates')
    .select('id, stem, deck_template_id, deck_templates!inner(author_id, subject)')
    .in('id', cardIds)

  if (fetchError || !cardTemplates) {
    return { ok: false, error: 'Could not fetch cards' }
  }

  if (cardTemplates.length === 0) {
    return { ok: false, error: 'No cards found' }
  }

  // Verify user is author of all cards
  const unauthorized = cardTemplates.some((ct) => {
    const deckData = ct.deck_templates as unknown as { author_id: string }
    return deckData.author_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: 'Only the author can auto-tag these cards' }
  }

  // V9.3: Use provided subject or fall back to deck subject or default
  const firstDeck = cardTemplates[0].deck_templates as unknown as { subject?: string }
  const effectiveSubject = subject || firstDeck.subject || 'General'

  // V9.3: Process all cards in parallel using Promise.all
  const results = await Promise.all(
    cardTemplates.map(async (ct) => {
      try {
        const cardForPrompt = { id: ct.id, stem: ct.stem }

        // V9.3: Subject-aware system prompt
        const systemPrompt = `You are an expert in ${effectiveSubject}. You are an assessment content classifier for ${effectiveSubject} exam preparation.
Classify this question into:
1. ONE Topic from this Golden List: ${GOLDEN_TOPIC_TAGS.join(', ')}
2. ONE or TWO specific Concepts (key terms, topics, or procedures mentioned)

Rules:
- Topic MUST be from the Golden List exactly as written
- Concepts should be specific domain terms from the question
- Extract verbatim. Do not invent missing values.
- Use ${effectiveSubject}-appropriate interpretation of domain terms

Respond with JSON only, no markdown:
{"cardId":"uuid","topic":"Topic","concepts":["Concept1","Concept2"]}`

        const userPrompt = `Classify this ${effectiveSubject} question:\n${JSON.stringify(cardForPrompt, null, 2)}`

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
          console.error('Empty AI response for card:', ct.id)
          return { cardId: ct.id, success: false }
        }

        // Parse response
        let parsed: unknown
        try {
          parsed = JSON.parse(content)
        } catch {
          console.error('Failed to parse AI response:', content)
          return { cardId: ct.id, success: false }
        }

        // Validate single card response
        const singleCardSchema = z.object({
          cardId: z.string(),
          topic: z.string(),
          concepts: z.array(z.string()).min(1).max(2),
        })

        const validated = singleCardSchema.safeParse(parsed)
        if (!validated.success) {
          console.error('Invalid AI response schema:', validated.error)
          return { cardId: ct.id, success: false }
        }

        const classification = validated.data

        // Validate topic is in Golden List
        const canonicalTopic = getCanonicalTopicTag(classification.topic)
        if (!canonicalTopic) {
          console.warn(`Invalid topic "${classification.topic}" for card ${ct.id}`)
          return { cardId: ct.id, success: false }
        }

        // Collect all tags to apply (topic + concepts)
        const tagNames = [canonicalTopic, ...classification.concepts]

        // Find or create tags and apply them
        for (const tagName of tagNames) {
          const trimmedName = tagName.trim()
          if (!trimmedName) continue

          // Find existing tag or create new one
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('user_id', user.id)
            .ilike('name', trimmedName)
            .single()

          let tagId: string

          if (existingTag) {
            tagId = existingTag.id
          } else {
            // Create new tag - topic category for Golden List, concept for others
            const category = getCanonicalTopicTag(trimmedName) ? 'topic' : 'concept'
            const color = category === 'topic' ? '#10b981' : '#6366f1'

            const { data: newTag, error: createError } = await supabase
              .from('tags')
              .insert({
                user_id: user.id,
                org_id: activeOrgId,
                name: trimmedName,
                category,
                color,
              })
              .select('id')
              .single()

            if (createError || !newTag) {
              console.error('Failed to create tag:', createError)
              continue
            }
            tagId = newTag.id
          }

          // Upsert card-tag association (idempotent)
          await supabase
            .from('card_template_tags')
            .upsert(
              { card_template_id: ct.id, tag_id: tagId },
              { onConflict: 'card_template_id,tag_id', ignoreDuplicates: true }
            )
        }

        return { cardId: ct.id, success: true }
      } catch (error) {
        console.error('Auto-tag error for card:', ct.id, error)
        return { cardId: ct.id, success: false }
      }
    })
  )

  // Aggregate results
  const totalTagged = results.filter((r) => r.success).length
  const totalSkipped = results.filter((r) => !r.success).length

  if (totalTagged === 0 && totalSkipped > 0) {
    return { ok: false, error: 'AI classification failed. Please try again.' }
  }

  // Revalidate affected deck pages
  const deckIds = [...new Set(cardTemplates.map((ct) => ct.deck_template_id))]
  for (const deckId of deckIds) {
    revalidatePath(`/decks/${deckId}`)
  }

  return { ok: true, data: { taggedCount: totalTagged, skippedCount: totalSkipped } }
}
