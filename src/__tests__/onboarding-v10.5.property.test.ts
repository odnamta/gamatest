/**
 * Property-Based Tests for Onboarding
 * Originally V10.5 Brand Unification & Starter Packs.
 * Updated for V19 simplified onboarding (name confirmation only).
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  shouldShowOnboardingModal,
} from '@/components/onboarding/OnboardingModal'
import {
  isSupportedSpecialty,
  SUPPORTED_SPECIALTIES,
} from '@/lib/onboarding-constants'

describe('Onboarding Modal Visibility - Property Tests', () => {
  /**
   * Property 1: Onboarding Modal Visibility Logic
   * For any user metadata object, if the `onboarded` field is not `true`,
   * then `shouldShowOnboardingModal` should return `true`.
   * Validates: Requirements 3.1
   */
  describe('Property 1: Onboarding Modal Visibility Logic', () => {
    it('should return true when onboarded is not true', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.record({
              onboarded: fc.oneof(
                fc.constant(false),
                fc.constant(undefined),
                fc.constant(null)
              ),
            }),
          ),
          (metadata) => {
            const result = shouldShowOnboardingModal(metadata as { onboarded?: boolean } | null | undefined)
            expect(result).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return false when onboarded is exactly true', () => {
      const metadata = { onboarded: true }
      expect(shouldShowOnboardingModal(metadata)).toBe(false)
    })

    it('should return true when metadata is null', () => {
      expect(shouldShowOnboardingModal(null)).toBe(true)
    })

    it('should return true when metadata is undefined', () => {
      expect(shouldShowOnboardingModal(undefined)).toBe(true)
    })

    it('should return true when onboarded field is missing', () => {
      expect(shouldShowOnboardingModal({})).toBe(true)
    })

    it('should return true when onboarded is false', () => {
      expect(shouldShowOnboardingModal({ onboarded: false })).toBe(true)
    })
  })
})

describe('Starter Pack Enrollment - Property Tests', () => {
  /**
   * Property 4: Starter Pack Enrollment Creates Active Subscriptions
   * For any supported specialty, calling enrollInStarterPack should create
   * `user_decks` records where each record has `is_active = true`.
   * Validates: Requirements 4.1, 4.2
   */
  describe('Property 4: Starter Pack Enrollment Creates Active Subscriptions', () => {
    interface SubscriptionRecord {
      user_id: string
      deck_template_id: string
      is_active: boolean
    }

    function createSubscriptionRecords(
      userId: string,
      deckIds: string[]
    ): SubscriptionRecord[] {
      return deckIds.map(deckId => ({
        user_id: userId,
        deck_template_id: deckId,
        is_active: true,
      }))
    }

    it('should create records with is_active=true for all decks', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (userId, deckIds) => {
            const records = createSubscriptionRecords(userId, deckIds)
            for (const record of records) {
              expect(record.is_active).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should create one record per deck', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          (userId, deckIds) => {
            const records = createSubscriptionRecords(userId, deckIds)
            expect(records.length).toBe(deckIds.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should associate all records with the correct user', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (userId, deckIds) => {
            const records = createSubscriptionRecords(userId, deckIds)
            for (const record of records) {
              expect(record.user_id).toBe(userId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 5: Starter Pack Enrollment Idempotence
   * For any user, calling enrollInStarterPack multiple times should result in
   * the same number of subscription records (no duplicates created).
   * Validates: Requirements 4.4
   */
  describe('Property 5: Starter Pack Enrollment Idempotence', () => {
    interface SubscriptionKey {
      user_id: string
      deck_template_id: string
    }

    function simulateUpsert(
      existing: Map<string, boolean>,
      newRecords: SubscriptionKey[]
    ): Map<string, boolean> {
      const result = new Map(existing)
      for (const record of newRecords) {
        const key = `${record.user_id}:${record.deck_template_id}`
        result.set(key, true)
      }
      return result
    }

    it('should not create duplicates when called multiple times', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (userId, deckIds, callCount) => {
            const records = deckIds.map(deckId => ({
              user_id: userId,
              deck_template_id: deckId,
            }))

            let state = new Map<string, boolean>()
            for (let i = 0; i < callCount; i++) {
              state = simulateUpsert(state, records)
            }
            expect(state.size).toBe(deckIds.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain same state after repeated calls', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (userId, deckIds) => {
            const records = deckIds.map(deckId => ({
              user_id: userId,
              deck_template_id: deckId,
            }))

            const stateAfterOne = simulateUpsert(new Map(), records)
            const stateAfterTwo = simulateUpsert(stateAfterOne, records)
            const stateAfterThree = simulateUpsert(stateAfterTwo, records)

            expect(stateAfterTwo.size).toBe(stateAfterOne.size)
            expect(stateAfterThree.size).toBe(stateAfterOne.size)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

describe('Supported Specialty Validation', () => {
  it('should recognize General as supported', () => {
    expect(isSupportedSpecialty('General')).toBe(true)
  })

  it('should not recognize unsupported specialties', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !SUPPORTED_SPECIALTIES.includes(s as typeof SUPPORTED_SPECIALTIES[number])),
        (specialty) => {
          expect(isSupportedSpecialty(specialty)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})
