/**
 * V10.3 Analytics & Visual Unity - Property-Based Tests
 * 
 * Tests correctness properties for analytics utility functions
 * using fast-check for property-based testing.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  deriveSubjectFromDecks,
  getTopTopicsByAttempts,
  normalizeAccuracy,
  findLowestAccuracyIndex,
  generateTrainUrl,
  selectWeakestTopic,
} from '@/lib/analytics-utils'
import type { TopicAccuracy } from '@/types/database'

// Arbitrary for generating hex color strings
const hexColorArb = fc.array(
  fc.integer({ min: 0, max: 15 }).map(n => n.toString(16)),
  { minLength: 6, maxLength: 6 }
).map(arr => `#${arr.join('')}`)

// Arbitrary for generating TopicAccuracy objects
const topicAccuracyArb = fc.record({
  tagId: fc.uuid(),
  tagName: fc.string({ minLength: 1, maxLength: 50 }),
  tagColor: hexColorArb,
  accuracy: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
  correctCount: fc.nat({ max: 1000 }),
  totalAttempts: fc.nat({ max: 1000 }),
  isLowConfidence: fc.boolean(),
})

// Arbitrary for generating deck objects
const deckArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  subject: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
})

describe('V10.3 Analytics Utility Properties', () => {
  /**
   * **Feature: v10.3-analytics-visual-unity, Property 1: Subject derivation returns first deck's subject or default**
   * **Validates: Requirements 2.2, 2.3**
   */
  describe('Property 1: Subject derivation', () => {
    it('returns default subject for empty deck list', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (defaultSubject) => {
          const result = deriveSubjectFromDecks([], defaultSubject)
          expect(result).toBe(defaultSubject)
        }),
        { numRuns: 100 }
      )
    })

    it('returns first deck subject when decks exist with explicit subject', () => {
      fc.assert(
        fc.property(
          fc.array(deckArb, { minLength: 1, maxLength: 10 }),
          (decks) => {
            const result = deriveSubjectFromDecks(decks)
            const firstDeck = decks[0]
            if (firstDeck.subject) {
              expect(result).toBe(firstDeck.subject)
            } else {
              expect(result).toBe(firstDeck.title)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns OBGYN as default when no default specified and no decks', () => {
      const result = deriveSubjectFromDecks([])
      expect(result).toBe('OBGYN')
    })
  })

  /**
   * **Feature: v10.3-analytics-visual-unity, Property 2: Top topics selection returns exactly N topics sorted by attempts**
   * **Validates: Requirements 3.2**
   */
  describe('Property 2: Top topics selection', () => {
    it('returns exactly N topics when input has >= N topics', () => {
      fc.assert(
        fc.property(
          fc.array(topicAccuracyArb, { minLength: 5, maxLength: 20 }),
          fc.integer({ min: 1, max: 5 }),
          (topics, count) => {
            const result = getTopTopicsByAttempts(topics, count)
            expect(result.length).toBe(count)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns all topics when input has fewer than N topics', () => {
      fc.assert(
        fc.property(
          fc.array(topicAccuracyArb, { minLength: 0, maxLength: 4 }),
          (topics) => {
            const result = getTopTopicsByAttempts(topics, 5)
            expect(result.length).toBe(topics.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('selected topics have highest attempt counts', () => {
      fc.assert(
        fc.property(
          fc.array(topicAccuracyArb, { minLength: 6, maxLength: 20 }),
          (topics) => {
            const result = getTopTopicsByAttempts(topics, 5)
            const resultAttempts = result.map(t => t.totalAttempts)
            const minResultAttempts = Math.min(...resultAttempts)
            
            // All non-selected topics should have <= attempts than min selected
            const nonSelected = topics.filter(t => !result.includes(t))
            for (const topic of nonSelected) {
              expect(topic.totalAttempts).toBeLessThanOrEqual(minResultAttempts)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.3-analytics-visual-unity, Property 3: Accuracy normalization bounds**
   * **Validates: Requirements 3.3**
   */
  describe('Property 3: Accuracy normalization', () => {
    it('null accuracy maps to 0', () => {
      expect(normalizeAccuracy(null)).toBe(0)
    })

    it('normalized value is always between 0 and 100', () => {
      fc.assert(
        fc.property(
          fc.option(fc.float({ min: -100, max: 200, noNaN: true }), { nil: null }),
          (accuracy) => {
            const result = normalizeAccuracy(accuracy)
            expect(result).toBeGreaterThanOrEqual(0)
            expect(result).toBeLessThanOrEqual(100)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('values within 0-100 are preserved', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          (accuracy) => {
            const result = normalizeAccuracy(accuracy)
            expect(result).toBeCloseTo(accuracy, 5)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.3-analytics-visual-unity, Property 4: Lowest accuracy topic identification**
   * **Validates: Requirements 3.4**
   */
  describe('Property 4: Lowest accuracy identification', () => {
    it('returns -1 for empty list', () => {
      expect(findLowestAccuracyIndex([])).toBe(-1)
    })

    it('identified topic has accuracy <= all other topics', () => {
      fc.assert(
        fc.property(
          fc.array(topicAccuracyArb, { minLength: 1, maxLength: 20 }),
          (topics) => {
            const lowestIndex = findLowestAccuracyIndex(topics)
            expect(lowestIndex).toBeGreaterThanOrEqual(0)
            expect(lowestIndex).toBeLessThan(topics.length)
            
            const lowestAccuracy = normalizeAccuracy(topics[lowestIndex].accuracy)
            for (const topic of topics) {
              expect(lowestAccuracy).toBeLessThanOrEqual(normalizeAccuracy(topic.accuracy))
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.3-analytics-visual-unity, Property 5: Train URL construction**
   * **Validates: Requirements 4.2**
   */
  describe('Property 5: Train URL construction', () => {
    it('generates URL matching expected pattern', () => {
      fc.assert(
        fc.property(fc.uuid(), (tagId) => {
          const result = generateTrainUrl(tagId)
          expect(result).toBe(`/study/custom?tagIds=${tagId}&mode=due`)
        }),
        { numRuns: 100 }
      )
    })

    it('URL contains the tag ID', () => {
      fc.assert(
        fc.property(fc.uuid(), (tagId) => {
          const result = generateTrainUrl(tagId)
          expect(result).toContain(tagId)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.3-analytics-visual-unity, Property 6: Tie-breaker selection by attempt count**
   * **Validates: Requirements 4.3**
   */
  describe('Property 6: Tie-breaker selection', () => {
    it('returns null for empty list', () => {
      expect(selectWeakestTopic([])).toBeNull()
    })

    it('returns null when all topics have null accuracy', () => {
      fc.assert(
        fc.property(
          fc.array(
            topicAccuracyArb.map(t => ({ ...t, accuracy: null })),
            { minLength: 1, maxLength: 10 }
          ),
          (topics) => {
            const result = selectWeakestTopic(topics)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('selected topic has minimum accuracy', () => {
      fc.assert(
        fc.property(
          fc.array(
            topicAccuracyArb.filter(t => t.accuracy !== null),
            { minLength: 1, maxLength: 20 }
          ),
          (topics) => {
            const result = selectWeakestTopic(topics)
            if (result) {
              const minAccuracy = Math.min(...topics.filter(t => t.accuracy !== null).map(t => t.accuracy!))
              expect(result.accuracy).toBe(minAccuracy)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('among tied topics, selects one with highest attempts', () => {
      // Create topics with same accuracy but different attempts
      const baseAccuracy = 50
      const topics: TopicAccuracy[] = [
        { tagId: '1', tagName: 'A', tagColor: '#000', accuracy: baseAccuracy, correctCount: 5, totalAttempts: 10, isLowConfidence: false },
        { tagId: '2', tagName: 'B', tagColor: '#000', accuracy: baseAccuracy, correctCount: 10, totalAttempts: 20, isLowConfidence: false },
        { tagId: '3', tagName: 'C', tagColor: '#000', accuracy: baseAccuracy, correctCount: 2, totalAttempts: 5, isLowConfidence: true },
      ]
      
      const result = selectWeakestTopic(topics)
      expect(result).not.toBeNull()
      expect(result!.tagId).toBe('2') // Highest attempts among tied
    })
  })
})


// ============================================
// Unit Tests for Component Integration
// ============================================

describe('V10.3 Component Integration Tests', () => {
  describe('TrainWeakestButton URL generation', () => {
    it('generates correct URL for valid topic', () => {
      const topic: TopicAccuracy = {
        tagId: '123e4567-e89b-12d3-a456-426614174000',
        tagName: 'Anatomy',
        tagColor: '#3b82f6',
        accuracy: 45,
        correctCount: 9,
        totalAttempts: 20,
        isLowConfidence: false,
      }
      
      const url = generateTrainUrl(topic.tagId)
      expect(url).toBe('/study/custom?tagIds=123e4567-e89b-12d3-a456-426614174000&mode=due')
    })
  })

  describe('TopicRadarChart data transformation', () => {
    it('transforms topics correctly with lowest marked', () => {
      const topics: TopicAccuracy[] = [
        { tagId: '1', tagName: 'A', tagColor: '#000', accuracy: 80, correctCount: 8, totalAttempts: 10, isLowConfidence: false },
        { tagId: '2', tagName: 'B', tagColor: '#000', accuracy: 40, correctCount: 4, totalAttempts: 10, isLowConfidence: false },
        { tagId: '3', tagName: 'C', tagColor: '#000', accuracy: 60, correctCount: 6, totalAttempts: 10, isLowConfidence: false },
      ]
      
      const topTopics = getTopTopicsByAttempts(topics, 5)
      const lowestIndex = findLowestAccuracyIndex(topTopics)
      
      expect(topTopics.length).toBe(3)
      expect(lowestIndex).toBe(1) // Topic B has lowest accuracy
      expect(topTopics[lowestIndex].tagName).toBe('B')
    })
  })

  describe('SubjectBadge derivation', () => {
    it('derives subject from deck with explicit subject field', () => {
      const decks = [
        { title: 'OBGYN Deck', subject: 'Obstetrics & Gynecology' },
        { title: 'Another Deck', subject: 'Pediatrics' },
      ]
      
      const subject = deriveSubjectFromDecks(decks)
      expect(subject).toBe('Obstetrics & Gynecology')
    })

    it('falls back to title when no subject field', () => {
      const decks = [
        { title: 'My Study Deck', subject: null },
      ]
      
      const subject = deriveSubjectFromDecks(decks)
      expect(subject).toBe('My Study Deck')
    })
  })
})
