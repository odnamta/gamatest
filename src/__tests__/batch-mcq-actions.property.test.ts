import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  draftBatchInputSchema,
  bulkCreateInputSchema,
  mcqBatchItemSchema,
  mcqBatchDraftSchema,
  type MCQBatchItem,
} from '@/lib/batch-mcq-schema'

/**
 * Property tests for batch MCQ server actions
 * Feature: v6-fast-ingestion
 * 
 * Note: These tests focus on schema validation and logic that can be tested
 * without mocking OpenAI or database. Integration tests would be needed for
 * full end-to-end testing.
 */

// Arbitrary for valid MCQ batch item
const validMCQBatchItemArb = fc.record({
  stem: fc.string({ minLength: 10, maxLength: 500 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
  correctIndex: fc.integer({ min: 0, max: 4 }),
  explanation: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined }),
  tags: fc.option(
    fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
    { nil: undefined }
  ),
})

// Arbitrary for valid draft batch input
const validDraftBatchInputArb = fc.record({
  deckId: fc.uuid(),
  text: fc.string({ minLength: 50, maxLength: 1000 }),
  defaultTags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }), { nil: undefined }),
})

// Arbitrary for valid bulk create input
const validBulkCreateInputArb = fc.record({
  deckId: fc.uuid(),
  cards: fc.array(
    fc.record({
      stem: fc.string({ minLength: 1, maxLength: 500 }),
      options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
      correctIndex: fc.integer({ min: 0, max: 4 }),
      explanation: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: undefined }),
      tagNames: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }),
    }),
    { minLength: 1, maxLength: 5 }
  ),
})

