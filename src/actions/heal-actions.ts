'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { withUser, type AuthContext } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { getCardDefaults } from '@/lib/card-defaults'
import type { ActionResultV2 } from '@/types/actions'

export interface HealthStatus {
  needsRepair: boolean
  missingCount: number
}

/**
 * V8.1: Check if user has cards without progress records.
 * Used to conditionally show the repair button.
 */
export async function checkHealthStatus(): Promise<ActionResultV2<HealthStatus>> {
  return withUser(async ({ user, supabase }: AuthContext) => {
    // Get all deck_templates authored by user
    const { data: authoredDecks } = await supabase
      .from('deck_templates')
      .select('id')
      .eq('author_id', user.id)
      .limit(500)

    if (!authoredDecks || authoredDecks.length === 0) {
      return { ok: true, data: { needsRepair: false, missingCount: 0 } }
    }

    const deckIds = authoredDecks.map(d => d.id)

    // Get all card_templates in authored decks
    const { data: cardTemplates } = await supabase
      .from('card_templates')
      .select('id')
      .in('deck_template_id', deckIds)
      .limit(10000)

    if (!cardTemplates || cardTemplates.length === 0) {
      return { ok: true, data: { needsRepair: false, missingCount: 0 } }
    }

    const cardIds = cardTemplates.map(c => c.id)

    // Get existing progress records for user
    const { data: existingProgress } = await supabase
      .from('user_card_progress')
      .select('card_template_id')
      .eq('user_id', user.id)
      .in('card_template_id', cardIds)
      .limit(50000)

    const existingCardIds = new Set((existingProgress || []).map(p => p.card_template_id))
    const missingCount = cardIds.filter(id => !existingCardIds.has(id)).length

    return {
      ok: true,
      data: {
        needsRepair: missingCount > 0,
        missingCount,
      },
    }
  }, RATE_LIMITS.standard)
}

/**
 * V8.1: Heal missing user_card_progress records for authored cards.
 * 
 * This action finds all cards in decks authored by the current user
 * that don't have progress records, and creates default progress rows.
 * 
 * Safe to run multiple times (idempotent via ON CONFLICT DO NOTHING).
 */
export async function healAuthorProgress(): Promise<ActionResultV2<{ healedCount: number }>> {
  return withUser(async ({ user, supabase }: AuthContext) => {
    try {
      // Step 1: Get all deck_templates authored by user
      const { data: authoredDecks, error: decksError } = await supabase
        .from('deck_templates')
        .select('id')
        .eq('author_id', user.id)
        .limit(500)

      if (decksError) {
        return { ok: false, error: decksError.message }
      }

      if (!authoredDecks || authoredDecks.length === 0) {
        return { ok: true, data: { healedCount: 0 } }
      }

      const deckIds = authoredDecks.map(d => d.id)

      // Step 2: Get all card_templates in those decks
      const { data: cardTemplates, error: cardsError } = await supabase
        .from('card_templates')
        .select('id')
        .in('deck_template_id', deckIds)
        .limit(10000)

      if (cardsError) {
        return { ok: false, error: cardsError.message }
      }

      if (!cardTemplates || cardTemplates.length === 0) {
        return { ok: true, data: { healedCount: 0 } }
      }

      const cardIds = cardTemplates.map(c => c.id)

      // Step 3: Get existing progress records for user
      const { data: existingProgress, error: progressError } = await supabase
        .from('user_card_progress')
        .select('card_template_id')
        .eq('user_id', user.id)
        .in('card_template_id', cardIds)
        .limit(50000)

      if (progressError) {
        return { ok: false, error: progressError.message }
      }

      const existingCardIds = new Set((existingProgress || []).map(p => p.card_template_id))

      // Step 4: Identify cards with NO progress row
      const missingCardIds = cardIds.filter(id => !existingCardIds.has(id))

      if (missingCardIds.length === 0) {
        return { ok: true, data: { healedCount: 0 } }
      }

      // Step 5: Bulk insert default progress rows
      const defaults = getCardDefaults()
      const progressRows = missingCardIds.map(cardId => ({
        user_id: user.id,
        card_template_id: cardId,
        interval: defaults.interval,
        ease_factor: defaults.ease_factor,
        next_review: defaults.next_review.toISOString(),
        repetitions: 0,
        suspended: false,
      }))

      // Use upsert with onConflict to make it idempotent
      const { error: insertError } = await supabase
        .from('user_card_progress')
        .upsert(progressRows, {
          onConflict: 'user_id,card_template_id',
          ignoreDuplicates: true
        })

      if (insertError) {
        return { ok: false, error: insertError.message }
      }

      // Revalidate dashboard to show updated state
      revalidatePath('/dashboard')

      return { ok: true, data: { healedCount: missingCardIds.length } }
    } catch (error) {
      logger.error('healAuthorProgress', error)
      return { ok: false, error: 'Failed to heal progress records' }
    }
  }, RATE_LIMITS.standard)
}


// ============================================
// V8.2: Smart Deck Merge Functions
// ============================================

export interface DuplicateDeckGroup {
  title: string
  deckIds: string[]
  cardCounts: number[]
}

export interface DuplicateDecksResult {
  hasDuplicates: boolean
  duplicateCount: number
  groups: DuplicateDeckGroup[]
}


/**
 * V8.2: Normalize stem text for comparison.
 * Trims whitespace, lowercases, and collapses multiple spaces.
 */
