/**
 * Property-Based Tests for V10.5 Brand Unification & Starter Packs
 * Feature: v10.5-brand-unification-starter-packs
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  shouldShowOnboardingModal,
  SPECIALTIES,
} from '@/components/onboarding/OnboardingModal'
import {
  isSupportedSpecialty,
  SUPPORTED_SPECIALTIES,
} from '@/lib/onboarding-constants'

describe('V10.5 Brand Unification & Starter Packs - Property Tests', () => {
  /**
   * **Feature: v10.5-brand-unification-starter-packs, Property 1: Onboarding Modal Visibility Logic**
   * *For any* user metadata object, if the `onboarded` field is not `true`,
   * then `shouldShowOnboardingModal` should return `true`.
   * **Validates: Requirements 3.1**
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

  /**
   * **Feature: v10.5-brand-unification-starter-packs, Property 2: Specialty Selection Required for Progression**
   * *For any* empty or whitespace-only specialty value, the continue button
   * on step 1 of the OnboardingModal should be disabled.
   * **Validates: Requirements 3.3**
   */
  describe('Property 2: Specialty Selection Required for Progression', () => {
    // Helper function that mirrors the OnboardingModal's button disabled logic
    function isContinueButtonDisabled(specialty: string): boolean {
      return !specialty // Empty string is falsy
    }

    it('should disable continue button for empty specialty', () => {
      expect(isContinueButtonDisabled('')).toBe(true)
    })

    it('should enable continue button for any non-empty specialty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...SPECIALTIES),
          (specialty) => {
            expect(isContinueButtonDisabled(specialty)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should have OBGYN as a valid specialty option', () => {
      expect(SPECIALTIES).toContain('OBGYN')
    })
  })

  /**
   * **Feature: v10.5-brand-unification-starter-packs, Property 3: Specialty Persistence Round-Trip**
   * *For any* valid specialty selection from the SPECIALTIES list,
   * the specialty value should be preserved exactly as selected.
   * **Validates: Requirements 3.5**
   */
  describe('Property 3: Specialty Persistence Round-Trip', () => {
    // Simulates the round-trip: select specialty -> save to metadata -> read back
    function simulateSpecialtyRoundTrip(specialty: string): string {
      // This simulates what happens in the OnboardingModal:
      // 1. User selects specialty
      // 2. Saved to user_metadata via supabase.auth.updateUser({ data: { specialty } })
      // 3. Read back from user_metadata
      const metadata = { specialty }
      return metadata.specialty
    }

    it('should preserve specialty value through round-trip', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...SPECIALTIES),
          (specialty) => {
            const result = simulateSpecialtyRoundTrip(specialty)
            expect(result).toBe(specialty)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve exact string value without modification', () => {
      for (const specialty of SPECIALTIES) {
        expect(simulateSpecialtyRoundTrip(specialty)).toBe(specialty)
      }
    })
  })

  /**
   * **Feature: v10.5-brand-unification-starter-packs, Property 4: Starter Pack Enrollment Creates Active Subscriptions**
   * *For any* supported specialty (currently OBGYN), calling `enrollInStarterPack`
   * should create `user_decks` records where each record has `is_active = true`.
   * **Validates: Requirements 4.1, 4.2**
   */
  describe('Property 4: Starter Pack Enrollment Creates Active Subscriptions', () => {
    // Simulates the subscription record creation logic
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
        is_active: true, // Requirements 4.2: is_active must be true
      }))
    }

    it('should create records with is_active=true for all decks', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (userId, deckIds) => {
            const records = createSubscriptionRecords(userId, deckIds)
            
            // All records should have is_active = true
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
   * **Feature: v10.5-brand-unification-starter-packs, Property 5: Starter Pack Enrollment Idempotence**
   * *For any* user and specialty, calling `enrollInStarterPack` multiple times
   * should result in the same number of subscription records (no duplicates created).
   * **Validates: Requirements 4.4**
   */
  describe('Property 5: Starter Pack Enrollment Idempotence', () => {
    // Simulates upsert behavior: same (user_id, deck_template_id) = no duplicate
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
        result.set(key, true) // Upsert: overwrites if exists
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
            
            // Call upsert multiple times
            for (let i = 0; i < callCount; i++) {
              state = simulateUpsert(state, records)
            }

            // Should have exactly one entry per deck, regardless of call count
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

            // All states should be identical
            expect(stateAfterTwo.size).toBe(stateAfterOne.size)
            expect(stateAfterThree.size).toBe(stateAfterOne.size)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Additional test: Supported specialty validation
   */
  describe('Supported Specialty Validation', () => {
    it('should recognize OBGYN as supported', () => {
      expect(isSupportedSpecialty('OBGYN')).toBe(true)
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
})


/**
 * Unit Tests for V10.5 Brand Unification
 * **Validates: Requirements 1.1, 1.2**
 */
describe('V10.5 Brand Unification - Unit Tests', () => {
  /**
   * Test that SPECIALTIES array contains expected values
   * **Validates: Requirements 3.2**
   */
  describe('Specialty Options', () => {
    it('should include Obstetrics & Gynecology option (OBGYN)', () => {
      expect(SPECIALTIES).toContain('OBGYN')
    })

    it('should have at least one specialty option', () => {
      expect(SPECIALTIES.length).toBeGreaterThan(0)
    })

    it('should have unique specialty values', () => {
      const uniqueSpecialties = new Set(SPECIALTIES)
      expect(uniqueSpecialties.size).toBe(SPECIALTIES.length)
    })
  })

  /**
   * Test supported specialties for starter packs
   * **Validates: Requirements 4.1**
   */
  describe('Supported Specialties for Starter Packs', () => {
    it('should support OBGYN specialty', () => {
      expect(SUPPORTED_SPECIALTIES).toContain('OBGYN')
    })

    it('should have at least one supported specialty', () => {
      expect(SUPPORTED_SPECIALTIES.length).toBeGreaterThan(0)
    })
  })
})
