import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  checkSourceOwnership,
  checkDeckSourceOwnership,
  checkSourceFileAccess,
} from '../lib/source-authorization'
import type { Source, DeckSource, Deck } from '@/types/database'
import type { AuthorizationResult } from '../lib/source-authorization'

/**
 * Property-based tests for source-authorization.ts
 *
 * Covers properties NOT in source-access-control.property.test.ts:
 * - checkSourceFileAccess === checkSourceOwnership equivalence
 * - Authorization result type invariants
 * - Error priority ordering
 * - Single-owner exclusivity
 * - Cross-function consistency
 */

// ============================================
// Shared Generators
// ============================================

const uuidArb = fc.uuid()

const minTimestamp = new Date('2020-01-01').getTime()
const maxTimestamp = new Date('2030-12-31').getTime()
const isoDateArb = fc
  .integer({ min: minTimestamp, max: maxTimestamp })
  .map((ts) => new Date(ts).toISOString())

const titleArb = fc.string({ minLength: 1, maxLength: 100 })
const fileUrlArb = fc.webUrl()

const sourceArb = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  title: titleArb,
  type: fc.constantFrom('pdf_book', 'pdf_notes', 'document'),
  file_url: fileUrlArb,
  metadata: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
  created_at: isoDateArb,
}) as fc.Arbitrary<Source>

const deckArb = fc.record({
  id: uuidArb,
  user_id: uuidArb,
  title: titleArb,
  created_at: isoDateArb,
}) as fc.Arbitrary<Deck>

const deckSourceArb = fc.record({
  id: uuidArb,
  deck_id: uuidArb,
  source_id: uuidArb,
  created_at: isoDateArb,
}) as fc.Arbitrary<DeckSource>

// ============================================
// Property: checkSourceFileAccess === checkSourceOwnership
// The module explicitly delegates file access to source ownership.
// ============================================

describe('File Access / Source Ownership Equivalence', () => {
  test('checkSourceFileAccess returns identical result to checkSourceOwnership for all inputs', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(sourceArb, { nil: null }),
        (userId, source) => {
          const fileResult = checkSourceFileAccess(userId, source)
          const ownerResult = checkSourceOwnership(userId, source)

          expect(fileResult.authorized).toBe(ownerResult.authorized)
          expect(fileResult.reason).toBe(ownerResult.reason)
        }
      ),
      { numRuns: 300 }
    )
  })
})

// ============================================
// Property: Authorization Result Type Invariants
// ============================================