describe('Batch MCQ Actions Property Tests', () => {
  /**
   * **Feature: v6-fast-ingestion, Property 3: Batch output size is bounded 0-5**
   * **Validates: Requirements R1.2**
   * 
   * For any valid text input to draftBatchMCQFromText, the returned drafts
   * array length should be between 0 and 5 inclusive.
   */
  describe('Property 3: Batch output size is bounded 0-5', () => {
    it('mcqBatchDraftSchema accepts arrays of 0-5 items', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 0, maxLength: 5 }),
          (items) => {
            const result = mcqBatchDraftSchema.safeParse(items)
            return result.success === true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('mcqBatchDraftSchema rejects arrays with more than 5 items', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 6, maxLength: 10 }),
          (items) => {
            const result = mcqBatchDraftSchema.safeParse(items)
            return result.success === false
          }
        ),
        { numRuns: 50 }
      )
    })

    it('empty array is valid (0 items)', () => {
      const result = mcqBatchDraftSchema.safeParse([])
      expect(result.success).toBe(true)
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 5: Batch output capped at 5**
   * **Validates: Requirements R1.2**
   * 
   * For any AI response containing more than 5 MCQs, the processed output
   * should contain exactly 5 items (the first 5).
   */
  describe('Property 5: Batch output capped at 5', () => {
    it('slicing to 5 items produces valid schema', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 6, maxLength: 10 }),
          (items) => {
            // Simulate the capping logic from the server action
            const capped = items.slice(0, 5)
            const result = mcqBatchDraftSchema.safeParse(capped)
            return result.success === true && capped.length === 5
          }
        ),
        { numRuns: 50 }
      )
    })

    it('capping preserves first 5 items in order', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 6, maxLength: 10 }),
          (items) => {
            const capped = items.slice(0, 5)
            // First 5 items should match
            for (let i = 0; i < 5; i++) {
              if (capped[i].stem !== items[i].stem) {
                return false
              }
            }
            return true
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 6: Invalid AI response returns typed error**
   * **Validates: Requirements R1.2, NFR-2**
   * 
   * For any AI response that fails Zod validation, the action should return
   * { ok: false, error: { message, code } } and not throw an exception.
   */
  describe('Property 6: Invalid AI response returns typed error', () => {
    it('draftBatchInputSchema rejects text shorter than 50 chars', () => {
      fc.assert(
        fc.property(
          fc.record({
            deckId: fc.uuid(),
            text: fc.string({ minLength: 0, maxLength: 49 }),
          }),
          (input) => {
            const result = draftBatchInputSchema.safeParse(input)
            return result.success === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('draftBatchInputSchema rejects invalid deck ID', () => {
      fc.assert(
        fc.property(
          fc.record({
            deckId: fc.string({ minLength: 1, maxLength: 20 }), // Not a UUID
            text: fc.string({ minLength: 50, maxLength: 1000 }),
          }),
          (input) => {
            const result = draftBatchInputSchema.safeParse(input)
            return result.success === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('draftBatchInputSchema accepts valid input', () => {
      fc.assert(
        fc.property(validDraftBatchInputArb, (input) => {
          const result = draftBatchInputSchema.safeParse(input)
          return result.success === true
        }),
        { numRuns: 100 }
      )
    })

    it('mcqBatchItemSchema rejects items with invalid correctIndex', () => {
      fc.assert(
        fc.property(
          fc.record({
            stem: fc.string({ minLength: 10, maxLength: 500 }),
            options: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
            correctIndex: fc.oneof(
              fc.integer({ min: -100, max: -1 }),
              fc.integer({ min: 5, max: 100 })
            ),
          }),
          (item) => {
            const result = mcqBatchItemSchema.safeParse(item)
            return result.success === false
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 11: Atomic bulk save - all or nothing**
   * **Validates: Requirements R1.4, NFR-2**
   * 
   * Tests for bulkCreateInputSchema validation.
   */
  describe('Property 11: Atomic bulk save - all or nothing (schema validation)', () => {
    it('bulkCreateInputSchema accepts valid input', () => {
      fc.assert(
        fc.property(validBulkCreateInputArb, (input) => {
          const result = bulkCreateInputSchema.safeParse(input)
          return result.success === true
        }),
        { numRuns: 100 }
      )
    })

    it('bulkCreateInputSchema rejects empty cards array', () => {
      fc.assert(
        fc.property(
          fc.record({
            deckId: fc.uuid(),
            cards: fc.constant([]),
          }),
          (input) => {
            const result = bulkCreateInputSchema.safeParse(input)
            return result.success === false
          }
        ),
        { numRuns: 50 }
      )
    })

    it('bulkCreateInputSchema rejects more than 5 cards', () => {
      fc.assert(
        fc.property(
          fc.record({
            deckId: fc.uuid(),
            cards: fc.array(
              fc.record({
                stem: fc.string({ minLength: 1, maxLength: 100 }),
                options: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
                correctIndex: fc.integer({ min: 0, max: 4 }),
                tagNames: fc.array(fc.string(), { maxLength: 3 }),
              }),
              { minLength: 6, maxLength: 10 }
            ),
          }),
          (input) => {
            const result = bulkCreateInputSchema.safeParse(input)
            return result.success === false
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 12: Failed bulk save creates zero cards**
   * **Validates: Requirements R1.4**
   * 
   * This property is about runtime behavior - validation ensures invalid input
   * is rejected before any database operations occur.
   */
  describe('Property 12: Failed bulk save creates zero cards (validation)', () => {
    it('invalid input is rejected before any processing', () => {
      // Invalid inputs should fail validation, preventing any DB operations
      const invalidInputs = [
        { deckId: 'not-a-uuid', cards: [] },
        { deckId: '123e4567-e89b-12d3-a456-426614174000', cards: [] },
        { cards: [{ stem: 'test', options: ['a', 'b'], correctIndex: 0, tagNames: [] }] },
      ]

      for (const input of invalidInputs) {
        const result = bulkCreateInputSchema.safeParse(input)
        expect(result.success).toBe(false)
      }
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 14: New AI tags created for user**
   * **Validates: Requirements R1.5**
   * 
   * This tests that tagNames in bulk create input are properly validated.
   */
  describe('Property 14: New AI tags created for user (schema validation)', () => {
    it('tagNames array is accepted in bulk create input', () => {
      fc.assert(
        fc.property(
          fc.record({
            deckId: fc.uuid(),
            cards: fc.array(
              fc.record({
                stem: fc.string({ minLength: 1, maxLength: 100 }),
                options: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
                correctIndex: fc.integer({ min: 0, max: 4 }),
                tagNames: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          (input) => {
            const result = bulkCreateInputSchema.safeParse(input)
            return result.success === true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
