'use server'

import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { computeGlobalDueCount } from '@/lib/global-due-count'
import { computeDailyProgress } from '@/lib/daily-progress'
import type { Card, MCQCard } from '@/types/database'

/**
 * Global Study Server Actions
 * Server actions for cross-deck study functionality.
 * Requirements: 2.2, 2.3
 * 
 * Feature: v3-ux-overhaul
 */

export interface GlobalDueCardsResult {
  cards: (Card | MCQCard)[]
  totalDue: number
  isNewCardsFallback: boolean
  error?: string
}

export interface GlobalStatsResult {
  totalDueCount: number
  completedToday: number
  hasNewCards: boolean
  error?: string
}

/**
 * Fetches due cards across all user decks.
 * Orders by next_review ASC, limits to 50 cards.
 * Falls back to 10 new cards if no due cards exist.
 * Requirements: 2.2, 2.3
 */
export async function getGlobalDueCards(): Promise<GlobalDueCardsResult> {
  const user = await getUser()
  if (!user) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch user's deck IDs first
  const { data: decks, error: decksError } = await supabase
    .from('decks')
    .select('id')
    .eq('user_id', user.id)

  if (decksError) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false, error: decksError.message }
  }

  const deckIds = (decks || []).map(d => d.id)
  
  if (deckIds.length === 0) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false }
  }

  // Fetch due flashcards across all decks
  const { data: dueCards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .in('deck_id', deckIds)
    .lte('next_review', now)
    .order('next_review', { ascending: true })
    .limit(50)

  if (cardsError) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false, error: cardsError.message }
  }

  // Fetch due MCQ cards across all decks
  const { data: dueMCQs, error: mcqError } = await supabase
    .from('mcq_cards')
    .select('*')
    .in('deck_id', deckIds)
    .lte('next_review', now)
    .order('next_review', { ascending: true })
    .limit(50)

  if (mcqError) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false, error: mcqError.message }
  }

  // Combine and sort all due cards
  const allDueCards = [
    ...(dueCards || []).map(c => ({ ...c, card_type: 'flashcard' as const })),
    ...(dueMCQs || []).map(c => ({ ...c, card_type: 'mcq' as const }))
  ].sort((a, b) => new Date(a.next_review).getTime() - new Date(b.next_review).getTime())
    .slice(0, 50)

  // If we have due cards, return them
  if (allDueCards.length > 0) {
    // Get total due count for stats
    const { count: totalFlashcardsDue } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .in('deck_id', deckIds)
      .lte('next_review', now)

    const { count: totalMCQsDue } = await supabase
      .from('mcq_cards')
      .select('*', { count: 'exact', head: true })
      .in('deck_id', deckIds)
      .lte('next_review', now)

    return {
      cards: allDueCards as (Card | MCQCard)[],
      totalDue: (totalFlashcardsDue || 0) + (totalMCQsDue || 0),
      isNewCardsFallback: false
    }
  }

  // Fallback: fetch up to 10 new cards (never reviewed)
  // New cards have next_review equal to created_at (default)
  const { data: newCards, error: newCardsError } = await supabase
    .from('cards')
    .select('*')
    .in('deck_id', deckIds)
    .order('created_at', { ascending: true })
    .limit(10)

  if (newCardsError) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false, error: newCardsError.message }
  }

  const { data: newMCQs, error: newMCQsError } = await supabase
    .from('mcq_cards')
    .select('*')
    .in('deck_id', deckIds)
    .order('created_at', { ascending: true })
    .limit(10)

  if (newMCQsError) {
    return { cards: [], totalDue: 0, isNewCardsFallback: false, error: newMCQsError.message }
  }

  const allNewCards = [
    ...(newCards || []).map(c => ({ ...c, card_type: 'flashcard' as const })),
    ...(newMCQs || []).map(c => ({ ...c, card_type: 'mcq' as const }))
  ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 10)

  return {
    cards: allNewCards as (Card | MCQCard)[],
    totalDue: 0,
    isNewCardsFallback: true
  }
}

/**
 * Fetches global stats for the dashboard hero.
 * Returns total due count, completed today, and whether new cards exist.
 * Requirements: 1.2, 1.3, 1.4
 */
export async function getGlobalStats(): Promise<GlobalStatsResult> {
  const user = await getUser()
  if (!user) {
    return { totalDueCount: 0, completedToday: 0, hasNewCards: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()
  const todayDateStr = new Date().toISOString().split('T')[0]

  // Fetch user's deck IDs
  const { data: decks, error: decksError } = await supabase
    .from('decks')
    .select('id')
    .eq('user_id', user.id)

  if (decksError) {
    return { totalDueCount: 0, completedToday: 0, hasNewCards: false, error: decksError.message }
  }

  const deckIds = (decks || []).map(d => d.id)

  // Calculate total due count across all decks
  let totalDueCount = 0
  if (deckIds.length > 0) {
    const { count: flashcardsDue } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .in('deck_id', deckIds)
      .lte('next_review', now)

    const { count: mcqsDue } = await supabase
      .from('mcq_cards')
      .select('*', { count: 'exact', head: true })
      .in('deck_id', deckIds)
      .lte('next_review', now)

    totalDueCount = (flashcardsDue || 0) + (mcqsDue || 0)
  }

  // Fetch today's study log for completed count
  const { data: studyLog, error: logError } = await supabase
    .from('study_logs')
    .select('cards_reviewed')
    .eq('user_id', user.id)
    .eq('study_date', todayDateStr)
    .single()

  if (logError && logError.code !== 'PGRST116') {
    return { totalDueCount: 0, completedToday: 0, hasNewCards: false, error: logError.message }
  }

  const completedToday = computeDailyProgress(studyLog)

  // Check if any cards exist (for empty state detection)
  let hasNewCards = false
  if (deckIds.length > 0) {
    const { count: totalCards } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .in('deck_id', deckIds)

    const { count: totalMCQs } = await supabase
      .from('mcq_cards')
      .select('*', { count: 'exact', head: true })
      .in('deck_id', deckIds)

    hasNewCards = ((totalCards || 0) + (totalMCQs || 0)) > 0
  }

  return {
    totalDueCount,
    completedToday,
    hasNewCards
  }
}

/**
 * Placeholder server action for AI-powered MCQ drafting.
 * Returns a dummy MCQ object (not wired to AI yet).
 * Requirements: 5.4, 5.5
 */
export async function draftMCQFromText(text: string): Promise<{
  success: boolean
  mcq?: {
    question_stem: string
    options: string[]
    correct_index: number
    explanation: string
  }
  error?: string
}> {
  // Placeholder implementation - returns dummy MCQ
  // TODO: Wire to AI service in future
  return {
    success: true,
    mcq: {
      question_stem: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
      options: [
        'Option A (placeholder)',
        'Option B (placeholder)',
        'Option C (placeholder)',
        'Option D (placeholder)'
      ],
      correct_index: 0,
      explanation: 'This is a placeholder explanation. AI integration coming soon.'
    }
  }
}