describe('Authorization Result Type Invariants', () => {
  const validSourceReasons = new Set(['authorized', 'not_owner', 'no_user', 'source_not_found'])
  const validDeckSourceReasons = new Set(['authorized', 'not_owner', 'no_user', 'not_found'])

  test('checkSourceOwnership reason is always a valid value', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(sourceArb, { nil: null }),
        (userId, source) => {
          const result = checkSourceOwnership(userId, source)
          expect(validSourceReasons.has(result.reason)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkDeckSourceOwnership reason is always a valid value', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(deckSourceArb, { nil: null }),
        fc.option(deckArb, { nil: null }),
        (userId, deckSource, deck) => {
          const result = checkDeckSourceOwnership(userId, deckSource, deck)
          expect(validDeckSourceReasons.has(result.reason)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('authorized=true always means reason is "authorized"', () => {
    fc.assert(
      fc.property(uuidArb, sourceArb, (userId, source) => {
        const ownedSource: Source = { ...source, user_id: userId }
        const result = checkSourceOwnership(userId, ownedSource)

        if (result.authorized) {
          expect(result.reason).toBe('authorized')
        }
      }),
      { numRuns: 200 }
    )
  })

  test('authorized=false never has reason "authorized"', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(sourceArb, { nil: null }),
        (userId, source) => {
          const result = checkSourceOwnership(userId, source)
          if (!result.authorized) {
            expect(result.reason).not.toBe('authorized')
          }
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Determinism
// ============================================

describe('Authorization Determinism', () => {
  test('checkSourceOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(sourceArb, { nil: null }),
        (userId, source) => {
          const r1 = checkSourceOwnership(userId, source)
          const r2 = checkSourceOwnership(userId, source)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkDeckSourceOwnership is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(deckSourceArb, { nil: null }),
        fc.option(deckArb, { nil: null }),
        (userId, deckSource, deck) => {
          const r1 = checkDeckSourceOwnership(userId, deckSource, deck)
          const r2 = checkDeckSourceOwnership(userId, deckSource, deck)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('checkSourceFileAccess is deterministic', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(sourceArb, { nil: null }),
        (userId, source) => {
          const r1 = checkSourceFileAccess(userId, source)
          const r2 = checkSourceFileAccess(userId, source)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Error Priority Order
// no_user > source_not_found/not_found > not_owner
// ============================================

describe('Error Priority Order', () => {
  test('null userId always yields no_user regardless of source', () => {
    fc.assert(
      fc.property(
        fc.option(sourceArb, { nil: null }),
        (source) => {
          const result = checkSourceOwnership(null, source)
          expect(result.authorized).toBe(false)
          expect(result.reason).toBe('no_user')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('null userId always yields no_user for deck source', () => {
    fc.assert(
      fc.property(
        fc.option(deckSourceArb, { nil: null }),
        fc.option(deckArb, { nil: null }),
        (deckSource, deck) => {
          const result = checkDeckSourceOwnership(null, deckSource, deck)
          expect(result.authorized).toBe(false)
          expect(result.reason).toBe('no_user')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('null source yields source_not_found (not not_owner)', () => {
    fc.assert(
      fc.property(uuidArb, (userId) => {
        const result = checkSourceOwnership(userId, null)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('source_not_found')
      }),
      { numRuns: 100 }
    )
  })

  test('null deckSource or deck yields not_found (not not_owner)', () => {
    fc.assert(
      fc.property(uuidArb, deckArb, (userId, deck) => {
        const result1 = checkDeckSourceOwnership(userId, null, deck)
        expect(result1.reason).toBe('not_found')

        const result2 = checkDeckSourceOwnership(userId, null, null)
        expect(result2.reason).toBe('not_found')
      }),
      { numRuns: 100 }
    )
  })

  test('null deck with valid deckSource yields not_found', () => {
    fc.assert(
      fc.property(uuidArb, deckSourceArb, (userId, deckSource) => {
        const result = checkDeckSourceOwnership(userId, deckSource, null)
        expect(result.reason).toBe('not_found')
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property: Single-Owner Exclusivity
// ============================================

describe('Single-Owner Exclusivity', () => {
  test('two different users cannot both be authorized for the same source', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, sourceArb, (userId1, userId2, source) => {
        fc.pre(userId1 !== userId2)

        const r1 = checkSourceOwnership(userId1, source)
        const r2 = checkSourceOwnership(userId2, source)

        // At most one can be authorized
        expect(r1.authorized && r2.authorized).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  test('two different users cannot both be authorized for the same deckSource', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, deckArb, deckSourceArb, (userId1, userId2, deck, deckSource) => {
        fc.pre(userId1 !== userId2)

        const linkedDs: DeckSource = { ...deckSource, deck_id: deck.id }

        const r1 = checkDeckSourceOwnership(userId1, linkedDs, deck)
        const r2 = checkDeckSourceOwnership(userId2, linkedDs, deck)

        expect(r1.authorized && r2.authorized).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  test('exactly the source owner is authorized', () => {
    fc.assert(
      fc.property(uuidArb, sourceArb, (userId, source) => {
        const ownedSource: Source = { ...source, user_id: userId }

        expect(checkSourceOwnership(userId, ownedSource).authorized).toBe(true)
        expect(checkSourceOwnership(userId, ownedSource).reason).toBe('authorized')
      }),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: Cross-function consistency
// If source ownership is denied, file access must also be denied.
// If deckSource ownership is denied for chain mismatch, ownership is denied.
// ============================================

describe('Cross-Function Consistency', () => {
  test('source ownership denial implies file access denial', () => {
    fc.assert(
      fc.property(
        fc.option(uuidArb, { nil: null }),
        fc.option(sourceArb, { nil: null }),
        (userId, source) => {
          const ownerResult = checkSourceOwnership(userId, source)
          const fileResult = checkSourceFileAccess(userId, source)

          if (!ownerResult.authorized) {
            expect(fileResult.authorized).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('deckSource broken chain means not_found even for deck owner', () => {
    fc.assert(
      fc.property(uuidArb, deckArb, deckSourceArb, (userId, deck, deckSource) => {
        const ownedDeck: Deck = { ...deck, user_id: userId }
        // deckSource points to different deck
        fc.pre(deckSource.deck_id !== ownedDeck.id)

        const result = checkDeckSourceOwnership(userId, deckSource, ownedDeck)
        expect(result.authorized).toBe(false)
        expect(result.reason).toBe('not_found')
      }),
      { numRuns: 200 }
    )
  })

  test('deckSource authorized implies deck is owned by user', () => {
    fc.assert(
      fc.property(uuidArb, deckArb, deckSourceArb, (userId, deck, deckSource) => {
        const ownedDeck: Deck = { ...deck, user_id: userId }
        const linkedDs: DeckSource = { ...deckSource, deck_id: ownedDeck.id }

        const result = checkDeckSourceOwnership(userId, linkedDs, ownedDeck)

        if (result.authorized) {
          expect(ownedDeck.user_id).toBe(userId)
        }
      }),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Property: No false positives
// Non-owners are never authorized.
// ============================================

describe('No False Positives', () => {
  test('non-owner of source is never authorized', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, sourceArb, (userId, ownerId, source) => {
        fc.pre(userId !== ownerId)
        const otherSource: Source = { ...source, user_id: ownerId }

        const result = checkSourceOwnership(userId, otherSource)
        expect(result.authorized).toBe(false)
      }),
      { numRuns: 200 }
    )
  })

  test('non-owner of deck is never authorized for deckSource', () => {
    fc.assert(
      fc.property(uuidArb, uuidArb, deckArb, deckSourceArb, (userId, ownerId, deck, deckSource) => {
        fc.pre(userId !== ownerId)
        const otherDeck: Deck = { ...deck, user_id: ownerId }
        const linkedDs: DeckSource = { ...deckSource, deck_id: otherDeck.id }

        const result = checkDeckSourceOwnership(userId, linkedDs, otherDeck)
        expect(result.authorized).toBe(false)
      }),
      { numRuns: 200 }
    )
  })
})
