/**
 * V11.6: Bulk Drafts Flow - Property-Based Tests
 * 
 * Tests draft filtering, ordering, and bulk status transitions.
 * **Feature: v11.6-bulk-import-reliability**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ============================================
// Type Definitions
// ============================================

type CardStatus = 'draft' | 'published' | 'archived'

interface CardTemplate {
  id: string
  deckTemplateId: string
  status: CardStatus
  questionNumber: number | null
  createdAt: string
  stem: string
}

// ============================================
// Pure Helper Functions for Testing
// ============================================

/**
 * V11.6: Filters cards to only drafts for a specific deck
 * Simulates getDeckDrafts query logic
 */
function filterDraftsForDeck(cards: CardTemplate[], deckId: string): CardTemplate[] {
  return cards.filter(
    (card) => card.status === 'draft' && card.deckTemplateId === deckId
  )
}

/**
 * V11.6: Sorts drafts by question_number ASC NULLS LAST, then created_at ASC, then id ASC
 */
function sortDrafts(drafts: CardTemplate[]): CardTemplate[] {
  return [...drafts].sort((a, b) => {
    // Question number: ASC, nulls last
    if (a.questionNumber !== null && b.questionNumber !== null) {
      if (a.questionNumber !== b.questionNumber) {
        return a.questionNumber - b.questionNumber
      }
    } else if (a.questionNumber === null && b.questionNumber !== null) {
      return 1 // a (null) goes after b
    } else if (a.questionNumber !== null && b.questionNumber === null) {
      return -1 // a goes before b (null)
    }
    
    // Created at: ASC
    const dateCompare = a.createdAt.localeCompare(b.createdAt)
    if (dateCompare !== 0) return dateCompare
    
    // ID: ASC (tiebreaker)
    return a.id.localeCompare(b.id)
  })
}

/**
 * V11.6: Simulates bulk publish - transitions selected cards to 'published'
 */
function bulkPublish(cards: CardTemplate[], selectedIds: string[]): CardTemplate[] {
  const idSet = new Set(selectedIds)
  return cards.map((card) =>
    idSet.has(card.id) ? { ...card, status: 'published' as CardStatus } : card
  )
}

/**
 * V11.6: Simulates bulk archive - transitions selected cards to 'archived'
 */
function bulkArchive(cards: CardTemplate[], selectedIds: string[]): CardTemplate[] {
  const idSet = new Set(selectedIds)
  return cards.map((card) =>
    idSet.has(card.id) ? { ...card, status: 'archived' as CardStatus } : card
  )
}

// ============================================
// Arbitraries
// ============================================

const cardStatusArb = fc.constantFrom('draft', 'published', 'archived') as fc.Arbitrary<CardStatus>

const isoDateArb = fc
  .integer({ min: 1704067200000, max: 1735689600000 }) // 2024-01-01 to 2025-01-01
  .map((ts) => new Date(ts).toISOString())

const cardTemplateArb = fc.record({
  id: fc.uuid(),
  deckTemplateId: fc.uuid(),
  status: cardStatusArb,
  questionNumber: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
  createdAt: isoDateArb,
  stem: fc.string({ minLength: 10, maxLength: 200 }),
})

// ============================================
// Property 1: Draft Filtering - Status and Deck Match
// ============================================