function normalizeStem(stem: string): string {
  return stem.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * V8.2: Find groups of deck_templates with duplicate titles for the same author.
 * Used to identify decks that can be merged.
 */
export async function findDuplicateDeckGroups(): Promise<ActionResultV2<DuplicateDecksResult>> {
  return withUser(async ({ user, supabase }: AuthContext) => {
    // Get all deck_templates authored by user with card counts
    const { data: decks, error } = await supabase
      .from('deck_templates')
      .select('id, title')
      .eq('author_id', user.id)
      .limit(500)

    if (error || !decks || decks.length === 0) {
      return { ok: true, data: { hasDuplicates: false, duplicateCount: 0, groups: [] } }
    }

    // Get card counts for each deck
    const deckIds = decks.map(d => d.id)
    const { data: cardCounts } = await supabase
      .from('card_templates')
      .select('deck_template_id')
      .in('deck_template_id', deckIds)

    // Count cards per deck
    const countMap = new Map<string, number>()
    for (const card of cardCounts || []) {
      const current = countMap.get(card.deck_template_id) || 0
      countMap.set(card.deck_template_id, current + 1)
    }

    // Group decks by title (case-insensitive)
    const titleGroups = new Map<string, { id: string; title: string; count: number }[]>()
    for (const deck of decks) {
      const normalizedTitle = deck.title.trim().toLowerCase()
      const existing = titleGroups.get(normalizedTitle) || []
      existing.push({
        id: deck.id,
        title: deck.title,
        count: countMap.get(deck.id) || 0,
      })
      titleGroups.set(normalizedTitle, existing)
    }

    // Filter to groups with more than one deck (duplicates)
    const groups: DuplicateDeckGroup[] = []
    for (const [, deckList] of titleGroups) {
      if (deckList.length > 1) {
        groups.push({
          title: deckList[0].title,
          deckIds: deckList.map(d => d.id),
          cardCounts: deckList.map(d => d.count),
        })
      }
    }

    return {
      ok: true,
      data: {
        hasDuplicates: groups.length > 0,
        duplicateCount: groups.length,
        groups,
      },
    }
  }, RATE_LIMITS.standard)
}

/**
 * V8.2: Smart merge duplicate decks.
 * 
 * For each duplicate group:
 * 1. Pick Master (most cards) and Donor (fewer cards)
 * 2. Compare stems: if Donor card stem matches Master → delete Donor card
 * 3. If Donor card stem is unique → move to Master deck
 * 4. Delete empty Donor deck
 * 5. Update user_decks to point to Master only
 */
export async function mergeDuplicateDecks(): Promise<ActionResultV2<{ mergedCount: number; movedCards: number; deletedDuplicates: number }>> {
  return withUser(async ({ user, supabase }: AuthContext) => {
    try {
      // Step 1: Find duplicate groups
      const dupResult = await findDuplicateDeckGroups()
      const groups = dupResult.ok ? (dupResult.data?.groups ?? []) : []

      if (groups.length === 0) {
        return { ok: true, data: { mergedCount: 0, movedCards: 0, deletedDuplicates: 0 } }
      }

      let totalMerged = 0
      let totalMoved = 0
      let totalDeleted = 0

      for (const group of groups) {
        // Step 2: Determine Master (most cards) and Donors
        const decksWithCounts = group.deckIds.map((id, i) => ({
          id,
          count: group.cardCounts[i],
        }))
        decksWithCounts.sort((a, b) => b.count - a.count) // Descending by count

        const masterId = decksWithCounts[0].id
        const donorIds = decksWithCounts.slice(1).map(d => d.id)

        // Step 3: Get all cards from Master deck (for stem comparison)
        const { data: masterCards } = await supabase
          .from('card_templates')
          .select('id, stem')
          .eq('deck_template_id', masterId)

        const masterStems = new Set(
          (masterCards || []).map(c => normalizeStem(c.stem))
        )

        // Step 4: Process each Donor deck
        for (const donorId of donorIds) {
          const { data: donorCards } = await supabase
            .from('card_templates')
            .select('id, stem')
            .eq('deck_template_id', donorId)

          for (const donorCard of donorCards || []) {
            const normalizedStem = normalizeStem(donorCard.stem)

            if (masterStems.has(normalizedStem)) {
              // Duplicate stem - delete Donor card
              // First delete progress records
              await supabase
                .from('user_card_progress')
                .delete()
                .eq('card_template_id', donorCard.id)

              // Then delete the card
              await supabase
                .from('card_templates')
                .delete()
                .eq('id', donorCard.id)

              totalDeleted++
            } else {
              // Unique stem - move to Master deck
              await supabase
                .from('card_templates')
                .update({ deck_template_id: masterId })
                .eq('id', donorCard.id)

              // Add to master stems set to prevent future duplicates
              masterStems.add(normalizedStem)
              totalMoved++
            }
          }

          // Step 5: Delete empty Donor deck_template
          await supabase
            .from('deck_templates')
            .delete()
            .eq('id', donorId)

          // Step 6: Update user_decks - remove subscriptions to deleted deck
          await supabase
            .from('user_decks')
            .delete()
            .eq('deck_template_id', donorId)

          totalMerged++
        }
      }

      // Revalidate dashboard
      revalidatePath('/dashboard')

      return {
        ok: true,
        data: {
          mergedCount: totalMerged,
          movedCards: totalMoved,
          deletedDuplicates: totalDeleted,
        },
      }
    } catch (error) {
      logger.error('mergeDuplicateDecks', error)
      return { ok: false, error: 'Failed to merge duplicate decks' }
    }
  }, RATE_LIMITS.standard)
}
