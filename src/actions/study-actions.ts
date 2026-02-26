'use server'

import { revalidatePath } from 'next/cache'
import { withUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { ratingSchema } from '@/lib/validations'
import { calculateNextReview } from '@/lib/sm2'
import { calculateStreak, updateLongestStreak, incrementTotalReviews } from '@/lib/streak'
import { logger } from '@/lib/logger'
import type { NextCardResult } from '@/types/actions'
import type { Card } from '@/types/database'

/**
 * V8.0: Server Action for rating a card during study.
 * Updates user_card_progress instead of legacy cards table.
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 5.4, 9.4, V8 2.3
 */
export async function rateCardAction(
  cardId: string,
  rating: 1 | 2 | 3 | 4
): Promise<NextCardResult> {
  const validationResult = ratingSchema.safeParse({ cardId, rating })
  if (!validationResult.success) {
    return { ok: false, error: 'Invalid rating data' }
  }

  return withUser(async ({ user, supabase }) => {
    try {
      // V8.0: Fetch card_template with deck_template for ownership check
      const { data: cardTemplate, error: cardError } = await supabase
        .from('card_templates')
        .select(`
          *,
          deck_templates!inner(author_id)
        `)
        .eq('id', cardId)
        .single()

      if (cardError || !cardTemplate) {
        return { ok: false, error: 'Card not found in V2 schema' }
      }

      // V8.0: Get current progress from user_card_progress
      const { data: currentProgress } = await supabase
        .from('user_card_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_template_id', cardId)
        .single()

      // Calculate new SM-2 values
      const sm2Result = calculateNextReview({
        interval: currentProgress?.interval ?? 0,
        easeFactor: currentProgress?.ease_factor ?? 2.5,
        rating,
      })

      // V10.2: Determine if answer is correct (rating >= 3 means Good/Easy)
      const isCorrect = rating >= 3
      const newCorrectCount = (currentProgress?.correct_count ?? 0) + (isCorrect ? 1 : 0)
      const newTotalAttempts = (currentProgress?.total_attempts ?? 0) + 1

      // V8.0: Upsert user_card_progress with V10.2 accuracy tracking
      const { error: updateError } = await supabase
        .from('user_card_progress')
        .upsert({
          user_id: user.id,
          card_template_id: cardId,
          interval: sm2Result.interval,
          ease_factor: sm2Result.easeFactor,
          next_review: sm2Result.nextReview.toISOString(),
          last_answered_at: new Date().toISOString(),
          repetitions: (currentProgress?.repetitions ?? 0) + 1,
          suspended: false,
          // V10.2: Accuracy tracking
          correct_count: newCorrectCount,
          total_attempts: newTotalAttempts,
        }, {
          onConflict: 'user_id,card_template_id',
        })

      logger.info('rateCard', `Card ${cardId} rated ${rating}`, {
        oldInterval: currentProgress?.interval ?? 0,
        newInterval: sm2Result.interval,
        nextReview: sm2Result.nextReview.toISOString(),
      })

      if (updateError) {
        return { ok: false, error: updateError.message }
      }

      // === Gamification: Update user_stats and study_logs ===
      const today = new Date()
      const todayDateStr = today.toISOString().split('T')[0]

      const { data: existingStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .single()

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

      if (existingStats) {
        await supabase
          .from('user_stats')
          .update({
            last_study_date: todayDateStr,
            current_streak: streakResult.newStreak,
            longest_streak: newLongestStreak,
            total_reviews: newTotalReviews,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('user_stats')
          .insert({
            user_id: user.id,
            last_study_date: todayDateStr,
            current_streak: streakResult.newStreak,
            longest_streak: newLongestStreak,
            total_reviews: newTotalReviews,
          })
      }

      // Upsert study_logs
      const { data: existingLog } = await supabase
        .from('study_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('study_date', todayDateStr)
        .single()

      if (existingLog) {
        await supabase
          .from('study_logs')
          .update({
            cards_reviewed: existingLog.cards_reviewed + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('study_date', todayDateStr)
      } else {
        await supabase
          .from('study_logs')
          .insert({
            user_id: user.id,
            study_date: todayDateStr,
            cards_reviewed: 1,
          })
      }

      // V8.0: Fetch next due card from user_card_progress joined with card_templates
      const now = new Date().toISOString()
      const { data: dueProgress } = await supabase
        .from('user_card_progress')
        .select(`
          *,
          card_templates!inner(*)
        `)
        .eq('user_id', user.id)
        .lte('next_review', now)
        .eq('suspended', false)
        .neq('card_template_id', cardId)
        .order('next_review', { ascending: true })
        .limit(1)

      // Get remaining count
      const { count } = await supabase
        .from('user_card_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('next_review', now)
        .eq('suspended', false)
        .neq('card_template_id', cardId)

      revalidatePath(`/study/${cardTemplate.deck_template_id}`)

      // Convert to Card format for compatibility
      let nextCard: Card | null = null
      if (dueProgress && dueProgress.length > 0) {
        const p = dueProgress[0]
        const ct = p.card_templates as unknown as {
          id: string
          deck_template_id: string
          stem: string
          options: string[]
          correct_index: number
          explanation: string | null
          created_at: string
        }
        nextCard = {
          id: ct.id,
          deck_id: ct.deck_template_id,
          card_type: 'mcq',
          front: ct.stem,
          back: ct.explanation || '',
          stem: ct.stem,
          options: ct.options,
          correct_index: ct.correct_index,
          explanation: ct.explanation,
          image_url: null,
          interval: p.interval,
          ease_factor: p.ease_factor,
          next_review: p.next_review,
          created_at: ct.created_at,
        }
      }

      return {
        ok: true,
        nextCard,
        remainingCount: count || 0,
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, RATE_LIMITS.sensitive) as Promise<NextCardResult>
}

/**
 * V8.0: Fetches due cards for a deck_template.
 * Queries user_card_progress joined with card_templates.
 * Requirements: 5.1, V8 2.5
 */
export async function getDueCardsForDeck(deckId: string): Promise<{
  cards: Card[]
  error?: string
}> {
  const result = await withUser(async ({ user, supabase }) => {
    try {
      // V8.0: Verify user has access to deck_template
      const { data: deckTemplate, error: deckError } = await supabase
        .from('deck_templates')
        .select('id, author_id')
        .eq('id', deckId)
        .single()

      if (deckError || !deckTemplate) {
        return { cards: [], error: 'Deck not found in V2 schema' }
      }

      // V8.0: Fetch due cards from user_card_progress joined with card_templates
      // V11.3: Only fetch published cards for study
      const now = new Date().toISOString()
      const { data: dueProgress, error: progressError } = await supabase
        .from('user_card_progress')
        .select(`
          *,
          card_templates!inner(*)
        `)
        .eq('user_id', user.id)
        .eq('card_templates.status', 'published')
        .lte('next_review', now)
        .eq('suspended', false)
        .order('next_review', { ascending: true })

      if (progressError) {
        return { cards: [], error: progressError.message }
      }

      // Filter to cards in this deck and convert to Card format
      // V11.3: Status filter already applied in query
      const cards: Card[] = (dueProgress || [])
        .filter(p => {
          const ct = p.card_templates as unknown as { deck_template_id: string }
          return ct.deck_template_id === deckId
        })
        .map(p => {
          const ct = p.card_templates as unknown as {
            id: string
            deck_template_id: string
            stem: string
            options: string[]
            correct_index: number
            explanation: string | null
            created_at: string
          }
          return {
            id: ct.id,
            deck_id: ct.deck_template_id,
            card_type: 'mcq' as const,
            front: ct.stem,
            back: ct.explanation || '',
            stem: ct.stem,
            options: ct.options,
            correct_index: ct.correct_index,
            explanation: ct.explanation,
            image_url: null,
            interval: p.interval,
            ease_factor: p.ease_factor,
            next_review: p.next_review,
            created_at: ct.created_at,
          }
        })

      return { cards }
    } catch (err) {
      return { cards: [], error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, RATE_LIMITS.standard)

  // If auth error, return empty
  if ('error' in result && 'ok' in result && result.ok === false) {
    return { cards: [], error: result.error }
  }
  return result as { cards: Card[]; error?: string }
}
