'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'

/**
 * V10.6: Digital Notebook Server Actions
 * Handles flag toggle, notes saving, and card search
 */

// ============================================
// Types
// ============================================

export interface ToggleFlagResult {
  success: boolean
  isFlagged: boolean
  error?: string
}

export interface SaveNotesResult {
  success: boolean
  error?: string
}

export interface SearchResult {
  id: string
  stem: string
  snippet: string
  deckTitle: string
  deckTemplateId: string
}

export interface SearchCardsResult {
  success: boolean
  results: SearchResult[]
  error?: string
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
export async function toggleCardFlag(cardTemplateId: string): Promise<ToggleFlagResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, isFlagged: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

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
    return { success: false, isFlagged: currentFlagged, error: upsertError.message }
  }

  // Revalidate study pages
  revalidatePath('/study')
  revalidatePath('/dashboard')

  return { success: true, isFlagged: newFlagged }
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
): Promise<SaveNotesResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

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
    return { success: false, error: upsertError.message }
  }

  return { success: true }
}

// ============================================
// Search
// ============================================

const MAX_SEARCH_RESULTS = 10

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
 * Searches cards across user's subscribed decks.
 * 
 * Requirements: 3.1, 3.2, 3.3
 * 
 * @param query - Search query string
 * @returns SearchCardsResult with matching cards
 */
export async function searchCards(query: string): Promise<SearchCardsResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, results: [], error: 'Authentication required' }
  }

  if (!query || query.trim().length === 0) {
    return { success: true, results: [] }
  }

  const supabase = await createSupabaseServerClient()
  const searchTerm = `%${query.trim()}%`

  // Get user's subscribed deck IDs
  const { data: userDecks, error: decksError } = await supabase
    .from('user_decks')
    .select('deck_template_id')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (decksError) {
    return { success: false, results: [], error: decksError.message }
  }

  if (!userDecks || userDecks.length === 0) {
    return { success: true, results: [] }
  }

  const subscribedDeckIds = userDecks.map(ud => ud.deck_template_id)

  // Search card_templates in subscribed decks
  const { data: cards, error: searchError } = await supabase
    .from('card_templates')
    .select(`
      id,
      stem,
      explanation,
      deck_template_id,
      deck_templates!inner(id, title)
    `)
    .in('deck_template_id', subscribedDeckIds)
    .or(`stem.ilike.${searchTerm},explanation.ilike.${searchTerm}`)
    .limit(MAX_SEARCH_RESULTS)

  if (searchError) {
    return { success: false, results: [], error: searchError.message }
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
    }
  })

  return { success: true, results }
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

export interface GetCardResult {
  success: boolean
  card?: CardWithProgress
  error?: string
}

/**
 * Gets a single card with user's progress data.
 * Used for the preview modal.
 * 
 * @param cardTemplateId - The card template ID
 * @returns GetCardResult with card data
 */
export async function getCardWithProgress(cardTemplateId: string): Promise<GetCardResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

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
    return { success: false, error: cardError?.message || 'Card not found' }
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
    success: true,
    card: {
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
}
