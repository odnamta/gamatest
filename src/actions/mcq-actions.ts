'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { createMCQSchema } from '@/lib/validations'
import { getCardDefaults } from '@/lib/card-defaults'
import { calculateNextReview } from '@/lib/sm2'
import { calculateStreak, updateLongestStreak, incrementTotalReviews } from '@/lib/streak'
import type { ActionResult } from '@/types/actions'

/**
 * Server Action for creating a new MCQ card.
 * Validates input with Zod and creates card with card_type='mcq'.
 * Requirements: 1.1, 3.3, 3.4
 */
export async function createMCQAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // Parse options from form data (they come as option_0, option_1, etc.)
  const options: string[] = []
  let i = 0
  while (formData.has(`option_${i}`)) {
    const option = formData.get(`option_${i}`)
    if (typeof option === 'string') {
      options.push(option)
    }
    i++
  }

  // Parse tag IDs from form data
  const tagIds: string[] = []
  let t = 0
  while (formData.has(`tagId_${t}`)) {
    const tagId = formData.get(`tagId_${t}`)
    if (typeof tagId === 'string') {
      tagIds.push(tagId)
    }
    t++
  }

  const rawData = {
    deckId: formData.get('deckId'),
    stem: formData.get('stem'),
    options,
    correctIndex: parseInt(formData.get('correctIndex') as string, 10),
    explanation: formData.get('explanation') || undefined,
    imageUrl: formData.get('imageUrl') || '',
  }

  // Server-side Zod validation
  const validationResult = createMCQSchema.safeParse(rawData)

  if (!validationResult.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of validationResult.error.issues) {
      const field = issue.path[0] as string
      if (!fieldErrors[field]) {
        fieldErrors[field] = []
      }
      fieldErrors[field].push(issue.message)
    }
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const { deckId, stem, options: validOptions, correctIndex, explanation, imageUrl } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // Verify user owns the deck (RLS will also enforce this)
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .single()

  if (deckError || !deck) {
    return { success: false, error: 'Deck not found or access denied' }
  }

  // Create new MCQ card with default SM-2 values
  const defaults = getCardDefaults()
  const { data, error } = await supabase
    .from('cards')
    .insert({
      deck_id: deckId,
      card_type: 'mcq',
      // Flashcard fields (empty for MCQ)
      front: '',
      back: '',
      // MCQ fields
      stem,
      options: validOptions,
      correct_index: correctIndex,
      explanation: explanation || null,
      image_url: imageUrl || null,
      // SM-2 defaults
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  // Assign tags to the new card (if any)
  if (tagIds.length > 0 && data) {
    const cardTags = tagIds.map((tagId) => ({
      card_id: data.id,
      tag_id: tagId,
    }))
    await supabase.from('card_tags').insert(cardTags)
  }

  // Revalidate deck details page to show new card
  revalidatePath(`/decks/${deckId}`)

  return { success: true, data }
}


/**
 * Result type for answerMCQAction
 */
export interface AnswerMCQResult {
  success: boolean
  isCorrect?: boolean
  correctIndex?: number
  explanation?: string | null
  error?: string
}

/**
 * Server Action for answering an MCQ during study.
 * Determines correctness, maps to SRS rating, updates card and stats.
 * Requirements: 2.1, 2.4, 2.5, 2.6
 */
export async function answerMCQAction(
  cardId: string,
  selectedIndex: number
): Promise<AnswerMCQResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch the MCQ card with deck info to verify ownership
  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select(`
      *,
      decks!inner(user_id)
    `)
    .eq('id', cardId)
    .eq('card_type', 'mcq')
    .single()

  if (cardError || !card) {
    return { success: false, error: 'MCQ card not found or access denied' }
  }

  // Verify correct_index exists
  if (card.correct_index === null) {
    return { success: false, error: 'Invalid MCQ card: missing correct_index' }
  }

  // Determine correctness (Requirement 2.4, 2.5)
  const isCorrect = selectedIndex === card.correct_index

  // Map to SRS rating: correct → 3 (Good), incorrect → 1 (Again)
  const rating: 1 | 3 = isCorrect ? 3 : 1

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

  // === Update user_stats and study_logs (Requirement 2.6) ===
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

  // Revalidate study page
  revalidatePath(`/study/${card.deck_id}`)

  return {
    success: true,
    isCorrect,
    correctIndex: card.correct_index,
    explanation: card.explanation,
  }
}
