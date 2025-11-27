/**
 * Property-Based Tests for Global Due Count
 * Feature: v3-ux-overhaul, Property 1: Global due count accuracy
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeGlobalDueCount } from '@/lib/global-due-count'

describe('computeGlobalDueCount', () => {
  /**
   * Property 1: Global due count accuracy
   * For any user with multiple decks containing cards with various next_review timestamps,
   * the computed totalDueCount SHALL equal the sum of cards where next_review <= now
   * across all user-owned decks.
   */
  it('should count exactly the cards where next_review <= now', () => {
    // Use integer timestamps to avoid invalid date issues
    const minTime = new Date('2020-01-01').getTime()
    const maxTime = new Date('2030-12-31').getTime()
    
    fc.assert(
      fc.property(
        // Generate a list of cards with random next_review timestamps
        fc.array(
          fc.record({
            next_review: fc.integer({ min: minTime, max: maxTime })
              .map(t => new Date(t).toISOString())
          }),
          { minLength: 0, maxLength: 100 }
        ),
        // Generate a "now" timestamp
        fc.integer({ min: minTime, max: maxTime })
          .map(t => new Date(t).toISOString()),
        (cards, now) => {
          const result = computeGlobalDueCount(cards, now)
          
          // Manually count due cards for verification
          const nowDate = new Date(now)
          const expectedCount = cards.filter(card => {
            const nextReview = new Date(card.next_review)
            return nextReview <= nowDate
          }).length
          
          expect(result).toBe(expectedCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return 0 for empty card array', () => {
    const now = new Date().toISOString()
    expect(computeGlobalDueCount([], now)).toBe(0)
  })

  it('should return all cards when all are due', () => {
    const minTime = new Date('2020-01-01').getTime()
    const maxTime = new Date('2023-01-01').getTime()
    
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            next_review: fc.integer({ min: minTime, max: maxTime })
              .map(t => new Date(t).toISOString())
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (cards) => {
          // Use a future date so all cards are due
          const futureNow = new Date('2025-01-01').toISOString()
          const result = computeGlobalDueCount(cards, futureNow)
          expect(result).toBe(cards.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return 0 when no cards are due', () => {
    const minTime = new Date('2026-01-01').getTime()
    const maxTime = new Date('2030-12-31').getTime()
    
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            next_review: fc.integer({ min: minTime, max: maxTime })
              .map(t => new Date(t).toISOString())
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (cards) => {
          // Use a past date so no cards are due
          const pastNow = new Date('2025-01-01').toISOString()
          const result = computeGlobalDueCount(cards, pastNow)
          expect(result).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should include cards where next_review equals now (boundary case)', () => {
    const now = '2025-06-15T12:00:00.000Z'
    const cards = [
      { next_review: now }, // Exactly equal - should be included
      { next_review: '2025-06-15T11:59:59.999Z' }, // Just before - should be included
      { next_review: '2025-06-15T12:00:00.001Z' }, // Just after - should NOT be included
    ]
    
    expect(computeGlobalDueCount(cards, now)).toBe(2)
  })
})
