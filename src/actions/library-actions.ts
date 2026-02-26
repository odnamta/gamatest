'use server'

import { revalidatePath } from 'next/cache'
import { withOrgUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import type { BrowseDeckItem, MyDeckItem } from '@/types/database'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Fetches deck templates visible to the current user for the library browse page.
 * Returns decks where visibility = 'public' OR author_id = user_id.
 *
 * Requirements: 1.1, 1.3, 1.4
 */
export async function getBrowseDecksForUser(): Promise<ActionResultV2<{ decks: BrowseDeckItem[] }>> {
  return withOrgUser(async ({ user, supabase }) => {
    try {
      // Query deck_templates with card count
      // Filter: visibility = 'public' OR author_id = user_id
      const { data: deckTemplates, error: decksError } = await supabase
        .from('deck_templates')
        .select(`
          id,
          title,
          description,
          visibility,
          author_id,
          created_at,
          card_templates(count)
        `)
        .or(`visibility.eq.public,author_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (decksError) {
        return { ok: false, error: decksError.message }
      }

      if (!deckTemplates || deckTemplates.length === 0) {
        return { ok: true, data: { decks: [] } }
      }


      // Get user's active subscriptions
      const { data: userDecks, error: userDecksError } = await supabase
        .from('user_decks')
        .select('deck_template_id')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (userDecksError) {
        return { ok: false, error: userDecksError.message }
      }

      const subscribedDeckIds = new Set((userDecks || []).map(ud => ud.deck_template_id))

      // Transform to BrowseDeckItem format
      const decks: BrowseDeckItem[] = deckTemplates.map(dt => ({
        id: dt.id,
        title: dt.title,
        description: dt.description,
        visibility: dt.visibility as 'public' | 'private',
        author_id: dt.author_id,
        card_count: (dt.card_templates as unknown as { count: number }[])?.[0]?.count ?? 0,
        isSubscribed: subscribedDeckIds.has(dt.id),
        isAuthor: dt.author_id === user.id,
        created_at: dt.created_at,
      }))

      return { ok: true, data: { decks } }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, undefined, RATE_LIMITS.standard)
}

/**
 * Creates or reactivates a subscription to a deck template.
 * Validates deck visibility before subscription.
 * Does NOT create user_card_progress records (lazy seeding).
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */
export async function subscribeToDeck(deckTemplateId: string): Promise<ActionResultV2> {
  return withOrgUser(async ({ user, supabase }) => {
    try {
      // Validate deck is visible to user
      const { data: deck, error: deckError } = await supabase
        .from('deck_templates')
        .select('id, visibility, author_id')
        .eq('id', deckTemplateId)
        .single()

      if (deckError || !deck) {
        return { ok: false, error: 'Deck not found' }
      }

      // Check visibility: must be public OR user is author
      if (deck.visibility !== 'public' && deck.author_id !== user.id) {
        return { ok: false, error: 'Deck not found or not accessible' }
      }

      // Upsert subscription (create or reactivate)
      const { error: upsertError } = await supabase
        .from('user_decks')
        .upsert({
          user_id: user.id,
          deck_template_id: deckTemplateId,
          is_active: true,
        }, {
          onConflict: 'user_id,deck_template_id',
        })

      if (upsertError) {
        return { ok: false, error: upsertError.message }
      }

      revalidatePath('/library')
      revalidatePath('/library/my')

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, undefined, RATE_LIMITS.sensitive)
}


/**
 * Fetches the user's actively subscribed decks with study statistics.
 * Returns decks where user_decks.is_active = true.
 *
 * Requirements: 3.1, 3.2, 3.3
 */
export async function getUserSubscribedDecks(): Promise<ActionResultV2<{ decks: MyDeckItem[] }>> {
  return withOrgUser(async ({ user, supabase }) => {
    try {
      const now = new Date().toISOString()

      // Get user's active subscriptions with deck info
      const { data: userDecks, error: userDecksError } = await supabase
        .from('user_decks')
        .select(`
          deck_template_id,
          deck_templates!inner(
            id,
            title,
            description,
            author_id,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (userDecksError) {
        return { ok: false, error: userDecksError.message }
      }

      if (!userDecks || userDecks.length === 0) {
        return { ok: true, data: { decks: [] } }
      }

      const deckTemplateIds = userDecks.map(ud => ud.deck_template_id)

      // Get card counts per deck
      const { data: cardCounts, error: cardCountError } = await supabase
        .from('card_templates')
        .select('deck_template_id')
        .in('deck_template_id', deckTemplateIds)

      if (cardCountError) {
        return { ok: false, error: cardCountError.message }
      }

      // Count cards per deck
      const cardCountMap = new Map<string, number>()
      for (const card of cardCounts || []) {
        const count = cardCountMap.get(card.deck_template_id) || 0
        cardCountMap.set(card.deck_template_id, count + 1)
      }

      // Get due counts from user_card_progress
      const { data: dueProgress, error: dueError } = await supabase
        .from('user_card_progress')
        .select(`
          card_template_id,
          card_templates!inner(deck_template_id)
        `)
        .eq('user_id', user.id)
        .lte('next_review', now)
        .eq('suspended', false)

      if (dueError) {
        return { ok: false, error: dueError.message }
      }

      // Count due cards per deck
      const dueCountMap = new Map<string, number>()
      for (const progress of dueProgress || []) {
        const deckId = (progress.card_templates as unknown as { deck_template_id: string }).deck_template_id
        const count = dueCountMap.get(deckId) || 0
        dueCountMap.set(deckId, count + 1)
      }

      // Get all progress records to calculate new cards
      const { data: allProgress, error: progressError } = await supabase
        .from('user_card_progress')
        .select('card_template_id')
        .eq('user_id', user.id)

      if (progressError) {
        return { ok: false, error: progressError.message }
      }

      const progressCardIds = new Set((allProgress || []).map(p => p.card_template_id))

      // Get all card IDs per deck to calculate new count
      const { data: allCards, error: allCardsError } = await supabase
        .from('card_templates')
        .select('id, deck_template_id')
        .in('deck_template_id', deckTemplateIds)

      if (allCardsError) {
        return { ok: false, error: allCardsError.message }
      }

      // Count new cards per deck (cards without progress)
      const newCountMap = new Map<string, number>()
      for (const card of allCards || []) {
        if (!progressCardIds.has(card.id)) {
          const count = newCountMap.get(card.deck_template_id) || 0
          newCountMap.set(card.deck_template_id, count + 1)
        }
      }

      // Transform to MyDeckItem format
      const decks: MyDeckItem[] = userDecks.map(ud => {
        const dt = ud.deck_templates as unknown as {
          id: string
          title: string
          description: string | null
          author_id: string
          created_at: string
        }
        return {
          id: dt.id,
          title: dt.title,
          description: dt.description,
          card_count: cardCountMap.get(dt.id) || 0,
          due_count: dueCountMap.get(dt.id) || 0,
          new_count: newCountMap.get(dt.id) || 0,
          isAuthor: dt.author_id === user.id,
          created_at: dt.created_at,
        }
      })

      return { ok: true, data: { decks } }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, undefined, RATE_LIMITS.standard)
}


/**
 * Soft-deletes a subscription by setting is_active to false.
 * Preserves all user_card_progress records.
 *
 * Requirements: 4.1, 4.2
 */
export async function unsubscribeFromDeck(deckTemplateId: string): Promise<ActionResultV2> {
  return withOrgUser(async ({ user, supabase }) => {
    try {
      // Soft delete: set is_active = false
      const { error } = await supabase
        .from('user_decks')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('deck_template_id', deckTemplateId)

      if (error) {
        return { ok: false, error: error.message }
      }

      revalidatePath('/library/my')

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, undefined, RATE_LIMITS.sensitive)
}
