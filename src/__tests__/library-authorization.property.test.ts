import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  isDeckVisibleToUser,
  filterVisibleDecks,
  isUserSubscribed,
  canUserSubscribe,
  applySubscription,
  applyUnsubscription,
  getActiveSubscriptions,
  calculateDueCount,
} from '../lib/library-authorization'
import type { DeckTemplate, UserDeck, DeckVisibility } from '@/types/database'

/**
 * Property-based tests for library-authorization.ts
 *
 * Covers properties NOT in library-subscription.property.test.ts:
 * - Idempotency of subscribe/unsubscribe
 * - Commutativity of filter operations
 * - Visibility monotonicity (public > private)
 * - Subscription/visibility cross-consistency
 * - Active subscription count invariants
 * - Due count monotonicity
 */

// ============================================
// Shared Generators
// ============================================

const uuidArb = fc.uuid()
const visibilityArb = fc.constantFrom<DeckVisibility>('public', 'private')

const minTimestamp = new Date('2020-01-01').getTime()
const maxTimestamp = new Date('2030-12-31').getTime()
const isoDateArb = fc
  .integer({ min: minTimestamp, max: maxTimestamp })
  .map((ts) => new Date(ts).toISOString())

const deckTemplateArb = fc.record({
  id: uuidArb,
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  visibility: visibilityArb,
  author_id: uuidArb,
  org_id: fc.constant(null),
  legacy_id: fc.constant(null),
  created_at: isoDateArb,
  updated_at: isoDateArb,
}) as fc.Arbitrary<DeckTemplate>

const userDeckArb = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  deck_template_id: uuidArb,
  is_active: fc.boolean(),
  created_at: isoDateArb,
}) as fc.Arbitrary<UserDeck>

// ============================================
// Property: Idempotency
// ============================================

