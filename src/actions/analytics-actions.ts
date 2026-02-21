'use server'

import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import {
  calculateAccuracy,
  isLowConfidence,
  formatDayName,
  findWeakestTopic,
  deriveSubjectFromDecks,
} from '@/lib/analytics-utils'
import type {
  TopicAccuracy,
  DeckProgress,
  DailyActivity,
} from '@/types/database'
import type { ActionResultV2 } from '@/types/actions'

export async function getUserAnalytics(): Promise<ActionResultV2<{ topicAccuracies: TopicAccuracy[]; deckProgress: DeckProgress[]; weakestTopic: TopicAccuracy | null }>> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  try {
    const { data: userDecks, error: userDecksError } = await supabase
      .from('user_decks')
      .select(`deck_template_id, deck_templates!inner(id, title)`)
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (userDecksError) {
      return { ok: false, error: userDecksError.message }
    }


    const deckTemplateIds = userDecks?.map(d => d.deck_template_id) || []

    if (deckTemplateIds.length === 0) {
      return { ok: true, data: { topicAccuracies: [], deckProgress: [], weakestTopic: null } }
    }

    const selectQuery = `correct_count, total_attempts, card_template_id, card_templates!inner(id, deck_template_id, card_template_tags(tags!inner(id, name, color, category)))`
    const { data: progressData, error: progressError } = await supabase
      .from('user_card_progress')
      .select(selectQuery)
      .eq('user_id', user.id)

    if (progressError) {
      return { ok: false, error: progressError.message }
    }

    const topicMap = new Map<string, {
      tagId: string
      tagName: string
      tagColor: string
      correctCount: number
      totalAttempts: number
    }>()

    const deckProgressMap = new Map<string, {
      deckId: string
      deckTitle: string
      cardsLearned: number
      totalCards: number
    }>()

    for (const ud of userDecks || []) {
      const deck = ud.deck_templates as unknown as { id: string; title: string }
      deckProgressMap.set(ud.deck_template_id, {
        deckId: ud.deck_template_id,
        deckTitle: deck.title,
        cardsLearned: 0,
        totalCards: 0,
      })
    }

    // Batch count cards per deck in a single query (avoids N+1)
    if (deckTemplateIds.length > 0) {
      const { data: allCards } = await supabase
        .from('card_templates')
        .select('deck_template_id')
        .in('deck_template_id', deckTemplateIds)

      const countMap = new Map<string, number>()
      for (const card of allCards ?? []) {
        countMap.set(card.deck_template_id, (countMap.get(card.deck_template_id) ?? 0) + 1)
      }
      for (const deckId of deckTemplateIds) {
        const existing = deckProgressMap.get(deckId)
        if (existing) {
          existing.totalCards = countMap.get(deckId) ?? 0
        }
      }
    }


    for (const progress of progressData || []) {
      const cardTemplate = progress.card_templates as unknown as {
        id: string
        deck_template_id: string
        card_template_tags: Array<{
          tags: { id: string; name: string; color: string; category: string }
        }>
      }

      if (!deckTemplateIds.includes(cardTemplate.deck_template_id)) {
        continue
      }

      const deckProgress = deckProgressMap.get(cardTemplate.deck_template_id)
      if (deckProgress && (progress.total_attempts ?? 0) > 0) {
        deckProgress.cardsLearned++
      }

      for (const ctt of cardTemplate.card_template_tags || []) {
        const tag = ctt.tags
        if (tag.category !== 'topic') continue

        const existing = topicMap.get(tag.id)
        if (existing) {
          existing.correctCount += progress.correct_count ?? 0
          existing.totalAttempts += progress.total_attempts ?? 0
        } else {
          topicMap.set(tag.id, {
            tagId: tag.id,
            tagName: tag.name,
            tagColor: tag.color,
            correctCount: progress.correct_count ?? 0,
            totalAttempts: progress.total_attempts ?? 0,
          })
        }
      }
    }

    const topicAccuracies: TopicAccuracy[] = Array.from(topicMap.values()).map(t => ({
      tagId: t.tagId,
      tagName: t.tagName,
      tagColor: t.tagColor,
      accuracy: calculateAccuracy(t.correctCount, t.totalAttempts),
      correctCount: t.correctCount,
      totalAttempts: t.totalAttempts,
      isLowConfidence: isLowConfidence(t.totalAttempts),
    }))

    topicAccuracies.sort((a, b) => {
      if (a.accuracy === null) return 1
      if (b.accuracy === null) return -1
      return a.accuracy - b.accuracy
    })

    const weakestTopic = findWeakestTopic(topicAccuracies)
    const deckProgress: DeckProgress[] = Array.from(deckProgressMap.values())

    return { ok: true, data: { topicAccuracies, deckProgress, weakestTopic } }
  } catch (error) {
    console.error('getUserAnalytics error:', error)
    return { ok: false, error: 'Failed to fetch analytics data' }
  }
}


