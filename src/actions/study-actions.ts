'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { ratingSchema } from '@/lib/validations'
import { calculateNextReview } from '@/lib/sm2'
import { calculateStreak, updateLongestStreak, incrementTotalReviews } from '@/lib/streak'
import type { NextCardResult } from '@/types/actions'
import type { Card } from '@/types/database'

/**
 * Server Action for rating a card during study.
 * Integrates SM-2 algorithm for card updates, updates user stats (streak, total reviews),
 * upserts study logs, and returns next due card.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 5.4, 9.4
 */
export async function rateCardAction(
  cardId: string,
  rating: 1 | 2 | 3 | 4
): Promise<NextCardResult> {
  // Server-side Zod validation
  const validationResult = ratingSchema.safeParse({ cardId, rating })
  
  if (!validationResult.success) {
    return { success: false, error: 'Invalid rating data' }
  }

  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch the card with deck info to verify ownership
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select(`
      *,
      decks!inner(user_id)
    `)
    .eq('id', cardId)
    .single()

  if (cardError || !card) {
    return { success: false, error: 'Card not found or access denied' }
  }

  // Calculate new SM-2 values
  const sm2Result = calculateNextReview({
    interval: card.interval,
    easeFactor: card.ease_factor,
    rating,
  })

  // Update the card with new SM-2 values
  const { error: updateError } = await supabase
    .from('cards')
    .update({
      interval: sm2Result.interval,
      ease_factor: sm2Result.easeFactor,
      next_review: sm2Result.nextReview.toISOString(),
    })
    .eq('id', cardId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // === Gamification: Update user_stats and study_logs ===
  const today = new Date()
  const todayDateStr = today.toISOString().split('T')[0] // YYYY-MM-DD format

  // Fetch or create user_stats record
  const { data: existingStats, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (statsError && statsError.code !== 'PGRST116') {
    // PGRST116 = no rows returned, which is expected for new users
    return { success: false, error: statsError.message }
  }

  // Calculate streak updates
  const lastStudyDate = existingStats?.last_study_date 
    ? new Date(existingStats.last_study_date) 
    : null
  const currentStreak = existingStats?.current_streak ?? 0
  const longestStreak = existingStats?.longest_streak ?? 0
  const totalReviews = existingStats?.total_reviews ?? 0

  const streakResult = calculateStreak({
    lastStudyDate,
    currentStreak,
    todayDate: today,
  })

  const newLongestStreak = updateLongestStreak(streakResult.newStreak, longestStreak)
  const newTotalReviews = incrementTotalReviews(totalReviews)

  // Upsert user_stats
  if (existingStats) {
    // Update existing record
    const { error: updateStatsError } = await supabase
      .from('user_stats')
      .update({
        last_study_date: todayDateStr,
        current_streak: streakResult.newStreak,
        longest_streak: newLongestStreak,
        total_reviews: newTotalReviews,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateStatsError) {
      return { success: false, error: updateStatsError.message }
    }
  } else {
    // Insert new record for first-time user
    const { error: insertStatsError } = await supabase
      .from('user_stats')
      .insert({
        user_id: user.id,
        last_study_date: todayDateStr,
        current_streak: streakResult.newStreak,
        longest_streak: newLongestStreak,
        total_reviews: newTotalReviews,
      })

    if (insertStatsError) {
      return { success: false, error: insertStatsError.message }
    }
  }

  // Upsert study_logs - increment cards_reviewed for today
  const { data: existingLog, error: logFetchError } = await supabase
    .from('study_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('study_date', todayDateStr)
    .single()

  if (logFetchError && logFetchError.code !== 'PGRST116') {
    return { success: false, error: logFetchError.message }
  }

  if (existingLog) {
    // Update existing log - increment cards_reviewed
    const { error: updateLogError } = await supabase
      .from('study_logs')
      .update({
        cards_reviewed: existingLog.cards_reviewed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('study_date', todayDateStr)

    if (updateLogError) {
      return { success: false, error: updateLogError.message }
    }
  } else {
    // Insert new log for today
    const { error: insertLogError } = await supabase
      .from('study_logs')
      .insert({
        user_id: user.id,
        study_date: todayDateStr,
        cards_reviewed: 1,
      })

    if (insertLogError) {
      return { success: false, error: insertLogError.message }
    }
  }

  // Fetch next due card from the same deck
  const now = new Date().toISOString()
  const { data: dueCards, error: dueError } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', card.deck_id)
    .lte('next_review', now)
    .neq('id', cardId) // Exclude the card we just rated
    .order('next_review', { ascending: true })
    .limit(1)

  if (dueError) {
    return { success: false, error: dueError.message }
  }

  // Get remaining count of due cards
  const { count, error: countError } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .eq('deck_id', card.deck_id)
    .lte('next_review', now)
    .neq('id', cardId)

  if (countError) {
    return { success: false, error: countError.message }
  }

  // Revalidate study page
  revalidatePath(`/study/${card.deck_id}`)

  const nextCard = dueCards && dueCards.length > 0 ? (dueCards[0] as Card) : null

  return {
    success: true,
    nextCard,
    remainingCount: count || 0,
  }
}

/**
 * Fetches due cards for a deck.
 * Requirements: 5.1
 */
export async function getDueCardsForDeck(deckId: string): Promise<{
  cards: Card[]
  error?: string
}> {
  const user = await getUser()
  if (!user) {
    return { cards: [], error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify user owns the deck
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .single()

  if (deckError || !deck) {
    return { cards: [], error: 'Deck not found or access denied' }
  }

  // Fetch due cards (next_review <= now)
  const now = new Date().toISOString()
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .lte('next_review', now)
    .order('next_review', { ascending: true })

  if (cardsError) {
    return { cards: [], error: cardsError.message }
  }

  return { cards: (cards || []) as Card[] }
}
