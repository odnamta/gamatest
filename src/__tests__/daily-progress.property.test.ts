/**
 * Property-Based Tests for Daily Progress
 * Feature: v3-ux-overhaul, Property 2: Daily progress calculation
 * Validates: Requirements 1.3, 1.4
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeDailyProgress, computeProgressPercent } from '@/lib/daily-progress'

describe('computeDailyProgress', () => {
  /**
   * Property 2: Daily progress calculation
   * For any user with study logs, the completedToday count SHALL equal the
   * cards_reviewed value from the study_log entry for today's date,
   * or 0 if no entry exists.
   */
  it('should return cards_reviewed when study log exists', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1000 }), // cards_reviewed is a non-negative integer
        (cardsReviewed) => {
          const studyLog = { cards_reviewed: cardsReviewed }
          const result = computeDailyProgress(studyLog)
          expect(result).toBe(cardsReviewed)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return 0 when study log is null', () => {
    expect(computeDailyProgress(null)).toBe(0)
  })

  it('should handle zero cards reviewed', () => {
    const studyLog = { cards_reviewed: 0 }
    expect(computeDailyProgress(studyLog)).toBe(0)
  })
})

describe('computeProgressPercent', () => {
  it('should calculate correct percentage for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 500 }), // completedToday
        fc.integer({ min: 1, max: 100 }), // dailyGoal (positive)
        (completedToday, dailyGoal) => {
          const result = computeProgressPercent(completedToday, dailyGoal)
          
          // Result should be a number (not null) when goal is set
          expect(result).not.toBeNull()
          
          // Result should be between 0 and 100
          expect(result).toBeGreaterThanOrEqual(0)
          expect(result).toBeLessThanOrEqual(100)
          
          // Result should be capped at 100
          if (completedToday >= dailyGoal) {
            expect(result).toBe(100)
          } else {
            const expected = Math.round((completedToday / dailyGoal) * 100)
            expect(result).toBe(expected)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return null when daily goal is null', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 500 }),
        (completedToday) => {
          const result = computeProgressPercent(completedToday, null)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return null when daily goal is 0 or negative', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 500 }),
        fc.integer({ min: -100, max: 0 }),
        (completedToday, invalidGoal) => {
          const result = computeProgressPercent(completedToday, invalidGoal)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should cap at 100% when completed exceeds goal', () => {
    const result = computeProgressPercent(150, 100)
    expect(result).toBe(100)
  })

  it('should return 0% when nothing completed', () => {
    const result = computeProgressPercent(0, 50)
    expect(result).toBe(0)
  })
})