export async function getActivityData(days: number = 7): Promise<ActionResultV2<{ activity: DailyActivity[] }>> {
  // V20.6: Bounds validation — cap days to prevent expensive queries
  const safeDays = Math.max(1, Math.min(365, Math.floor(days)))

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  try {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - (safeDays - 1))
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data: logs, error: logsError } = await supabase
      .from('study_logs')
      .select('study_date, cards_reviewed')
      .eq('user_id', user.id)
      .gte('study_date', startDateStr)
      .order('study_date', { ascending: true })

    if (logsError) {
      return { ok: false, error: logsError.message }
    }

    const logMap = new Map<string, number>()
    for (const log of logs || []) {
      logMap.set(log.study_date, log.cards_reviewed)
    }

    const activity: DailyActivity[] = []
    for (let i = safeDays - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      
      activity.push({
        date: dateStr,
        dayName: formatDayName(date),
        cardsReviewed: logMap.get(dateStr) ?? 0,
      })
    }

    return { ok: true, data: { activity } }
  } catch (error) {
    console.error('getActivityData error:', error)
    return { ok: false, error: 'Failed to fetch activity data' }
  }
}


/**
 * Gets the user's current subject from their first active deck.
 * Returns "General" as default if no decks found.
 *
 * Requirements: 2.2, 2.3
 */
export async function getUserSubject(): Promise<ActionResultV2<{ subject: string }>> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  try {
    const { data: userDecks, error: userDecksError } = await supabase
      .from('user_decks')
      .select(`deck_template_id, deck_templates!inner(id, title, subject)`)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)

    if (userDecksError) {
      return { ok: false, error: userDecksError.message }
    }

    const decks = userDecks?.map(ud => {
      const deck = ud.deck_templates as unknown as { title: string; subject?: string | null }
      return { title: deck.title, subject: deck.subject }
    }) || []

    const subject = deriveSubjectFromDecks(decks)

    return { ok: true, data: { subject } }
  } catch (error) {
    console.error('getUserSubject error:', error)
    return { ok: false, error: 'Failed to fetch subject' }
  }
}


// ============================================
// V22: Study Data Export
// ============================================

/**
 * Export study data as CSV: card stem, correct count, total attempts, accuracy, last reviewed.
 */
