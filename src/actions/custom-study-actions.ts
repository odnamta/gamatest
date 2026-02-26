'use server'

import { withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import type { Card, CardTemplate, UserCardProgress } from '@/types/database'
import type { SessionMode } from '@/lib/custom-session-params'
import type { ActionResultV2 } from '@/types/actions'

/**
 * Input for getCustomSessionCards
 */
export interface CustomSessionInput {
  tagIds?: string[]
  deckIds?: string[]
  mode: SessionMode
  limit: number
  // V10.6: Flagged only filter
  flaggedOnly?: boolean
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


// ============================================
// V6.4: Shared Library V2 Functions
// ============================================

/**
 * Converts a CardTemplate (with optional progress) to Card-compatible format.
 */
function templateToCard(
  template: CardTemplate,
  progress?: UserCardProgress
): Card {
  return {
    id: template.id,
    deck_id: template.deck_template_id,
    card_type: 'mcq',
    front: template.stem,
    back: template.explanation || '',
    stem: template.stem,
    options: template.options,
    correct_index: template.correct_index,
    explanation: template.explanation,
    image_url: null,
    interval: progress?.interval ?? 0,
    ease_factor: progress?.ease_factor ?? 2.5,
    next_review: progress?.next_review ?? new Date().toISOString(),
    created_at: template.created_at,
    // V10.6: Digital Notebook
    is_flagged: progress?.is_flagged ?? false,
    notes: progress?.notes ?? null,
  }
}

/**
 * V8.0: Fetches cards for a custom study session using V2 schema only.
 * 
 * Query logic:
 * - Fetch card_templates matching ANY selected tag OR belonging to ANY selected deck_template
 * - Join with user_card_progress for SRS state
 * - If mode === 'due': filter to next_review <= now
 * - If mode === 'cram': no SRS filter, include all matching cards
 * 
 * Requirements: V8 2.5
 */
export async function getCustomSessionCardsV2(
  input: CustomSessionInput
): Promise<ActionResultV2<{ cards: Card[]; totalMatching: number }>> {
  const result = await withOrgUser(async ({ user, supabase, org }) => {
    const { tagIds = [], deckIds = [], mode, limit, flaggedOnly = false } = input
    const now = new Date().toISOString()

    // Must have at least one filter
    if (tagIds.length === 0 && deckIds.length === 0) {
      return {
        ok: false as const,
        error: 'Please select at least one tag or deck',
      }
    }

    try {
      // Get user's subscribed deck_templates
      const { data: userDecks, error: userDecksError } = await supabase
        .from('user_decks')
        .select('deck_template_id')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (userDecksError) {
        return { ok: false as const, error: userDecksError.message }
      }

      // V13: Filter subscribed decks to only those in the user's org
      const subscribedIds = (userDecks || []).map(d => d.deck_template_id)
      const { data: orgDecks } = await supabase
        .from('deck_templates')
        .select('id')
        .in('id', subscribedIds.length > 0 ? subscribedIds : ['__none__'])
        .eq('org_id', org.id)

      const userDeckTemplateIds = new Set((orgDecks || []).map(d => d.id))

      // Validate that requested deckIds belong to user's org-scoped subscriptions
      const validDeckIds = deckIds.filter(id => userDeckTemplateIds.has(id))

      // Build the query for card_templates
      // We need to handle OR semantics: cards matching ANY tag OR ANY deck
      const cardTemplateIds = new Set<string>()

      // If tags are specified, get card_templates with those tags
      if (tagIds.length > 0) {
        const { data: taggedCards, error: tagError } = await supabase
          .from('card_template_tags')
          .select('card_template_id')
          .in('tag_id', tagIds)

        if (tagError) {
          return { ok: false as const, error: tagError.message }
        }

        for (const ct of taggedCards || []) {
          cardTemplateIds.add(ct.card_template_id)
        }
      }

      // If decks are specified, get card_templates from those deck_templates
      if (validDeckIds.length > 0) {
        const { data: deckCards, error: deckError } = await supabase
          .from('card_templates')
          .select('id')
          .in('deck_template_id', validDeckIds)

        if (deckError) {
          return { ok: false as const, error: deckError.message }
        }

        for (const c of deckCards || []) {
          cardTemplateIds.add(c.id)
        }
      }

      // If no cards match, return empty
      if (cardTemplateIds.size === 0) {
        return { ok: true as const, data: { cards: [] as Card[], totalMatching: 0 } }
      }

      // Fetch card_templates with their progress
      const cardTemplateIdArray = Array.from(cardTemplateIds)

      // Get all matching card_templates
      const { data: cardTemplates, error: templatesError } = await supabase
        .from('card_templates')
        .select('id, deck_template_id, stem, options, correct_index, explanation, status')
        .in('id', cardTemplateIdArray)

      if (templatesError) {
        return { ok: false as const, error: templatesError.message }
      }

      // Get user's progress for these cards
      const { data: progressRecords, error: progressError } = await supabase
        .from('user_card_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('card_template_id', cardTemplateIdArray)

      if (progressError) {
        return { ok: false as const, error: progressError.message }
      }

      // Create a map of progress by card_template_id
      const progressMap = new Map<string, UserCardProgress>()
      for (const p of progressRecords || []) {
        progressMap.set(p.card_template_id, p as UserCardProgress)
      }

      // Filter to only cards from user's org-scoped subscribed decks
      const ownedTemplates = (cardTemplates || []).filter(
        ct => userDeckTemplateIds.has(ct.deck_template_id)
      ) as CardTemplate[]

      // Convert to Card format with progress
      let cards = ownedTemplates.map(ct => {
        const progress = progressMap.get(ct.id)
        return templateToCard(ct, progress)
      })

      // For 'due' mode, filter to cards that are due
      if (mode === 'due') {
        cards = cards.filter(c => new Date(c.next_review) <= new Date(now))
        // Sort by next_review ascending (most overdue first)
        cards.sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime())
      }

      // V10.6: Filter to flagged cards only if requested
      if (flaggedOnly) {
        cards = cards.filter(c => c.is_flagged === true)
      }

      const totalMatching = cards.length

      // Apply limit
      let resultCards = cards.slice(0, limit)

      // For 'cram' mode, shuffle the cards
      if (mode === 'cram') {
        resultCards = shuffleArray(resultCards)
      }

      return {
        ok: true as const,
        data: { cards: resultCards, totalMatching },
      }
    } catch (error) {
      logger.error('getCustomSessionCards', error)
      return { ok: false as const, error: 'Failed to fetch cards' }
    }
  })

  // withOrgUser already returns { ok: false, error } for auth/org errors
  return result as ActionResultV2<{ cards: Card[]; totalMatching: number }>
}

/**
 * V8.0: Legacy getCustomSessionCards redirects to V2
 * @deprecated Use getCustomSessionCardsV2 directly
 */
export async function getCustomSessionCards(
  input: CustomSessionInput
): Promise<ActionResultV2<{ cards: Card[]; totalMatching: number }>> {
  return getCustomSessionCardsV2(input)
}
