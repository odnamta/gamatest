'use server'

import { revalidatePath } from 'next/cache'
import { withUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import type { ActionResultV2 } from '@/types/actions'

/**
 * V10.6: Digital Notebook Server Actions
 * Handles flag toggle, notes saving, and card search
 */

// ============================================
// Types
// ============================================

export interface SearchResult {
  id: string
  stem: string
  snippet: string
  deckTitle: string
  deckTemplateId: string
  type: 'card' | 'deck' | 'assessment'
  /** For deck results: href to navigate to */
  href?: string
}

// ============================================
// Flag Toggle
// ============================================

/**
 * Toggles the flag status of a card for the current user.
 * Creates a progress record if one doesn't exist.
 * 
 * Requirements: 1.1, 6.3
 * 
 * @param cardTemplateId - The card template to toggle flag for
 * @returns ToggleFlagResult with new flag state
 */
export async function toggleCardFlag(cardTemplateId: string): Promise<ActionResultV2<{ isFlagged: boolean }>> {
  return withUser(async ({ user, supabase }) => {
    // Get current progress record
    const { data: existing } = await supabase
      .from('user_card_progress')
      .select('is_flagged')
      .eq('user_id', user.id)
      .eq('card_template_id', cardTemplateId)
      .single()

    const currentFlagged = existing?.is_flagged ?? false
    const newFlagged = !currentFlagged

    // Upsert the progress record with toggled flag
    const { error: upsertError } = await supabase
      .from('user_card_progress')
      .upsert({
        user_id: user.id,
        card_template_id: cardTemplateId,
        is_flagged: newFlagged,
        // Default values for new records
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        next_review: new Date().toISOString(),
        suspended: false,
        correct_count: 0,
        total_attempts: 0,
      }, {
        onConflict: 'user_id,card_template_id',
      })

    if (upsertError) {
      return { ok: false, error: upsertError.message }
    }

    // Revalidate study pages
    revalidatePath('/study')
    revalidatePath('/dashboard')

    return { ok: true, data: { isFlagged: newFlagged } }
  }, RATE_LIMITS.sensitive)
}

// ============================================
// Notes
// ============================================

/**
 * Saves notes for a card for the current user.
 * Creates a progress record if one doesn't exist.
 * 
 * Requirements: 2.2, 6.4
 * 
 * @param cardTemplateId - The card template to save notes for
 * @param notes - The notes content (empty string clears notes)
 * @returns SaveNotesResult
 */
export async function saveCardNotes(
  cardTemplateId: string,
  notes: string
): Promise<ActionResultV2> {
  return withUser(async ({ user, supabase }) => {
    // Upsert the progress record with notes
    const { error: upsertError } = await supabase
      .from('user_card_progress')
      .upsert({
        user_id: user.id,
        card_template_id: cardTemplateId,
        notes: notes || null, // Convert empty string to null
        // Default values for new records
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0,
        next_review: new Date().toISOString(),
        suspended: false,
        correct_count: 0,
        total_attempts: 0,
        is_flagged: false,
      }, {
        onConflict: 'user_id,card_template_id',
      })

    if (upsertError) {
      return { ok: false, error: upsertError.message }
    }

    return { ok: true }
  }, RATE_LIMITS.sensitive)
}

// ============================================
// Search
// ============================================

const MAX_SEARCH_RESULTS = 10

/** Sanitize user input for PostgREST .or() filter strings — escape characters that could manipulate filter syntax */
function sanitizeForPostgrest(input: string): string {
  return input.replace(/[,().\\]/g, '\\$&')
}

/**
 * Creates a snippet from text with the query highlighted.
 * Returns first 150 chars around the match.
 */
function createSnippet(text: string, query: string): string {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matchIndex = lowerText.indexOf(lowerQuery)
  
  if (matchIndex === -1) {
    return text.slice(0, 150) + (text.length > 150 ? '...' : '')
  }
  
  // Get context around the match
  const start = Math.max(0, matchIndex - 50)
  const end = Math.min(text.length, matchIndex + query.length + 100)
  
  let snippet = ''
  if (start > 0) snippet += '...'
  snippet += text.slice(start, end)
  if (end < text.length) snippet += '...'
  
  return snippet
}

/**
 * Searches cards across user's subscribed decks AND authored decks.
 * V10.6.1: Added author access - authors can search their own decks even without subscription.
 * 
 * Requirements: 3.1, 3.2, 3.3
 * 
 * @param query - Search query string
 * @returns ActionResultV2 with matching cards
 */
export async function searchCards(query: string): Promise<ActionResultV2<{ results: SearchResult[] }>> {
  if (!query || query.trim().length === 0) {
    return { ok: true, data: { results: [] } }
  }

  return withUser(async ({ user, supabase }) => {
    const sanitized = sanitizeForPostgrest(query.trim())
    const searchTerm = `%${sanitized}%`

    // Get user's subscribed deck IDs
    const { data: userDecks, error: decksError } = await supabase
      .from('user_decks')
      .select('deck_template_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (decksError) {
      return { ok: false, error: decksError.message }
    }

    const subscribedDeckIds = (userDecks || []).map(ud => ud.deck_template_id)

    // V10.6.1: Get authored deck IDs (authors can search their own decks)
    const { data: authoredDecks, error: authoredError } = await supabase
      .from('deck_templates')
      .select('id')
      .eq('author_id', user.id)

    if (authoredError) {
      return { ok: false, error: authoredError.message }
    }

    const authoredDeckIds = (authoredDecks || []).map(d => d.id)

    // Combine subscribed + authored, deduplicate
    const accessibleDeckIds = [...new Set([...subscribedDeckIds, ...authoredDeckIds])]

    if (accessibleDeckIds.length === 0) {
      return { ok: true, data: { results: [] } }
    }

    // Search card_templates in accessible decks
    const { data: cards, error: searchError } = await supabase
      .from('card_templates')
      .select(`
        id,
        stem,
        explanation,
        deck_template_id,
        deck_templates!inner(id, title)
      `)
      .in('deck_template_id', accessibleDeckIds)
      .or(`stem.ilike.${searchTerm},explanation.ilike.${searchTerm}`)
      .limit(MAX_SEARCH_RESULTS)

    if (searchError) {
      return { ok: false, error: searchError.message }
    }

    // Transform results
    const results: SearchResult[] = (cards || []).map(card => {
      const deckTemplate = card.deck_templates as unknown as { id: string; title: string }
      const snippet = createSnippet(card.stem, query) ||
                     (card.explanation ? createSnippet(card.explanation, query) : '')

      return {
        id: card.id,
        stem: card.stem,
        snippet,
        deckTitle: deckTemplate.title,
        deckTemplateId: card.deck_template_id,
        type: 'card' as const,
      }
    })

    return { ok: true, data: { results } }
  }, RATE_LIMITS.standard)
}

/**
 * Global search across cards, decks, and assessments.
 */
export async function globalSearch(query: string): Promise<ActionResultV2<{ results: SearchResult[] }>> {
  if (!query || query.trim().length === 0) return { ok: true, data: { results: [] } }

  return withUser(async ({ user, supabase }) => {
    const sanitized = sanitizeForPostgrest(query.trim())
    const searchTerm = `%${sanitized}%`

    // Run card search + deck search + assessment search in parallel
    const [cardResult, deckResult, assessmentResult] = await Promise.all([
      searchCards(query),
      (async () => {
        const { data: decks } = await supabase
          .from('deck_templates')
          .select('id, title, subject, description')
          .eq('author_id', user.id)
          .or(`title.ilike.${searchTerm},subject.ilike.${searchTerm}`)
          .limit(5)
        return decks || []
      })(),
      (async () => {
        const { data: assessments } = await supabase
          .from('assessments')
          .select('id, title, description')
          .ilike('title', searchTerm)
          .limit(5)
        return assessments || []
      })(),
    ])

    const results: SearchResult[] = []

    // Add deck results first
    for (const deck of deckResult) {
      results.push({
        id: deck.id,
        stem: deck.title,
        snippet: deck.subject || deck.description || '',
        deckTitle: '',
        deckTemplateId: deck.id,
        type: 'deck',
        href: `/decks/${deck.id}`,
      })
    }

    // Add assessment results
    for (const a of assessmentResult) {
      results.push({
        id: a.id,
        stem: a.title,
        snippet: a.description || '',
        deckTitle: '',
        deckTemplateId: '',
        type: 'assessment',
        href: `/assessments`,
      })
    }

    // Add card results (already typed)
    if (cardResult.ok && cardResult.data) {
      results.push(...cardResult.data.results)
    }

    return { ok: true, data: { results: results.slice(0, 15) } }
  }, RATE_LIMITS.standard)
}

// ============================================
// Get Card with Progress (for preview modal)
// ============================================

export interface CardWithProgress {
  id: string
  stem: string
  options: string[]
  correct_index: number
  explanation: string | null
  deck_template_id: string
  deckTitle: string
  is_flagged: boolean
  notes: string | null
}

/**
 * Gets a single card with user's progress data.
 * Used for the preview modal.
 *
 * @param cardTemplateId - The card template ID
 * @returns ActionResultV2 with card data
 */
export async function getCardWithProgress(cardTemplateId: string): Promise<ActionResultV2<CardWithProgress>> {
  return withUser(async ({ user, supabase }) => {
    // Get card template with deck info
    const { data: card, error: cardError } = await supabase
      .from('card_templates')
      .select(`
        id,
        stem,
        options,
        correct_index,
        explanation,
        deck_template_id,
        deck_templates!inner(id, title)
      `)
      .eq('id', cardTemplateId)
      .single()

    if (cardError || !card) {
      return { ok: false, error: cardError?.message || 'Card not found' }
    }

    // Get user's progress for this card
    const { data: progress } = await supabase
      .from('user_card_progress')
      .select('is_flagged, notes')
      .eq('user_id', user.id)
      .eq('card_template_id', cardTemplateId)
      .single()

    const deckTemplate = card.deck_templates as unknown as { id: string; title: string }

    return {
      ok: true,
      data: {
        id: card.id,
        stem: card.stem,
        options: card.options,
        correct_index: card.correct_index,
        explanation: card.explanation,
        deck_template_id: card.deck_template_id,
        deckTitle: deckTemplate.title,
        is_flagged: progress?.is_flagged ?? false,
        notes: progress?.notes ?? null,
      },
    }
  }, RATE_LIMITS.standard)
}
