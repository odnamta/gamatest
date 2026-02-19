import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { getCardDefaults, validateCardDefaults } from '../lib/card-defaults'

/**
 * Card Default Values Property-Based Tests
 * 
 * These tests verify Property 10 from the design document:
 * For any newly created card, the initial values SHALL be:
 * interval = 0, ease_factor = 2.5, and next_review <= current timestamp.
 */

/**
 * **Feature: cekatan, Property 10: Card Default Values on Creation**
 * **Validates: Requirements 3.1**
 * 
 * For any newly created card, the initial values SHALL be:
 * interval = 0, ease_factor = 2.5, and next_review <= current timestamp.
 */
describe('Property 10: Card Default Values on Creation', () => {
  test('Default interval is always 0', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const defaults = getCardDefaults()
        expect(defaults.interval).toBe(0)
      }),
      { numRuns: 100 }
    )
  })

  test('Default ease_factor is always 2.5', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const defaults = getCardDefaults()
        expect(defaults.ease_factor).toBe(2.5)
      }),
      { numRuns: 100 }
    )
  })

  test('Default next_review is always <= current timestamp', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const before = new Date()
        const defaults = getCardDefaults()
        const after = new Date()
        
        // next_review should be between before and after (inclusive)
        expect(defaults.next_review.getTime()).toBeGreaterThanOrEqual(before.getTime())
        expect(defaults.next_review.getTime()).toBeLessThanOrEqual(after.getTime())
      }),
      { numRuns: 100 }
    )
  })

  test('validateCardDefaults correctly identifies valid defaults', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const defaults = getCardDefaults()
        const referenceTime = new Date()
        
        expect(validateCardDefaults(defaults, referenceTime)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  test('validateCardDefaults rejects non-zero intervals', () => {
    // Generate non-zero intervals
    const nonZeroIntervalArb = fc.integer({ min: 1, max: 365 })
    
    fc.assert(
      fc.property(nonZeroIntervalArb, (interval) => {
        const card = {
          interval,
          ease_factor: 2.5,
          next_review: new Date(),
        }
        const referenceTime = new Date()
        
        expect(validateCardDefaults(card, referenceTime)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  test('validateCardDefaults rejects non-2.5 ease factors', () => {
    // Generate ease factors that are not 2.5 using integer-based approach
    // Generate values from 130 to 400 (representing 1.30 to 4.00) then divide by 100
    const nonDefaultEaseArb = fc.integer({ min: 130, max: 400 })
      .map(n => n / 100)
      .filter(ef => ef !== 2.5)
    
    fc.assert(
      fc.property(nonDefaultEaseArb, (easeFactor) => {
        const card = {
          interval: 0,
          ease_factor: easeFactor,
          next_review: new Date(),
        }
        const referenceTime = new Date()
        
        expect(validateCardDefaults(card, referenceTime)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  test('validateCardDefaults rejects future next_review dates', () => {
    // Generate future timestamps (1 second to 1 year in the future)
    const futureOffsetArb = fc.integer({ min: 1000, max: 365 * 24 * 60 * 60 * 1000 })
    
    fc.assert(
      fc.property(futureOffsetArb, (offset) => {
        const referenceTime = new Date()
        const futureDate = new Date(referenceTime.getTime() + offset)
        
        const card = {
          interval: 0,
          ease_factor: 2.5,
          next_review: futureDate,
        }
        
        expect(validateCardDefaults(card, referenceTime)).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  test('validateCardDefaults handles string dates correctly', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const defaults = getCardDefaults()
        const referenceTime = new Date()
        
        // Convert next_review to ISO string (as stored in database)
        const cardWithStringDate = {
          interval: defaults.interval,
          ease_factor: defaults.ease_factor,
          next_review: defaults.next_review.toISOString(),
        }
        
        expect(validateCardDefaults(cardWithStringDate, referenceTime)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })
})
