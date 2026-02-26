'use server'

import { withOrgUser } from '@/actions/_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import type { Card, CardTemplate, UserCardProgress } from '@/types/database'
import type { ActionResultV2 } from '@/types/actions'

const BATCH_SIZE = 50
const NEW_CARDS_FALLBACK_LIMIT = 10

function templateToCard(template: CardTemplate, progress?: UserCardProgress): Card {
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
 * V11.7: Get global due cards with optional tag filtering.
 * When tagIds is provided and non-empty, only returns cards linked to at least one of the tags.
 * 
 * @param batchNumber - Pagination batch number (default 0)
 * @param tagIds - Optional array of tag IDs to filter by (V11.7)
 * 
 * **Feature: v11.7-companion-dashboard-tag-filtered-study**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
export async function getGlobalDueCards(
  batchNumber: number = 0,
  tagIds?: string[]
): Promise<ActionResultV2<{ cards: Card[]; totalDue: number; hasMoreBatches: boolean; isNewCardsFallback: boolean }>> {
  const result = await withOrgUser(async ({ user, supabase, org }) => {
    const now = new Date().toISOString()

    const { data: userDecks, error: userDecksError } = await supabase
      .from('user_decks').select('deck_template_id').eq('user_id', user.id).eq('is_active', true)
      .limit(500)

    if (userDecksError) {
      return { ok: false, error: userDecksError.message }
    }

    if (!userDecks || userDecks.length === 0) {
      return { ok: true, data: { cards: [] as Card[], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false } }
    }

    // V13: Filter subscribed decks to only those in the user's org
    const subscribedIds = userDecks.map(d => d.deck_template_id)
    const { data: orgDecks } = await supabase
      .from('deck_templates')
      .select('id')
      .in('id', subscribedIds)
      .eq('org_id', org.id)
      .limit(500)

    const deckTemplateIds = (orgDecks || []).map(d => d.id)

    if (deckTemplateIds.length === 0) {
      return { ok: true, data: { cards: [] as Card[], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false } }
    }

    // V11.3: Only fetch published cards for study (draft/archived cards are excluded)
    const { data: activeCardTemplates } = await supabase
      .from('card_templates').select('id').in('deck_template_id', deckTemplateIds).eq('status', 'published')
      .limit(10000)

    let activeCardIds = (activeCardTemplates || []).map(c => c.id)
    if (activeCardIds.length === 0) {
      return { ok: true, data: { cards: [] as Card[], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false } }
    }

    // V11.7: Filter by tags if tagIds provided
    const hasTagFilter = tagIds && tagIds.length > 0
    if (hasTagFilter) {
      const { data: taggedCards } = await supabase
        .from('card_template_tags')
        .select('card_template_id')
        .in('tag_id', tagIds)
        .in('card_template_id', activeCardIds)

      const taggedCardIds = new Set((taggedCards || []).map(tc => tc.card_template_id))
      activeCardIds = activeCardIds.filter(id => taggedCardIds.has(id))

      if (activeCardIds.length === 0) {
        return { ok: true, data: { cards: [] as Card[], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false } }
      }
    }

    // V8.2: Get existing progress records to identify new cards
    const { data: existingProgress } = await supabase
      .from('user_card_progress').select('card_template_id').eq('user_id', user.id)
      .limit(50000)
    const existingCardIds = new Set((existingProgress || []).map(p => p.card_template_id))

    // V8.2: Count new cards (no progress row)
    const newCardIds = activeCardIds.filter(id => !existingCardIds.has(id))
    const newCardsCount = newCardIds.length

    const { count: totalDueCount } = await supabase
      .from('user_card_progress').select('card_template_id', { count: 'exact', head: true })
      .eq('user_id', user.id).in('card_template_id', activeCardIds).lte('next_review', now).eq('suspended', false)

    const dueProgressCount = totalDueCount || 0

    // V8.2: Total due = due progress cards + new cards (capped)
    const cappedNewCards = Math.min(newCardsCount, NEW_CARDS_FALLBACK_LIMIT)
    const totalDue = dueProgressCount + cappedNewCards

    if (totalDue === 0) {
      return { ok: true, data: { cards: [] as Card[], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false } }
    }

    // V8.2: Fetch due cards from progress
    const offset = batchNumber * BATCH_SIZE
    const { data: progressRecords, error: progressError } = await supabase
      .from('user_card_progress').select(`id, user_id, card_template_id, interval, ease_factor, next_review, correct_count, total_attempts, card_templates!inner(id, deck_template_id, stem, options, correct_index, explanation)`)
      .eq('user_id', user.id).in('card_template_id', activeCardIds).lte('next_review', now).eq('suspended', false)
      .order('next_review', { ascending: true }).range(offset, offset + BATCH_SIZE - 1)

    if (progressError) {
      return { ok: false, error: progressError.message }
    }

    const dueCards = (progressRecords || []).map(record => {
      const ct = record.card_templates as unknown as CardTemplate
      return templateToCard(ct, record as unknown as UserCardProgress)
    })

    // V8.2: Fetch new cards (no progress row) and interleave
    // V11.3: Only fetch published cards
    let cards = dueCards
    if (batchNumber === 0 && newCardIds.length > 0) {
      const { data: newCardTemplates } = await supabase
        .from('card_templates').select('*').in('id', newCardIds.slice(0, NEW_CARDS_FALLBACK_LIMIT))
        .eq('status', 'published')
        .order('created_at', { ascending: true })

      const newCards = (newCardTemplates || []).map(ct => templateToCard(ct))

      // V8.2: Interleave new cards - 1 new card per 3 due cards
      cards = interleaveCards(dueCards, newCards, 3)
    }

    const isNewCardsFallback = dueProgressCount === 0 && newCardsCount > 0
    return { ok: true, data: { cards, totalDue, hasMoreBatches: totalDue > (offset + BATCH_SIZE), isNewCardsFallback } }
  }, undefined, RATE_LIMITS.standard)

  // withOrgUser already returns ActionResultV2 format on auth/org errors
  return result as ActionResultV2<{ cards: Card[]; totalDue: number; hasMoreBatches: boolean; isNewCardsFallback: boolean }>
}

/**
 * V8.2: Interleave new cards into due cards at a given ratio.
 * E.g., ratio=3 means 1 new card after every 3 due cards.
 */
function interleaveCards(dueCards: Card[], newCards: Card[], ratio: number): Card[] {
  if (newCards.length === 0) return dueCards
  if (dueCards.length === 0) return newCards

  const result: Card[] = []
  let newIndex = 0

  for (let i = 0; i < dueCards.length; i++) {
    result.push(dueCards[i])
    
    // Insert a new card after every `ratio` due cards
    if ((i + 1) % ratio === 0 && newIndex < newCards.length) {
      result.push(newCards[newIndex])
      newIndex++
    }
  }

  // Append remaining new cards at the end
  while (newIndex < newCards.length) {
    result.push(newCards[newIndex])
    newIndex++
  }

  return result
}

export async function getGlobalStats(): Promise<ActionResultV2<{ totalDueCount: number; completedToday: number; currentStreak: number; hasNewCards: boolean }>> {
  const result = await withOrgUser(async ({ user, supabase, org }) => {
    const now = new Date().toISOString()
    const todayDateStr = new Date().toISOString().split('T')[0]

    const { data: userDecks } = await supabase
      .from('user_decks').select('deck_template_id').eq('user_id', user.id).eq('is_active', true)
      .limit(500)

    const { data: studyLog } = await supabase
      .from('study_logs').select('cards_reviewed').eq('user_id', user.id).eq('study_date', todayDateStr).single()

    const { data: userStats } = await supabase
      .from('user_stats').select('current_streak').eq('user_id', user.id).single()

    if (!userDecks || userDecks.length === 0) {
      return { ok: true, data: { totalDueCount: 0, completedToday: studyLog?.cards_reviewed || 0, currentStreak: userStats?.current_streak || 0, hasNewCards: false } }
    }

    // V13: Filter subscribed decks to only those in the user's org
    const subscribedIds = userDecks.map(d => d.deck_template_id)
    const { data: orgDecks } = await supabase
      .from('deck_templates')
      .select('id')
      .in('id', subscribedIds)
      .eq('org_id', org.id)

    const deckTemplateIds = (orgDecks || []).map(d => d.id)

    if (deckTemplateIds.length === 0) {
      return { ok: true, data: { totalDueCount: 0, completedToday: studyLog?.cards_reviewed || 0, currentStreak: userStats?.current_streak || 0, hasNewCards: false } }
    }

    // V11.3: Only count published cards for stats
    const { data: activeCardTemplates } = await supabase
      .from('card_templates').select('id').in('deck_template_id', deckTemplateIds).eq('status', 'published')
      .limit(10000)

    const activeCardIds = (activeCardTemplates || []).map(c => c.id)
    let totalDueCount = 0

    if (activeCardIds.length > 0) {
      const { count } = await supabase
        .from('user_card_progress').select('card_template_id', { count: 'exact', head: true })
        .eq('user_id', user.id).in('card_template_id', activeCardIds).lte('next_review', now).eq('suspended', false)
      totalDueCount = count || 0
    }

    // V11.3: Only count published cards
    const { count: totalCardsCount } = await supabase
      .from('card_templates').select('*', { count: 'exact', head: true }).in('deck_template_id', deckTemplateIds).eq('status', 'published')

    return {
      ok: true,
      data: {
        totalDueCount,
        completedToday: studyLog?.cards_reviewed || 0,
        currentStreak: userStats?.current_streak || 0,
        hasNewCards: (totalCardsCount || 0) > 0,
      },
    }
  }, undefined, RATE_LIMITS.standard)

  // withOrgUser already returns ActionResultV2 format on auth/org errors
  return result as ActionResultV2<{ totalDueCount: number; completedToday: number; currentStreak: number; hasNewCards: boolean }>
}

export async function upsertCardProgress(
  cardTemplateId: string,
  srsUpdate: { interval: number; easeFactor: number; nextReview: Date }
): Promise<ActionResultV2> {
  const result = await withOrgUser(async ({ user, supabase, org }) => {
    // V13: Verify card_template belongs to a deck in the user's org
    const { data: cardTemplate } = await supabase
      .from('card_templates')
      .select('deck_template_id')
      .eq('id', cardTemplateId)
      .single()

    if (!cardTemplate) {
      return { ok: false, error: 'Card not found' }
    }

    const { data: deck } = await supabase
      .from('deck_templates')
      .select('id')
      .eq('id', cardTemplate.deck_template_id)
      .eq('org_id', org.id)
      .single()

    if (!deck) {
      return { ok: false, error: 'Card does not belong to your organization' }
    }

    const { error } = await supabase.from('user_card_progress').upsert({
      user_id: user.id,
      card_template_id: cardTemplateId,
      interval: srsUpdate.interval,
      ease_factor: srsUpdate.easeFactor,
      next_review: srsUpdate.nextReview.toISOString(),
      last_answered_at: new Date().toISOString(),
      repetitions: srsUpdate.interval > 0 ? 1 : 0,
      suspended: false,
    }, { onConflict: 'user_id,card_template_id' })

    return error ? { ok: false, error: error.message } : { ok: true }
  }, undefined, RATE_LIMITS.standard)

  // withOrgUser already returns ActionResultV2 format on auth/org errors
  return result as ActionResultV2
}

