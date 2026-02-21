'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { createMCQSchema } from '@/lib/validations'
import { getCardDefaults } from '@/lib/card-defaults'
import { calculateNextReview } from '@/lib/sm2'
import { calculateStreak, updateLongestStreak, incrementTotalReviews } from '@/lib/streak'
import { formatZodErrors } from '@/lib/zod-utils'
import type { ActionResultV2 } from '@/types/actions'

/**
 * V8.0: Server Action for creating a new MCQ card.
 * Creates card_template and user_card_progress in V2 schema.
 * Requirements: 1.1, 3.3, 3.4, V8 2.2
 */
export async function createMCQAction(
  _prevState: ActionResultV2,
  formData: FormData
): Promise<ActionResultV2> {
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
    return { ok: false, error: formatZodErrors(validationResult.error) }
  }

  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const { deckId, stem, options: validOptions, correctIndex, explanation } = validationResult.data
  const supabase = await createSupabaseServerClient()

  // V8.0: Verify user owns the deck_template (not legacy deck)
  const { data: deckTemplate, error: deckError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (deckError || !deckTemplate) {
    return { ok: false, error: 'Deck not found in V2 schema. Please run migration.' }
  }

  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: 'Access denied' }
  }

  // V8.0: Create card_template
  // V11.2: Include author_id (required field)
  const { data: cardTemplate, error: insertError } = await supabase
    .from('card_templates')
    .insert({
      deck_template_id: deckId,
      author_id: user.id,
      stem,
      options: validOptions,
      correct_index: correctIndex,
      explanation: explanation || null,
    })
    .select()
    .single()

  if (insertError || !cardTemplate) {
    return { ok: false, error: insertError?.message || 'Failed to create MCQ' }
  }

  // V8.0: Create user_card_progress with default SM-2 values
  const defaults = getCardDefaults()
  await supabase
    .from('user_card_progress')
    .insert({
      user_id: user.id,
      card_template_id: cardTemplate.id,
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
      repetitions: 0,
      suspended: false,
    })

  // Assign tags to the new card_template (if any)
  if (tagIds.length > 0) {
    const cardTemplateTags = tagIds.map((tagId) => ({
      card_template_id: cardTemplate.id,
      tag_id: tagId,
    }))
    await supabase.from('card_template_tags').insert(cardTemplateTags)
  }

  // Revalidate deck details page to show new card
  revalidatePath(`/decks/${deckId}`)

  return { ok: true, data: cardTemplate }
}


/**
 * Result type for answerMCQAction
 */
export type AnswerMCQResult = ActionResultV2<{
  isCorrect: boolean
  correctIndex: number
  explanation?: string | null
}>

/**
 * V8.0: Server Action for answering an MCQ during study.
 * Updates user_card_progress instead of legacy cards table.
 * Requirements: 2.1, 2.4, 2.5, 2.6, V8 2.3
 */
export async function answerMCQAction(
  cardId: string,
  selectedIndex: number
): Promise<AnswerMCQResult> {
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

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
    return { ok: false, error: 'MCQ card not found in V2 schema' }
  }

  // Verify correct_index exists
  if (cardTemplate.correct_index === null) {
    return { ok: false, error: 'Invalid MCQ card: missing correct_index' }
  }

  // Determine correctness (Requirement 2.4, 2.5)
  const isCorrect = selectedIndex === cardTemplate.correct_index

  // Map to SRS rating: correct → 3 (Good), incorrect → 1 (Again)
  const rating: 1 | 3 = isCorrect ? 3 : 1

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

  // V8.0: Upsert user_card_progress
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
    }, {
      onConflict: 'user_id,card_template_id',
    })

  // V8.2: Debug logging for SRS updates
  console.log(`[SRS] MCQ ${cardId} answered ${isCorrect ? 'correct' : 'incorrect'} (rating ${rating}):`, {
    oldInterval: currentProgress?.interval ?? 0,
    newInterval: sm2Result.interval,
    nextReview: sm2Result.nextReview.toISOString(),
  })

  if (updateError) {
    return { ok: false, error: updateError.message }
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
    return { ok: false, error: statsError.message }
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

  // Upsert study_logs - increment cards_reviewed for today
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

  // Revalidate study page
  revalidatePath(`/study/${cardTemplate.deck_template_id}`)

  return {
    ok: true,
    data: {
      isCorrect,
      correctIndex: cardTemplate.correct_index,
      explanation: cardTemplate.explanation,
    },
  }
}