export async function exportStudyData(): Promise<ActionResultV2<{ csv: string }>> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  try {
    const { data: progress, error } = await supabase
      .from('user_card_progress')
      .select('card_template_id, correct_count, total_attempts, last_reviewed, card_templates!inner(stem, deck_template_id, deck_templates!inner(title))')
      .eq('user_id', user.id)
      .order('last_reviewed', { ascending: false })

    if (error) {
      return { ok: false, error: error.message }
    }

    const rows: string[] = ['Deck,Question Stem,Correct,Attempts,Accuracy %,Last Reviewed']
    for (const p of progress || []) {
      const card = p.card_templates as unknown as { stem: string; deck_templates: { title: string } }
      const acc = p.total_attempts > 0 ? Math.round((p.correct_count / p.total_attempts) * 100) : 0
      const stem = (card?.stem || '').replace(/"/g, '""').slice(0, 200)
      const deckTitle = (card?.deck_templates?.title || '').replace(/"/g, '""')
      rows.push(`"${deckTitle}","${stem}",${p.correct_count},${p.total_attempts},${acc},${p.last_reviewed || ''}`)
    }

    return { ok: true, data: { csv: rows.join('\n') } }
  } catch (err) {
    console.error('exportStudyData error:', err)
    return { ok: false, error: 'Failed to export study data' }
  }
}

// ============================================
// V11.7: Dashboard Insights
// ============================================

import { withUser, type AuthContext } from './_helpers'
import { findWeakestConcepts } from '@/lib/analytics-utils'
import { getGlobalStats } from './global-study-actions'
import type { DashboardInsightsResult, WeakestConceptSummary } from '@/types/actions'
import { LOW_CONFIDENCE_THRESHOLD } from '@/lib/constants'

/**
 * V11.7: Get dashboard insights including due count and weakest concepts.
 * Uses withUser helper and returns ActionResultV2.
 * 
 * **Feature: v11.7-companion-dashboard-tag-filtered-study**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */
export async function getDashboardInsights(): Promise<DashboardInsightsResult> {
  return withUser(async ({ user, supabase }: AuthContext) => {
    // Get global stats for due count
    const statsResult = await getGlobalStats()
    const dueCount = statsResult.ok ? statsResult.data?.totalDueCount ?? 0 : 0

    // Get today's reviewed count from study_logs
    const todayDateStr = new Date().toISOString().split('T')[0]
    const { data: studyLog } = await supabase
      .from('study_logs')
      .select('cards_reviewed')
      .eq('user_id', user.id)
      .eq('study_date', todayDateStr)
      .single()

    // Fetch user progress data for weakest concepts
    const { data: progressData } = await supabase
      .from('user_card_progress')
      .select('card_template_id, correct_count, total_attempts')
      .eq('user_id', user.id)

    // Fetch card-tag associations scoped to user's cards only
    const userCardIds = (progressData ?? []).map((p) => p.card_template_id)
    const { data: cardTags } = userCardIds.length > 0
      ? await supabase
          .from('card_template_tags')
          .select('card_template_id, tag_id')
          .in('card_template_id', userCardIds)
      : { data: [] as { card_template_id: string; tag_id: string }[] }

    // Fetch user's tags (concept category only for weakest concepts)
    const { data: tags } = await supabase
      .from('tags')
      .select('id, name, category')
      .eq('user_id', user.id)

    // Calculate total attempts across all concept tags
    const conceptTags = (tags || []).filter(t => t.category === 'concept')
    const conceptTagIds = new Set(conceptTags.map(t => t.id))
    
    // Map card progress to concept tags
    const cardTagMap = new Map<string, string[]>()
    for (const ct of cardTags || []) {
      if (conceptTagIds.has(ct.tag_id)) {
        const existing = cardTagMap.get(ct.card_template_id) || []
        existing.push(ct.tag_id)
        cardTagMap.set(ct.card_template_id, existing)
      }
    }

    // Calculate total attempts for concept tags
    let totalConceptAttempts = 0
    for (const progress of progressData || []) {
      const tagIds = cardTagMap.get(progress.card_template_id)
      if (tagIds && tagIds.length > 0) {
        totalConceptAttempts += progress.total_attempts ?? 0
      }
    }

    // If total attempts < LOW_CONFIDENCE_THRESHOLD, return empty weakest concepts
    let weakestConcepts: WeakestConceptSummary[] = []
    
    if (totalConceptAttempts >= LOW_CONFIDENCE_THRESHOLD) {
      // Use findWeakestConcepts utility
      const progressForConcepts = (progressData || []).map(p => ({
        cardTemplateId: p.card_template_id,
        correctCount: p.correct_count ?? 0,
        totalAttempts: p.total_attempts ?? 0,
      }))

      const cardTagsForConcepts = (cardTags || []).map(ct => ({
        cardTemplateId: ct.card_template_id,
        tagId: ct.tag_id,
      }))

      const tagsForConcepts = (tags || []).map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
      }))

      const weakest = findWeakestConcepts(
        progressForConcepts,
        cardTagsForConcepts,
        tagsForConcepts,
        3 // Limit to 3 weakest concepts
      )

      weakestConcepts = weakest.map(w => ({
        tagId: w.tagId,
        tagName: w.tagName,
        accuracy: w.accuracy,
        totalAttempts: w.totalAttempts,
        isLowConfidence: w.isLowConfidence,
      }))
    }

    // Build result
    const result: { dueCount: number; weakestConcepts: WeakestConceptSummary[]; reviewedToday?: number } = {
      dueCount,
      weakestConcepts,
    }

    // Only include reviewedToday if we have a study log for today
    if (studyLog?.cards_reviewed !== undefined) {
      result.reviewedToday = studyLog.cards_reviewed
    }

    return { ok: true, data: result }
  })
}
