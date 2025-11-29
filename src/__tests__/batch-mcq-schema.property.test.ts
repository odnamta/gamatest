import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  mcqBatchItemSchema,
  mcqBatchDraftSchema,
  toUIFormat,
  toUIFormatArray,
  type MCQBatchItem,
} from '@/lib/batch-mcq-schema'

/**
 * Property tests for batch MCQ schemas
 * Feature: v6-fast-ingestion
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

// Arbitrary for invalid stem (too short)
const invalidStemArb = fc.record({
  stem: fc.string({ minLength: 0, maxLength: 9 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
  correctIndex: fc.integer({ min: 0, max: 4 }),
})

// Arbitrary for invalid options (too few)
const invalidOptionsArb = fc.record({
  stem: fc.string({ minLength: 10, maxLength: 500 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 0, maxLength: 1 }),
  correctIndex: fc.integer({ min: 0, max: 4 }),
})

// Arbitrary for invalid correctIndex (out of range)
const invalidCorrectIndexArb = fc.record({
  stem: fc.string({ minLength: 10, maxLength: 500 }),
  options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), { minLength: 2, maxLength: 5 }),
  correctIndex: fc.oneof(fc.integer({ min: -100, max: -1 }), fc.integer({ min: 5, max: 100 })),
})

describe('Batch MCQ Schema Property Tests', () => {
  /**
   * **Feature: v6-fast-ingestion, Property 4: Batch draft schema validation**
   * **Validates: Requirements R1.2**
   * 
   * For any MCQ draft returned by the batch action, it should contain:
   * a stem of at least 10 characters, 2-5 non-empty options,
   * a correctIndex between 0 and 4, and optionally 1-3 topic tags.
   */
  describe('Property 4: Batch draft schema validation', () => {
    it('accepts valid MCQ batch items', () => {
      fc.assert(
        fc.property(validMCQBatchItemArb, (item) => {
          const result = mcqBatchItemSchema.safeParse(item)
          // Valid items should pass validation
          return result.success === true
        }),
        { numRuns: 100 }
      )
    })

    it('rejects items with stem too short', () => {
      fc.assert(
        fc.property(invalidStemArb, (item) => {
          const result = mcqBatchItemSchema.safeParse(item)
          // Items with short stems should fail
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it('rejects items with too few options', () => {
      fc.assert(
        fc.property(invalidOptionsArb, (item) => {
          const result = mcqBatchItemSchema.safeParse(item)
          // Items with < 2 options should fail
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it('rejects items with invalid correctIndex', () => {
      fc.assert(
        fc.property(invalidCorrectIndexArb, (item) => {
          const result = mcqBatchItemSchema.safeParse(item)
          // Items with correctIndex outside 0-4 should fail
          return result.success === false
        }),
        { numRuns: 100 }
      )
    })

    it('batch array is capped at 5 items', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 6, maxLength: 10 }),
          (items) => {
            const result = mcqBatchDraftSchema.safeParse(items)
            // Arrays with > 5 items should fail
            return result.success === false
          }
        ),
        { numRuns: 50 }
      )
    })

    it('accepts batch arrays with 0-5 items', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 0, maxLength: 5 }),
          (items) => {
            const result = mcqBatchDraftSchema.safeParse(items)
            // Arrays with 0-5 items should pass
            return result.success === true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 7: Draft include defaults to true**
   * **Validates: Requirements R1.3**
   * 
   * For any MCQ draft transformed to UI format, the include property
   * should default to true.
   */
  describe('Property 7: Draft include defaults to true', () => {
    it('toUIFormat sets include to true by default', () => {
      fc.assert(
        fc.property(validMCQBatchItemArb, fc.integer({ min: 0, max: 100 }), (item, index) => {
          const uiDraft = toUIFormat(item as MCQBatchItem, index)
          // include should always be true
          return uiDraft.include === true
        }),
        { numRuns: 100 }
      )
    })

    it('toUIFormatArray sets include to true for all drafts', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 1, maxLength: 5 }),
          (items) => {
            const uiDrafts = toUIFormatArray(items as MCQBatchItem[])
            // All drafts should have include === true
            return uiDrafts.every((draft) => draft.include === true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('toUIFormat preserves all draft fields', () => {
      fc.assert(
        fc.property(validMCQBatchItemArb, fc.integer({ min: 0, max: 100 }), (item, index) => {
          const uiDraft = toUIFormat(item as MCQBatchItem, index)
          // All fields should be preserved
          return (
            uiDraft.stem === item.stem &&
            JSON.stringify(uiDraft.options) === JSON.stringify(item.options) &&
            uiDraft.correctIndex === item.correctIndex &&
            uiDraft.explanation === (item.explanation || '') &&
            JSON.stringify(uiDraft.aiTags) === JSON.stringify(item.tags || [])
          )
        }),
        { numRuns: 100 }
      )
    })

    it('toUIFormat generates unique ids', () => {
      fc.assert(
        fc.property(
          fc.array(validMCQBatchItemArb, { minLength: 2, maxLength: 5 }),
          (items) => {
            const uiDrafts = toUIFormatArray(items as MCQBatchItem[])
            const ids = uiDrafts.map((d) => d.id)
            const uniqueIds = new Set(ids)
            // All ids should be unique
            return uniqueIds.size === ids.length
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
