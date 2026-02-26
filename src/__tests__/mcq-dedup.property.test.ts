/**
 * V13: MCQ Batch Deduplication Property Tests
 *
 * Verifies the deduplicateMCQBatch function guarantees:
 * 1. No duplicate normalized stems in output
 * 2. All unique stems from input appear in output
 * 3. Order is preserved (first occurrence kept)
 * 4. Count of removed duplicates is correct
 * 5. Existing stems are excluded when provided
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { deduplicateMCQBatch, normalizeStem } from '@/lib/deduplication'

// Minimal MCQ-shaped object for testing
interface TestMCQ {
  stem: string
  options: string[]
  correctIndex: number
}

// Generator for MCQ-like objects with non-trivial stems
const mcqArb = fc.record({
  stem: fc.string({ minLength: 1, maxLength: 200 }),
  options: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
  correctIndex: fc.integer({ min: 0, max: 4 }),
})

// Generator for stems that normalize to non-empty
const nonEmptyStemArb = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => normalizeStem(s).length > 0)

describe('V13: deduplicateMCQBatch', () => {
  /**
   * Property 1: No duplicate normalized stems in output.
   */
  it('output contains no duplicate normalized stems', () => {
    fc.assert(
      fc.property(
        fc.array(mcqArb, { minLength: 0, maxLength: 50 }),
        (items) => {
          const { unique } = deduplicateMCQBatch(items)
          const normalizedStems = unique
            .map((item) => normalizeStem(item.stem))
            .filter((s) => s !== '')
          const uniqueNormalized = new Set(normalizedStems)
          expect(normalizedStems.length).toBe(uniqueNormalized.size)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Property 2: All unique stems from input appear in output.
   * Every distinct normalized stem present in the input must have
   * exactly one representative in the output.
   */
  it('every unique stem from input has a representative in output', () => {
    fc.assert(
      fc.property(
        fc.array(mcqArb, { minLength: 0, maxLength: 50 }),
        (items) => {
          const { unique } = deduplicateMCQBatch(items)

          // Collect all non-empty unique normalized stems from input
          const inputStems = new Set(
            items.map((i) => normalizeStem(i.stem)).filter((s) => s !== ''),
          )
          // Collect all non-empty normalized stems from output
          const outputStems = new Set(
            unique.map((i) => normalizeStem(i.stem)).filter((s) => s !== ''),
          )

          for (const stem of inputStems) {
            expect(outputStems.has(stem)).toBe(true)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Property 3: Order is preserved -- first occurrence of each stem is kept.
   * For each item in the output, it must be the first item in the input
   * with that normalized stem.
   */
  it('preserves order and keeps first occurrence', () => {
    fc.assert(
      fc.property(
        fc.array(mcqArb, { minLength: 1, maxLength: 50 }),
        (items) => {
          const { unique } = deduplicateMCQBatch(items)

          // Build map of first occurrence index per normalized stem
          const firstIndex = new Map<string, number>()
          for (let i = 0; i < items.length; i++) {
            const n = normalizeStem(items[i].stem)
            if (n && !firstIndex.has(n)) {
              firstIndex.set(n, i)
            }
          }

          // Each output item should be the item at the first-occurrence index
          for (const item of unique) {
            const n = normalizeStem(item.stem)
            if (!n) continue // empty stems are passed through
            const idx = firstIndex.get(n)
            expect(idx).toBeDefined()
            expect(item).toBe(items[idx!])
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Property 4: removedCount equals input length minus output length
   * (accounting for empty stems that are always kept).
   */
  it('removedCount is correct', () => {
    fc.assert(
      fc.property(
        fc.array(mcqArb, { minLength: 0, maxLength: 50 }),
        (items) => {
          const { unique, removedCount } = deduplicateMCQBatch(items)
          expect(removedCount).toBe(items.length - unique.length)
        },
      ),
      { numRuns: 200 },
    )
  })

  /**
   * Property 5: Empty input yields empty output with zero removedCount.
   */
  it('empty input returns empty output', () => {
    const { unique, removedCount } = deduplicateMCQBatch([])
    expect(unique).toEqual([])
    expect(removedCount).toBe(0)
  })

  /**
   * Property 6: Idempotency -- deduplicating twice produces the same result.
   */
  it('is idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(mcqArb, { minLength: 0, maxLength: 30 }),
        (items) => {
          const first = deduplicateMCQBatch(items)
          const second = deduplicateMCQBatch(first.unique)
          expect(second.unique).toEqual(first.unique)
          expect(second.removedCount).toBe(0)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Property 7: Case and whitespace are treated as duplicates.
   * Two stems differing only in case or whitespace should be deduped.
   */
  it('treats case and whitespace differences as duplicates', () => {
    fc.assert(
      fc.property(nonEmptyStemArb, (stem) => {
        const items: TestMCQ[] = [
          { stem, options: ['A', 'B'], correctIndex: 0 },
          { stem: stem.toUpperCase(), options: ['C', 'D'], correctIndex: 1 },
          { stem: `  ${stem}  `, options: ['E', 'F'], correctIndex: 0 },
          { stem: stem.replace(/./g, (c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())), options: ['G', 'H'], correctIndex: 1 },
        ]

        const { unique, removedCount } = deduplicateMCQBatch(items)
        // Should keep only 1 representative
        const normalizedSet = new Set(
          unique.map((u) => normalizeStem(u.stem)).filter((s) => s !== ''),
        )
        expect(normalizedSet.size).toBeLessThanOrEqual(1)
        expect(removedCount).toBe(items.length - unique.length)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Property 8: existingStems parameter excludes matching items.
   */
  it('excludes items whose stems match existingStems', () => {
    fc.assert(
      fc.property(
        fc.array(nonEmptyStemArb, { minLength: 1, maxLength: 20 }),
        (stems) => {
          // Use first half as "existing", create MCQs from all
          const halfIdx = Math.max(1, Math.floor(stems.length / 2))
          const existingStems = new Set(
            stems.slice(0, halfIdx).map((s) => normalizeStem(s)),
          )

          const items: TestMCQ[] = stems.map((stem) => ({
            stem,
            options: ['A', 'B'],
            correctIndex: 0,
          }))

          const { unique } = deduplicateMCQBatch(items, existingStems)

          // No output item should have a stem in existingStems
          for (const item of unique) {
            const n = normalizeStem(item.stem)
            if (n) {
              expect(existingStems.has(n)).toBe(false)
            }
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Property 9: Items with only-whitespace stems are passed through
   * (they normalize to empty and don't match anything).
   */
  it('passes through items with empty/whitespace-only stems', () => {
    const items: TestMCQ[] = [
      { stem: '   ', options: ['A', 'B'], correctIndex: 0 },
      { stem: '', options: ['C', 'D'], correctIndex: 1 },
      { stem: '   ', options: ['E', 'F'], correctIndex: 0 },
    ]

    const { unique, removedCount } = deduplicateMCQBatch(items)
    // All items should pass through since they normalize to empty
    expect(unique.length).toBe(3)
    expect(removedCount).toBe(0)
  })

  /**
   * Property 10: Whitespace collapse treats "What  is  X?" same as "What is X?"
   */
  it('collapses internal whitespace for dedup', () => {
    const items: TestMCQ[] = [
      { stem: 'What is X?', options: ['A', 'B'], correctIndex: 0 },
      { stem: 'What  is  X?', options: ['C', 'D'], correctIndex: 1 },
      { stem: 'What   is\t X?', options: ['E', 'F'], correctIndex: 0 },
    ]

    const { unique, removedCount } = deduplicateMCQBatch(items)
    expect(unique.length).toBe(1)
    expect(removedCount).toBe(2)
    // The first occurrence is kept
    expect(unique[0].stem).toBe('What is X?')
  })
})
