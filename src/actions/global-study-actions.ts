'use server'

import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import type { Card, CardTemplate, UserCardProgress } from '@/types/database'

const BATCH_SIZE = 50
const NEW_CARDS_FALLBACK_LIMIT = 10

export interface GlobalDueCardsResult {
  success: boolean
  cards: Card[]
  totalDue: number
  hasMoreBatches: boolean
  isNewCardsFallback: boolean
  error?: string
}

export interface GlobalStatsResult {
  success: boolean
  totalDueCount: number
  completedToday: number
  currentStreak: number
  hasNewCards: boolean
  error?: string
}

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

export async function getGlobalDueCards(batchNumber: number = 0): Promise<GlobalDueCardsResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, cards: [], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  const { data: userDecks, error: userDecksError } = await supabase
    .from('user_decks').select('deck_template_id').eq('user_id', user.id).eq('is_active', true)

  if (userDecksError) {
    return { success: false, cards: [], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false, error: userDecksError.message }
  }

  if (!userDecks || userDecks.length === 0) {
    return { success: true, cards: [], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false }
  }

  const deckTemplateIds = userDecks.map(d => d.deck_template_id)

  const { data: activeCardTemplates } = await supabase
    .from('card_templates').select('id').in('deck_template_id', deckTemplateIds)

  const activeCardIds = (activeCardTemplates || []).map(c => c.id)
  if (activeCardIds.length === 0) {
    return { success: true, cards: [], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false }
  }

  // V8.2: Get existing progress records to identify new cards
  const { data: existingProgress } = await supabase
    .from('user_card_progress').select('card_template_id').eq('user_id', user.id)
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
    return { success: true, cards: [], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false }
  }

  // V8.2: Fetch due cards from progress
  const offset = batchNumber * BATCH_SIZE
  const { data: progressRecords, error: progressError } = await supabase
    .from('user_card_progress').select(`*, card_templates!inner(*)`)
    .eq('user_id', user.id).in('card_template_id', activeCardIds).lte('next_review', now).eq('suspended', false)
    .order('next_review', { ascending: true }).range(offset, offset + BATCH_SIZE - 1)

  if (progressError) {
    return { success: false, cards: [], totalDue: 0, hasMoreBatches: false, isNewCardsFallback: false, error: progressError.message }
  }

  const dueCards = (progressRecords || []).map(record => {
    const ct = record.card_templates as unknown as CardTemplate
    return templateToCard(ct, record as unknown as UserCardProgress)
  })

  // V8.2: Fetch new cards (no progress row) and interleave
  let cards = dueCards
  if (batchNumber === 0 && newCardIds.length > 0) {
    const { data: newCardTemplates } = await supabase
      .from('card_templates').select('*').in('id', newCardIds.slice(0, NEW_CARDS_FALLBACK_LIMIT))
      .order('created_at', { ascending: true })

    const newCards = (newCardTemplates || []).map(ct => templateToCard(ct))
    
    // V8.2: Interleave new cards - 1 new card per 3 due cards
    cards = interleaveCards(dueCards, newCards, 3)
  }

  const isNewCardsFallback = dueProgressCount === 0 && newCardsCount > 0
  return { success: true, cards, totalDue, hasMoreBatches: totalDue > (offset + BATCH_SIZE), isNewCardsFallback }
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

export async function getGlobalStats(): Promise<GlobalStatsResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, totalDueCount: 0, completedToday: 0, currentStreak: 0, hasNewCards: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()
  const todayDateStr = new Date().toISOString().split('T')[0]

  const { data: userDecks } = await supabase
    .from('user_decks').select('deck_template_id').eq('user_id', user.id).eq('is_active', true)

  const { data: studyLog } = await supabase
    .from('study_logs').select('cards_reviewed').eq('user_id', user.id).eq('study_date', todayDateStr).single()

  const { data: userStats } = await supabase
    .from('user_stats').select('current_streak').eq('user_id', user.id).single()

  if (!userDecks || userDecks.length === 0) {
    return { success: true, totalDueCount: 0, completedToday: studyLog?.cards_reviewed || 0, currentStreak: userStats?.current_streak || 0, hasNewCards: false }
  }

  const deckTemplateIds = userDecks.map(d => d.deck_template_id)
  const { data: activeCardTemplates } = await supabase
    .from('card_templates').select('id').in('deck_template_id', deckTemplateIds)

  const activeCardIds = (activeCardTemplates || []).map(c => c.id)
  let totalDueCount = 0

  if (activeCardIds.length > 0) {
    const { count } = await supabase
      .from('user_card_progress').select('card_template_id', { count: 'exact', head: true })
      .eq('user_id', user.id).in('card_template_id', activeCardIds).lte('next_review', now).eq('suspended', false)
    totalDueCount = count || 0
  }

  const { count: totalCardsCount } = await supabase
    .from('card_templates').select('*', { count: 'exact', head: true }).in('deck_template_id', deckTemplateIds)

  return {
    success: true,
    totalDueCount,
    completedToday: studyLog?.cards_reviewed || 0,
    currentStreak: userStats?.current_streak || 0,
    hasNewCards: (totalCardsCount || 0) > 0,
  }
}

export const getGlobalDueCardsV2 = getGlobalDueCards
export const getGlobalStatsV2 = getGlobalStats

export async function upsertCardProgress(
  cardTemplateId: string,
  srsUpdate: { interval: number; easeFactor: number; nextReview: Date }
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser()
  if (!user) return { success: false, error: 'Authentication required' }

  const supabase = await createSupabaseServerClient()
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

  return error ? { success: false, error: error.message } : { success: true }
}

export async function draftMCQFromText(text: string): Promise<{
  success: boolean
  mcq?: { stem: string; options: string[]; correct_index: number; explanation: string }
  error?: string
}> {
  return { success: true, mcq: { stem: 'AI Draft Placeholder', options: ['A', 'B', 'C', 'D'], correct_index: 0, explanation: 'AI explanation placeholder.' } }
}
