'use server'

import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import type { Card } from '@/types/database'
import type { SessionMode } from '@/lib/custom-session-params'

/**
 * Input for getCustomSessionCards
 */
export interface CustomSessionInput {
  tagIds?: string[]
  deckIds?: string[]
  mode: SessionMode
  limit: number
}

/**
 * Result type for getCustomSessionCards
 */
export interface CustomSessionResult {
  success: boolean
  cards: Card[]
  totalMatching: number
  error?: string
}

/**
 * Fisher-Yates shuffle algorithm for randomizing card order.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Fetches cards for a custom study session.
 * 
 * Query logic:
 * - Fetch cards matching ANY selected tag OR belonging to ANY selected deck (OR semantics)
 * - If mode === 'due': filter to next_review <= now
 * - If mode === 'cram': no SRS filter, include all matching cards
 * 
 * V6.3: Custom Cram Mode
 */
export async function getCustomSessionCards(
  input: CustomSessionInput
): Promise<CustomSessionResult> {
  const user = await getUser()
  if (!user) {
    return {
      success: false,
      cards: [],
      totalMatching: 0,
      error: 'Authentication required',
    }
  }

  const { tagIds = [], deckIds = [], mode, limit } = input
  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  // Must have at least one filter
  if (tagIds.length === 0 && deckIds.length === 0) {
    return {
      success: false,
      cards: [],
      totalMatching: 0,
      error: 'Please select at least one tag or deck',
    }
  }

  try {
    // Get all user's deck IDs for ownership verification
    const { data: userDecks, error: decksError } = await supabase
      .from('decks')
      .select('id')
      .eq('user_id', user.id)

    if (decksError) {
      return {
        success: false,
        cards: [],
        totalMatching: 0,
        error: decksError.message,
      }
    }

    const userDeckIds = new Set(userDecks?.map(d => d.id) || [])
    
    // Validate that requested deckIds belong to user
    const validDeckIds = deckIds.filter(id => userDeckIds.has(id))

    // Build the query for cards
    // We need to handle OR semantics: cards matching ANY tag OR ANY deck
    let cardIds = new Set<string>()

    // If tags are specified, get cards with those tags
    if (tagIds.length > 0) {
      const { data: taggedCards, error: tagError } = await supabase
        .from('card_tags')
        .select('card_id')
        .in('tag_id', tagIds)

      if (tagError) {
        return {
          success: false,
          cards: [],
          totalMatching: 0,
          error: tagError.message,
        }
      }

      for (const ct of taggedCards || []) {
        cardIds.add(ct.card_id)
      }
    }

    // If decks are specified, get cards from those decks
    if (validDeckIds.length > 0) {
      const { data: deckCards, error: deckError } = await supabase
        .from('cards')
        .select('id')
        .in('deck_id', validDeckIds)

      if (deckError) {
        return {
          success: false,
          cards: [],
          totalMatching: 0,
          error: deckError.message,
        }
      }

      for (const c of deckCards || []) {
        cardIds.add(c.id)
      }
    }

    // If no cards match, return empty
    if (cardIds.size === 0) {
      return {
        success: true,
        cards: [],
        totalMatching: 0,
      }
    }

    // Fetch the actual cards, filtering by ownership and optionally by due date
    let query = supabase
      .from('cards')
      .select('*')
      .in('id', Array.from(cardIds))

    // For 'due' mode, filter to cards that are due
    if (mode === 'due') {
      query = query.lte('next_review', now)
    }

    // Order by next_review for due mode (most overdue first)
    if (mode === 'due') {
      query = query.order('next_review', { ascending: true })
    }

    const { data: cards, error: cardsError } = await query

    if (cardsError) {
      return {
        success: false,
        cards: [],
        totalMatching: 0,
        error: cardsError.message,
      }
    }

    // Filter to only cards from user's decks (ownership check)
    const ownedCards = (cards || []).filter(c => userDeckIds.has(c.deck_id)) as Card[]
    const totalMatching = ownedCards.length

    // Apply limit
    let resultCards = ownedCards.slice(0, limit)

    // For 'cram' mode, shuffle the cards
    if (mode === 'cram') {
      resultCards = shuffleArray(resultCards)
    }

    return {
      success: true,
      cards: resultCards,
      totalMatching,
    }
  } catch (error) {
    console.error('Custom session error:', error)
    return {
      success: false,
      cards: [],
      totalMatching: 0,
      error: 'Failed to fetch cards',
    }
  }
}
