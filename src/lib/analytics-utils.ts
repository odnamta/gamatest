/**
 * V10.2: Analytics utility functions
 * Pure functions extracted from analytics-actions.ts for testability
 * and Next.js 16 Server Actions compatibility.
 */

import type { TopicAccuracy } from '@/types/database'

/**
 * Calculates accuracy percentage from correct count and total attempts.
 * Returns null if total attempts is 0 to avoid division by zero.
 */
export function calculateAccuracy(correctCount: number, totalAttempts: number): number | null {
  if (totalAttempts === 0) return null
  return (correctCount / totalAttempts) * 100
}

/**
 * Determines if a topic has low confidence based on attempt count.
 * Low confidence is defined as fewer than 5 attempts.
 */
export function isLowConfidence(totalAttempts: number): boolean {
  return totalAttempts < 5
}

/**
 * Formats a date to a 3-letter day name.
 */
export function formatDayName(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[date.getDay()]
}

/**
 * Finds the weakest topic from a list of topic accuracies.
 * When multiple topics have the same lowest accuracy, selects the one with most attempts.
 * Returns null if no topics have valid accuracy data.
 */
export function findWeakestTopic(topics: TopicAccuracy[]): TopicAccuracy | null {
  const topicsWithAccuracy = topics.filter(t => t.accuracy !== null)
  if (topicsWithAccuracy.length === 0) return null
  
  return topicsWithAccuracy.reduce((weakest, current) => {
    if (current.accuracy! < weakest.accuracy!) {
      return current
    }
    if (current.accuracy === weakest.accuracy && current.totalAttempts > weakest.totalAttempts) {
      return current
    }
    return weakest
  })
}

/**
 * Generates the improve button URL for a topic.
 */
export function generateImproveUrl(tagId: string): string {
  return `/study/custom?tagIds=${tagId}&mode=due`
}


// ============================================
// V10.3: Subject Badge & Radar Chart Utilities
// ============================================

const DEFAULT_SUBJECT = 'OBGYN'

/**
 * Derives subject name from user's first active deck.
 * Returns default subject if no decks available.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 1: Subject derivation returns first deck's subject or default**
 * **Validates: Requirements 2.2, 2.3**
 */
export function deriveSubjectFromDecks(
  decks: Array<{ title: string; subject?: string | null }>,
  defaultSubject: string = DEFAULT_SUBJECT
): string {
  if (decks.length === 0) return defaultSubject
  // Use explicit subject field if available, otherwise extract from title
  const firstDeck = decks[0]
  if (firstDeck.subject) return firstDeck.subject
  // Fallback: use deck title as subject indicator
  return firstDeck.title || defaultSubject
}

/**
 * Selects top N topics by attempt count for radar display.
 * Returns all topics if fewer than N available.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 2: Top topics selection returns exactly N topics sorted by attempts**
 * **Validates: Requirements 3.2**
 */
export function getTopTopicsByAttempts(
  topics: TopicAccuracy[],
  count: number
): TopicAccuracy[] {
  if (topics.length <= count) return [...topics]
  
  return [...topics]
    .sort((a, b) => b.totalAttempts - a.totalAttempts)
    .slice(0, count)
}

/**
 * Normalizes accuracy value to 0-100 scale.
 * Null values are mapped to 0.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 3: Accuracy normalization bounds**
 * **Validates: Requirements 3.3**
 */
export function normalizeAccuracy(accuracy: number | null): number {
  if (accuracy === null) return 0
  return Math.max(0, Math.min(100, accuracy))
}

/**
 * Identifies the topic with lowest accuracy from a list.
 * Returns the index of the lowest accuracy topic, or -1 if empty.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 4: Lowest accuracy topic identification**
 * **Validates: Requirements 3.4**
 */
export function findLowestAccuracyIndex(topics: TopicAccuracy[]): number {
  if (topics.length === 0) return -1
  
  let lowestIndex = 0
  let lowestAccuracy = normalizeAccuracy(topics[0].accuracy)
  
  for (let i = 1; i < topics.length; i++) {
    const accuracy = normalizeAccuracy(topics[i].accuracy)
    if (accuracy < lowestAccuracy) {
      lowestAccuracy = accuracy
      lowestIndex = i
    }
  }
  
  return lowestIndex
}

/**
 * Generates the training URL for a topic.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 5: Train URL construction**
 * **Validates: Requirements 4.2**
 */
export function generateTrainUrl(tagId: string): string {
  return `/study/custom?tagIds=${tagId}&mode=due`
}

/**
 * Selects the weakest topic with tie-breaker by attempt count.
 * When multiple topics share the minimum accuracy, returns the one with highest attempts.
 * 
 * **Feature: v10.3-analytics-visual-unity, Property 6: Tie-breaker selection by attempt count**
 * **Validates: Requirements 4.3**
 */
export function selectWeakestTopic(topics: TopicAccuracy[]): TopicAccuracy | null {
  const topicsWithAccuracy = topics.filter(t => t.accuracy !== null)
  if (topicsWithAccuracy.length === 0) return null
  
  // Find minimum accuracy
  const minAccuracy = Math.min(...topicsWithAccuracy.map(t => t.accuracy!))
  
  // Filter topics with minimum accuracy
  const tiedTopics = topicsWithAccuracy.filter(t => t.accuracy === minAccuracy)
  
  // Return the one with highest attempts (tie-breaker)
  return tiedTopics.reduce((best, current) => 
    current.totalAttempts > best.totalAttempts ? current : best
  )
}