describe('Idempotency of Subscription Operations', () => {
  test('subscribing twice is same as subscribing once (idempotent)', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (userId, deckId) => {
        const afterOnce = applySubscription([], userId, deckId)
        const afterTwice = applySubscription(afterOnce, userId, deckId)

        // Should still have exactly one subscription for this pair
        const matchingOnce = afterOnce.filter(
          ud => ud.user_id === userId && ud.deck_template_id === deckId
        )
        const matchingTwice = afterTwice.filter(
          ud => ud.user_id === userId && ud.deck_template_id === deckId
        )

        expect(matchingOnce.length).toBe(1)
        expect(matchingTwice.length).toBe(1)
        expect(matchingOnce[0].is_active).toBe(true)
        expect(matchingTwice[0].is_active).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('unsubscribing twice is same as unsubscribing once (idempotent)', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, (userId, deckId) => {
        // Start with an active subscription
        const initial = applySubscription([], userId, deckId)
        const afterOnce = applyUnsubscription(initial, userId, deckId)
        const afterTwice = applyUnsubscription(afterOnce, userId, deckId)

        const matchOnce = afterOnce.find(
          ud => ud.user_id === userId && ud.deck_template_id === deckId
        )
        const matchTwice = afterTwice.find(
          ud => ud.user_id === userId && ud.deck_template_id === deckId
        )

        expect(matchOnce?.is_active).toBe(false)
        expect(matchTwice?.is_active).toBe(false)
        expect(afterOnce.length).toBe(afterTwice.length)
      }),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Visibility Monotonicity
// Public is strictly more visible than private.
// ============================================

describe('Visibility Monotonicity', () => {
  test('making a deck public never reduces visibility', () => {
    fc.assert(
      fc.property(uuidArb, deckTemplateArb, (userId, deck) => {
        const privateDeck = { ...deck, visibility: 'private' as const }
        const publicDeck = { ...deck, visibility: 'public' as const }

        const visibleAsPrivate = isDeckVisibleToUser(privateDeck, userId)
        const visibleAsPublic = isDeckVisibleToUser(publicDeck, userId)

        // If visible as private, must be visible as public
        if (visibleAsPrivate) {
          expect(visibleAsPublic).toBe(true)
        }

        // Public is always visible
        expect(visibleAsPublic).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('a private deck is visible to fewer users than when public', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 2, maxLength: 20 }),
        deckTemplateArb,
        (userIds, deck) => {
          const privateDeck = { ...deck, visibility: 'private' as const }
          const publicDeck = { ...deck, visibility: 'public' as const }

          const privateVisibleCount = userIds.filter(uid =>
            isDeckVisibleToUser(privateDeck, uid)
          ).length
          const publicVisibleCount = userIds.filter(uid =>
            isDeckVisibleToUser(publicDeck, uid)
          ).length

          expect(privateVisibleCount).toBeLessThanOrEqual(publicVisibleCount)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Filter preserves order and does not duplicate
// ============================================

describe('Filter Properties', () => {
  test('filterVisibleDecks never returns duplicates', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(deckTemplateArb, { maxLength: 30 }),
        (userId, decks) => {
          const filtered = filterVisibleDecks(decks, userId)
          const ids = filtered.map(d => d.id)
          const uniqueIds = new Set(ids)
          // If input has no duplicates, output should have no duplicates
          const inputIds = decks.map(d => d.id)
          const inputUniqueIds = new Set(inputIds)
          if (inputIds.length === inputUniqueIds.size) {
            expect(ids.length).toBe(uniqueIds.size)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('filterVisibleDecks preserves relative order', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(deckTemplateArb, { maxLength: 20 }),
        (userId, decks) => {
          const filtered = filterVisibleDecks(decks, userId)

          // Check that the relative order is preserved
          for (let i = 0; i < filtered.length - 1; i++) {
            const idxA = decks.indexOf(filtered[i])
            const idxB = decks.indexOf(filtered[i + 1])
            expect(idxA).toBeLessThan(idxB)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('filterVisibleDecks length is at most input length', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.array(deckTemplateArb, { maxLength: 30 }),
        (userId, decks) => {
          const filtered = filterVisibleDecks(decks, userId)
          expect(filtered.length).toBeLessThanOrEqual(decks.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('filtering with null userId keeps only public decks', () => {
    fc.assert(
      fc.property(
        fc.array(deckTemplateArb, { maxLength: 20 }),
        (decks) => {
          const filtered = filterVisibleDecks(decks, null)
          for (const deck of filtered) {
            expect(deck.visibility).toBe('public')
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: canUserSubscribe / isDeckVisibleToUser consistency
// ============================================

describe('canUserSubscribe / isDeckVisibleToUser Consistency', () => {
  test('canUserSubscribe.allowed matches isDeckVisibleToUser', () => {
    fc.assert(
      fc.property(uuidArb, deckTemplateArb, (userId, deck) => {
        const isVisible = isDeckVisibleToUser(deck, userId)
        const canSub = canUserSubscribe(deck, userId)

        expect(canSub.allowed).toBe(isVisible)
      }),
      { numRuns: 200 }
    )
  })

  test('canUserSubscribe reason matches visibility state', () => {
    fc.assert(
      fc.property(uuidArb, deckTemplateArb, (userId, deck) => {
        const result = canUserSubscribe(deck, userId)

        if (result.allowed) {
          expect(result.reason).toBe('allowed')
        } else {
          expect(result.reason).toBe('not_visible')
        }
      }),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Active subscription invariants
// ============================================

describe('Active Subscription Count Invariants', () => {
  test('active count never exceeds total subscription count', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(userDeckArb, { maxLength: 30 }),
        (userId, userDecks) => {
          const active = getActiveSubscriptions(userDecks, userId)
          const userSubs = userDecks.filter(ud => ud.user_id === userId)

          expect(active.length).toBeLessThanOrEqual(userSubs.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('subscribing increases active count by 0 or 1', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(userDeckArb, { maxLength: 15 }),
        (userId, deckId, userDecks) => {
          const activeBefore = getActiveSubscriptions(userDecks, userId).length
          const afterSub = applySubscription(userDecks, userId, deckId)
          const activeAfter = getActiveSubscriptions(afterSub, userId).length

          const delta = activeAfter - activeBefore
          expect(delta).toBeGreaterThanOrEqual(0)
          expect(delta).toBeLessThanOrEqual(1)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('unsubscribing decreases active count by 0 or 1', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(userDeckArb, { maxLength: 15 }),
        (userId, deckId, userDecks) => {
          const activeBefore = getActiveSubscriptions(userDecks, userId).length
          const afterUnsub = applyUnsubscription(userDecks, userId, deckId)
          const activeAfter = getActiveSubscriptions(afterUnsub, userId).length

          const delta = activeBefore - activeAfter
          expect(delta).toBeGreaterThanOrEqual(0)
          expect(delta).toBeLessThanOrEqual(1)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Subscription isolation between users
// ============================================

describe('Subscription User Isolation', () => {
  test('subscribing as userA does not affect userB active subscriptions', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.array(userDeckArb, { maxLength: 10 }),
        (userA, userB, deckId, userDecks) => {
          fc.pre(userA !== userB)

          const activeBBefore = getActiveSubscriptions(userDecks, userB)
          const afterSubA = applySubscription(userDecks, userA, deckId)
          const activeBAfter = getActiveSubscriptions(afterSubA, userB)

          expect(activeBBefore.length).toBe(activeBAfter.length)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('unsubscribing as userA does not affect userB active subscriptions', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        uuidArb,
        fc.array(userDeckArb, { maxLength: 10 }),
        (userA, userB, deckId, userDecks) => {
          fc.pre(userA !== userB)

          const activeBBefore = getActiveSubscriptions(userDecks, userB)
          const afterUnsubA = applyUnsubscription(userDecks, userA, deckId)
          const activeBAfter = getActiveSubscriptions(afterUnsubA, userB)

          expect(activeBBefore.length).toBe(activeBAfter.length)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Due count boundaries
// ============================================

describe('Due Count Boundaries', () => {
  const progressRecordArb = fc.record({
    card_template_id: uuidArb,
    next_review: isoDateArb,
    deck_template_id: uuidArb,
  })

  test('due count is always non-negative', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(progressRecordArb, { maxLength: 50 }),
        fc.integer({ min: minTimestamp, max: maxTimestamp }).map(ts => new Date(ts)),
        (deckId, records, now) => {
          const count = calculateDueCount(records, deckId, now)
          expect(count).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('due count never exceeds total records for that deck', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(progressRecordArb, { maxLength: 50 }),
        fc.integer({ min: minTimestamp, max: maxTimestamp }).map(ts => new Date(ts)),
        (deckId, records, now) => {
          const count = calculateDueCount(records, deckId, now)
          const totalForDeck = records.filter(r => r.deck_template_id === deckId).length

          expect(count).toBeLessThanOrEqual(totalForDeck)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('due count is monotonically non-decreasing as time advances', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(progressRecordArb, { minLength: 1, maxLength: 30 }),
        fc.integer({ min: minTimestamp, max: maxTimestamp - 1000000 }),
        fc.integer({ min: 1, max: 1000000 }),
        (deckId, records, startTs, delta) => {
          const earlier = new Date(startTs)
          const later = new Date(startTs + delta)

          const dueEarlier = calculateDueCount(records, deckId, earlier)
          const dueLater = calculateDueCount(records, deckId, later)

          expect(dueLater).toBeGreaterThanOrEqual(dueEarlier)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('due count with empty records is zero', () => {
    fc.assert(
      fc.property(uuidArb, (deckId) => {
        const count = calculateDueCount([], deckId)
        expect(count).toBe(0)
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property: Immutability
// ============================================

describe('Immutability of Operations', () => {
  test('applySubscription does not mutate input array', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(userDeckArb, { maxLength: 10 }),
        (userId, deckId, userDecks) => {
          const originalLength = userDecks.length
          const originalRefs = userDecks.map(ud => ud)
          applySubscription(userDecks, userId, deckId)
          expect(userDecks.length).toBe(originalLength)
          originalRefs.forEach((ref, i) => expect(userDecks[i]).toBe(ref))
        }
      ),
      { numRuns: 200 }
    )
  })

  test('applyUnsubscription does not mutate input array', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        fc.array(userDeckArb, { maxLength: 10 }),
        (userId, deckId, userDecks) => {
          const originalLength = userDecks.length
          const originalRefs = userDecks.map(ud => ud)
          applyUnsubscription(userDecks, userId, deckId)
          expect(userDecks.length).toBe(originalLength)
          originalRefs.forEach((ref, i) => expect(userDecks[i]).toBe(ref))
        }
      ),
      { numRuns: 200 }
    )
  })

  test('filterVisibleDecks does not mutate input array', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(deckTemplateArb, { maxLength: 10 }),
        (userId, decks) => {
          const originalLength = decks.length
          const originalRefs = decks.map(d => d)
          filterVisibleDecks(decks, userId)
          expect(decks.length).toBe(originalLength)
          originalRefs.forEach((ref, i) => expect(decks[i]).toBe(ref))
        }
      ),
      { numRuns: 200 }
    )
  })
})