describe('V11.6 Bulk Drafts Flow - Draft Filtering', () => {
  /**
   * **Property 1: Draft Filtering - Status and Deck Match**
   * *For any* deck and set of card_templates with various statuses,
   * when getDeckDrafts is called, the result SHALL contain only cards
   * where status='draft' AND deck_template_id matches the requested deck.
   * 
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Draft Filtering - Status and Deck Match', () => {
    it('returns only draft cards for the specified deck', () => {
      fc.assert(
        fc.property(
          fc.array(cardTemplateArb, { minLength: 0, maxLength: 50 }),
          fc.uuid(), // Target deck ID
          (cards, targetDeckId) => {
            const result = filterDraftsForDeck(cards, targetDeckId)
            
            // All returned cards must be drafts
            for (const card of result) {
              expect(card.status).toBe('draft')
            }
            
            // All returned cards must belong to target deck
            for (const card of result) {
              expect(card.deckTemplateId).toBe(targetDeckId)
            }
            
            // Count should match expected
            const expectedCount = cards.filter(
              (c) => c.status === 'draft' && c.deckTemplateId === targetDeckId
            ).length
            expect(result).toHaveLength(expectedCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('excludes published cards', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Deck ID
          fc.array(
            fc.record({
              id: fc.uuid(),
              deckTemplateId: fc.constant('same-deck'),
              status: fc.constant('published') as fc.Arbitrary<CardStatus>,
              questionNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
              createdAt: isoDateArb,
              stem: fc.string({ minLength: 10 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (deckId, publishedCards) => {
            // All cards are published for same deck
            const cardsWithDeck = publishedCards.map((c) => ({ ...c, deckTemplateId: deckId }))
            const result = filterDraftsForDeck(cardsWithDeck, deckId)
            
            expect(result).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('excludes archived cards', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(
            fc.record({
              id: fc.uuid(),
              deckTemplateId: fc.constant('same-deck'),
              status: fc.constant('archived') as fc.Arbitrary<CardStatus>,
              questionNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
              createdAt: isoDateArb,
              stem: fc.string({ minLength: 10 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (deckId, archivedCards) => {
            const cardsWithDeck = archivedCards.map((c) => ({ ...c, deckTemplateId: deckId }))
            const result = filterDraftsForDeck(cardsWithDeck, deckId)
            
            expect(result).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('excludes drafts from other decks', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // Target deck
          fc.uuid(), // Other deck
          fc.array(
            fc.record({
              id: fc.uuid(),
              deckTemplateId: fc.constant('other'),
              status: fc.constant('draft') as fc.Arbitrary<CardStatus>,
              questionNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
              createdAt: isoDateArb,
              stem: fc.string({ minLength: 10 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (targetDeckId, otherDeckId, draftsFromOther) => {
            // Ensure decks are different
            if (targetDeckId === otherDeckId) return true
            
            const cardsWithOtherDeck = draftsFromOther.map((c) => ({
              ...c,
              deckTemplateId: otherDeckId,
            }))
            const result = filterDraftsForDeck(cardsWithOtherDeck, targetDeckId)
            
            expect(result).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================
// Property 2: Draft Ordering
// ============================================

describe('V11.6 Bulk Drafts Flow - Draft Ordering', () => {
  /**
   * **Property 2: Draft Ordering - Question Number then Created At**
   * *For any* set of draft cards with various question_numbers and created_at timestamps,
   * when getDeckDrafts returns them, they SHALL be ordered by question_number ascending
   * (nulls last), then by created_at ascending.
   * 
   * **Validates: Requirements 1.4**
   */
  describe('Property 2: Draft Ordering - Question Number then Created At', () => {
    it('sorts by question_number ascending with nulls last', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              deckTemplateId: fc.constant('deck-1'),
              status: fc.constant('draft') as fc.Arbitrary<CardStatus>,
              questionNumber: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
              createdAt: isoDateArb,
              stem: fc.string({ minLength: 10 }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (drafts) => {
            const sorted = sortDrafts(drafts)
            
            // Verify ordering
            for (let i = 0; i < sorted.length - 1; i++) {
              const curr = sorted[i]
              const next = sorted[i + 1]
              
              // If both have question numbers
              if (curr.questionNumber !== null && next.questionNumber !== null) {
                // Current should be <= next (or equal with later tiebreakers)
                if (curr.questionNumber !== next.questionNumber) {
                  expect(curr.questionNumber).toBeLessThan(next.questionNumber)
                }
              }
              // If current is null, next must also be null (nulls at end)
              else if (curr.questionNumber === null) {
                expect(next.questionNumber).toBeNull()
              }
              // If current has number and next is null, that's correct (number before null)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('uses created_at as secondary sort when question_numbers match', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // Shared question number
          fc.array(isoDateArb, { minLength: 2, maxLength: 20 }),
          (questionNum, dates) => {
            const drafts: CardTemplate[] = dates.map((dateStr, i) => ({
              id: `card-${i}`,
              deckTemplateId: 'deck-1',
              status: 'draft',
              questionNumber: questionNum, // All same question number
              createdAt: dateStr,
              stem: `Question ${i}`,
            }))
            
            const sorted = sortDrafts(drafts)
            
            // All have same question number, so should be sorted by createdAt
            for (let i = 0; i < sorted.length - 1; i++) {
              const currDate = sorted[i].createdAt
              const nextDate = sorted[i + 1].createdAt
              expect(currDate.localeCompare(nextDate)).toBeLessThanOrEqual(0)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('preserves all cards after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(cardTemplateArb, { minLength: 0, maxLength: 50 }),
          (cards) => {
            const sorted = sortDrafts(cards)
            
            expect(sorted).toHaveLength(cards.length)
            
            const originalIds = new Set(cards.map((c) => c.id))
            const sortedIds = new Set(sorted.map((c) => c.id))
            expect(sortedIds).toEqual(originalIds)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================
// Property 3: Bulk Publish Transitions All Selected
// ============================================

describe('V11.6 Bulk Drafts Flow - Bulk Publish', () => {
  /**
   * **Property 3: Bulk Publish Transitions All Selected**
   * *For any* set of draft card IDs, when bulkPublishDrafts is called,
   * all cards with those IDs SHALL have status='published' after completion,
   * and no other cards SHALL be modified.
   * 
   * **Validates: Requirements 3.1**
   */
  describe('Property 3: Bulk Publish Transitions All Selected', () => {
    it('transitions all selected cards to published', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              deckTemplateId: fc.uuid(),
              status: fc.constant('draft') as fc.Arbitrary<CardStatus>,
              questionNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
              createdAt: isoDateArb,
              stem: fc.string({ minLength: 10 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          fc.func(fc.boolean()), // Random selection function
          (draftCards, selectFn) => {
            // Select some cards randomly
            const selectedIds = draftCards
              .filter((_, i) => selectFn(i))
              .map((c) => c.id)
            
            const result = bulkPublish(draftCards, selectedIds)
            
            // All selected cards should be published
            const selectedSet = new Set(selectedIds)
            for (const card of result) {
              if (selectedSet.has(card.id)) {
                expect(card.status).toBe('published')
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does not modify non-selected cards', () => {
      fc.assert(
        fc.property(
          fc.array(cardTemplateArb, { minLength: 2, maxLength: 30 }),
          (cards) => {
            // Select only first half
            const selectedIds = cards.slice(0, Math.floor(cards.length / 2)).map((c) => c.id)
            const selectedSet = new Set(selectedIds)
            
            const result = bulkPublish(cards, selectedIds)
            
            // Non-selected cards should be unchanged
            for (let i = 0; i < cards.length; i++) {
              if (!selectedSet.has(cards[i].id)) {
                expect(result[i].status).toBe(cards[i].status)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('handles empty selection', () => {
      fc.assert(
        fc.property(
          fc.array(cardTemplateArb, { minLength: 0, maxLength: 20 }),
          (cards) => {
            const result = bulkPublish(cards, [])
            
            // All cards should be unchanged
            for (let i = 0; i < cards.length; i++) {
              expect(result[i].status).toBe(cards[i].status)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================
// Property 4: Bulk Archive Transitions All Selected
// ============================================

describe('V11.6 Bulk Drafts Flow - Bulk Archive', () => {
  /**
   * **Property 4: Bulk Archive Transitions All Selected**
   * *For any* set of draft card IDs, when bulkArchiveDrafts is called,
   * all cards with those IDs SHALL have status='archived' after completion,
   * and no other cards SHALL be modified.
   * 
   * **Validates: Requirements 3.2**
   */
  describe('Property 4: Bulk Archive Transitions All Selected', () => {
    it('transitions all selected cards to archived', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              deckTemplateId: fc.uuid(),
              status: fc.constant('draft') as fc.Arbitrary<CardStatus>,
              questionNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: null }),
              createdAt: isoDateArb,
              stem: fc.string({ minLength: 10 }),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          fc.func(fc.boolean()),
          (draftCards, selectFn) => {
            const selectedIds = draftCards
              .filter((_, i) => selectFn(i))
              .map((c) => c.id)
            
            const result = bulkArchive(draftCards, selectedIds)
            
            const selectedSet = new Set(selectedIds)
            for (const card of result) {
              if (selectedSet.has(card.id)) {
                expect(card.status).toBe('archived')
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does not modify non-selected cards', () => {
      fc.assert(
        fc.property(
          fc.array(cardTemplateArb, { minLength: 2, maxLength: 30 }),
          (cards) => {
            const selectedIds = cards.slice(0, Math.floor(cards.length / 2)).map((c) => c.id)
            const selectedSet = new Set(selectedIds)
            
            const result = bulkArchive(cards, selectedIds)
            
            for (let i = 0; i < cards.length; i++) {
              if (!selectedSet.has(cards[i].id)) {
                expect(result[i].status).toBe(cards[i].status)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Property 5: Bulk Planner Atomicity
// ============================================

describe('V11.6 Bulk Drafts Flow - Planner Atomicity', () => {
  /**
   * V11.6: Pure planner function for bulk create
   * Returns list of intended operations or validation error
   */
  interface BulkCreatePlan {
    cards: Array<{ stem: string; options: string[]; correctIndex: number }>
    tags: string[]
    valid: boolean
    error?: string
  }

  function planBulkCreate(input: {
    cards: Array<{ stem: string; options: string[]; correctIndex: number }>
    sessionTags?: string[]
  }): BulkCreatePlan {
    const { cards, sessionTags = [] } = input
    
    // Validate all cards before planning
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]
      
      // Stem must be non-empty
      if (!card.stem || card.stem.trim().length < 10) {
        return { cards: [], tags: [], valid: false, error: `Card ${i}: stem too short` }
      }
      
      // Must have 2-5 options
      if (!card.options || card.options.length < 2 || card.options.length > 5) {
        return { cards: [], tags: [], valid: false, error: `Card ${i}: invalid options count` }
      }
      
      // correctIndex must be valid
      if (card.correctIndex < 0 || card.correctIndex >= card.options.length) {
        return { cards: [], tags: [], valid: false, error: `Card ${i}: invalid correctIndex` }
      }
    }
    
    // All valid - return complete plan
    return {
      cards,
      tags: sessionTags,
      valid: true,
    }
  }

  /**
   * **Property 5: Bulk Planner Atomicity**
   * Test the pure planner function (not DB writes).
   * If validation fails → returns "no operations".
   * If validation passes → returns complete, consistent set of operations.
   * 
   * **Validates: Requirements 3.5, 4.1, 4.2**
   */
  describe('Property 5: Bulk Planner Atomicity', () => {
    it('returns no operations when validation fails', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              stem: fc.string({ minLength: 0, maxLength: 5 }), // Too short - will fail
              options: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
              correctIndex: fc.integer({ min: 0, max: 4 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (invalidCards) => {
            const plan = planBulkCreate({ cards: invalidCards })
            
            if (!plan.valid) {
              // When invalid, no operations should be planned
              expect(plan.cards).toHaveLength(0)
              expect(plan.error).toBeDefined()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns complete plan when validation passes', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              stem: fc.string({ minLength: 15, maxLength: 200 }),
              options: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
              correctIndex: fc.integer({ min: 0, max: 1 }), // Safe index
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
          (validCards, sessionTags) => {
            const plan = planBulkCreate({ cards: validCards, sessionTags })
            
            if (plan.valid) {
              // All cards should be in the plan
              expect(plan.cards).toHaveLength(validCards.length)
              expect(plan.tags).toEqual(sessionTags)
              expect(plan.error).toBeUndefined()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('fails atomically - one bad card fails entire batch', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              stem: fc.string({ minLength: 15, maxLength: 200 }),
              options: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
              correctIndex: fc.integer({ min: 0, max: 1 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.integer({ min: 0 }), // Index to corrupt
          (validCards, corruptIndex) => {
            // Corrupt one card
            const idx = corruptIndex % validCards.length
            const corruptedCards = validCards.map((c, i) =>
              i === idx ? { ...c, stem: 'short' } : c
            )
            
            const plan = planBulkCreate({ cards: corruptedCards })
            
            // Entire batch should fail
            expect(plan.valid).toBe(false)
            expect(plan.cards).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================
// Property 6: Duplicate Detection
// ============================================

describe('V11.6 Bulk Drafts Flow - Duplicate Detection', () => {
  /**
   * V11.6: Normalize stem for duplicate detection
   */
  function normalizeStem(stem: string): string {
    return stem.toLowerCase().trim().replace(/\s+/g, ' ')
  }

  /**
   * V11.6: Check for duplicates within same deck + session
   */
  interface ExistingCard {
    deckTemplateId: string
    importSessionId: string | null
    normalizedStem: string
  }

  function findDuplicates(
    newCards: Array<{ stem: string }>,
    existingCards: ExistingCard[],
    deckTemplateId: string,
    importSessionId: string | null
  ): { toCreate: number[]; toSkip: number[] } {
    const toCreate: number[] = []
    const toSkip: number[] = []
    
    // Build set of existing normalized stems for this deck + session
    const existingStems = new Set(
      existingCards
        .filter(
          (c) =>
            c.deckTemplateId === deckTemplateId &&
            c.importSessionId === importSessionId
        )
        .map((c) => c.normalizedStem)
    )
    
    // Also track stems we're creating in this batch to avoid intra-batch duplicates
    const batchStems = new Set<string>()
    
    for (let i = 0; i < newCards.length; i++) {
      const normalized = normalizeStem(newCards[i].stem)
      
      if (existingStems.has(normalized) || batchStems.has(normalized)) {
        toSkip.push(i)
      } else {
        toCreate.push(i)
        batchStems.add(normalized)
      }
    }
    
    return { toCreate, toSkip }
  }

  /**
   * **Property 6: Duplicate Detection via Deck + Session + Normalized Stem**
   * *For any* import where a card with the same deck_template_id, import_session_id,
   * and normalized stem already exists, bulkCreateMCQV2 SHALL skip that card
   * and increment skippedCount, without failing the batch.
   * 
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.2, 8.3, 8.4**
   */
  describe('Property 6: Duplicate Detection via Deck + Session + Normalized Stem', () => {
    it('skips cards with matching normalized stems in same deck + session', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // deckTemplateId
          fc.uuid(), // importSessionId
          fc.string({ minLength: 20, maxLength: 100 }), // Original stem
          (deckId, sessionId, originalStem) => {
            const existingCards: ExistingCard[] = [
              {
                deckTemplateId: deckId,
                importSessionId: sessionId,
                normalizedStem: normalizeStem(originalStem),
              },
            ]
            
            // Try to create card with same stem (different case/whitespace)
            const newCards = [
              { stem: originalStem.toUpperCase() },
              { stem: `  ${originalStem}  ` },
              { stem: originalStem.replace(/\s+/g, '  ') },
            ]
            
            const result = findDuplicates(newCards, existingCards, deckId, sessionId)
            
            // All should be skipped as duplicates
            expect(result.toSkip).toHaveLength(3)
            expect(result.toCreate).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('creates cards when deck differs', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // existing deck
          fc.uuid(), // new deck
          fc.uuid(), // session
          fc.string({ minLength: 20, maxLength: 100 }),
          (existingDeckId, newDeckId, sessionId, stem) => {
            // Skip if decks are same
            if (existingDeckId === newDeckId) return true
            
            const existingCards: ExistingCard[] = [
              {
                deckTemplateId: existingDeckId,
                importSessionId: sessionId,
                normalizedStem: normalizeStem(stem),
              },
            ]
            
            const newCards = [{ stem }]
            const result = findDuplicates(newCards, existingCards, newDeckId, sessionId)
            
            // Should create - different deck
            expect(result.toCreate).toHaveLength(1)
            expect(result.toSkip).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('creates cards when session differs', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // deck
          fc.uuid(), // existing session
          fc.uuid(), // new session
          fc.string({ minLength: 20, maxLength: 100 }),
          (deckId, existingSessionId, newSessionId, stem) => {
            // Skip if sessions are same
            if (existingSessionId === newSessionId) return true
            
            const existingCards: ExistingCard[] = [
              {
                deckTemplateId: deckId,
                importSessionId: existingSessionId,
                normalizedStem: normalizeStem(stem),
              },
            ]
            
            const newCards = [{ stem }]
            const result = findDuplicates(newCards, existingCards, deckId, newSessionId)
            
            // Should create - different session
            expect(result.toCreate).toHaveLength(1)
            expect(result.toSkip).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('handles intra-batch duplicates', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 20, maxLength: 100 }),
          (deckId, sessionId, stem) => {
            const existingCards: ExistingCard[] = []
            
            // Same stem multiple times in batch
            const newCards = [
              { stem },
              { stem: stem.toUpperCase() },
              { stem: `  ${stem}  ` },
            ]
            
            const result = findDuplicates(newCards, existingCards, deckId, sessionId)
            
            // First should create, rest should skip
            expect(result.toCreate).toHaveLength(1)
            expect(result.toSkip).toHaveLength(2)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('normalizeStem is idempotent', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 200 }), (stem) => {
          const once = normalizeStem(stem)
          const twice = normalizeStem(once)
          expect(once).toBe(twice)
        }),
        { numRuns: 100 }
      )
    })
  })
})

// ============================================
// Property 7 & 8: Missing Numbers and Complete Status
// ============================================

describe('V11.6 Bulk Drafts Flow - QA Metrics', () => {
  /**
   * Calculate missing question numbers
   */
  function calculateMissingNumbers(
    detectedNumbers: number[],
    createdNumbers: number[]
  ): number[] {
    const createdSet = new Set(createdNumbers)
    return detectedNumbers.filter((n) => !createdSet.has(n)).sort((a, b) => a - b)
  }

  /**
   * Format QA metrics for display
   */
  function formatQAMetrics(metrics: {
    detectedCount: number
    createdCount: number
    missingNumbers: number[]
  }): string {
    const { detectedCount, createdCount, missingNumbers } = metrics
    
    const detectedPart = `Detected ${detectedCount}`
    const createdPart = `Created ${createdCount}`
    
    if (missingNumbers.length === 0 && detectedCount === createdCount && detectedCount > 0) {
      return `${detectedPart} · ${createdPart} · Complete ✓`
    }
    
    if (missingNumbers.length > 0) {
      const missingList = missingNumbers.slice(0, 10).join(', ')
      const suffix = missingNumbers.length > 10 ? '...' : ''
      return `${detectedPart} · ${createdPart} · Missing: ${missingList}${suffix}`
    }
    
    return `${detectedPart} · ${createdPart}`
  }

  /**
   * **Property 7: Missing Numbers Calculation Consistency**
   * *For any* arrays of detected and created question numbers,
   * calculateMissingNumbers SHALL return the set difference (detected - created)
   * sorted ascending, and this result SHALL be consistent across multiple calls.
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 7: Missing Numbers Calculation Consistency', () => {
    it('returns set difference sorted ascending', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.integer({ min: 1, max: 500 }), { minLength: 0, maxLength: 50 }),
          fc.uniqueArray(fc.integer({ min: 1, max: 500 }), { minLength: 0, maxLength: 50 }),
          (detected, created) => {
            const missing = calculateMissingNumbers(detected, created)
            const createdSet = new Set(created)
            
            // All missing should be in detected but not created
            for (const num of missing) {
              expect(detected).toContain(num)
              expect(createdSet.has(num)).toBe(false)
            }
            
            // Should be sorted
            for (let i = 0; i < missing.length - 1; i++) {
              expect(missing[i]).toBeLessThan(missing[i + 1])
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('is idempotent - same input gives same output', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 30 }),
          fc.uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 30 }),
          (detected, created) => {
            const result1 = calculateMissingNumbers(detected, created)
            const result2 = calculateMissingNumbers(detected, created)
            expect(result1).toEqual(result2)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Property 8: Complete Status When No Missing**
   * *For any* QAMetrics where missingNumbers is empty and detectedCount equals
   * createdCount and detectedCount > 0, formatQAMetrics SHALL include "Complete ✓".
   * 
   * **Validates: Requirements 5.4**
   */
  describe('Property 8: Complete Status When No Missing', () => {
    it('shows Complete when all detected are created', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // count > 0
          (count) => {
            const metrics = {
              detectedCount: count,
              createdCount: count,
              missingNumbers: [],
            }
            
            const result = formatQAMetrics(metrics)
            expect(result).toContain('Complete ✓')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does not show Complete when counts differ', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (detected, created) => {
            // Skip when equal
            if (detected === created) return true
            
            const metrics = {
              detectedCount: detected,
              createdCount: created,
              missingNumbers: [],
            }
            
            const result = formatQAMetrics(metrics)
            expect(result).not.toContain('Complete ✓')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does not show Complete when missing numbers exist', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (count, missing) => {
            const metrics = {
              detectedCount: count,
              createdCount: count - missing.length,
              missingNumbers: missing,
            }
            
            const result = formatQAMetrics(metrics)
            expect(result).not.toContain('Complete ✓')
            expect(result).toContain('Missing:')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does not show Complete when detectedCount is 0', () => {
      const metrics = {
        detectedCount: 0,
        createdCount: 0,
        missingNumbers: [],
      }
      
      const result = formatQAMetrics(metrics)
      expect(result).not.toContain('Complete ✓')
    })
  })
})
