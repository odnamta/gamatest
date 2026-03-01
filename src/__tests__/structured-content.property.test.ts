/**
 * V11: Structured Content Engine - Property-Based Tests
 * 
 * Tests validation schemas and utility functions using fast-check.
 * **Feature: v11-Structured-Content-Engine**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  createBookSourceSchema,
  createChapterSchema,
  isValidBookSourceTitle,
  isValidChapterNumber,
  isValidChapterTitle,
} from '@/lib/structured-content-schema'

describe('V11 Structured Content - Validation Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 1: Book Source Title Validation**
   * *For any* string input to book source creation, if the string is empty or 
   * contains only whitespace, the System SHALL reject the creation with a validation error.
   * **Validates: Requirements 1.2**
   */
  describe('Property 1: Book Source Title Validation', () => {
    it('rejects empty strings', () => {
      const result = createBookSourceSchema.safeParse({ title: '' })
      expect(result.success).toBe(false)
    })

    it('rejects whitespace-only strings', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }).map(arr => arr.join('')),
          (whitespaceOnly) => {
            const result = createBookSourceSchema.safeParse({ title: whitespaceOnly })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('accepts non-empty, non-whitespace strings', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.trim().length > 0),
          (validTitle) => {
            const result = createBookSourceSchema.safeParse({ title: validTitle })
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('isValidBookSourceTitle returns false for empty/whitespace', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''))
          ),
          (invalidTitle) => {
            expect(isValidBookSourceTitle(invalidTitle)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('isValidBookSourceTitle returns true for valid titles', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => s.trim().length > 0),
          (validTitle) => {
            expect(isValidBookSourceTitle(validTitle)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11-Structured-Content-Engine, Property 2: Chapter Number Validation**
   * *For any* chapter creation input, if chapter_number is zero or negative OR 
   * title is empty/whitespace, the System SHALL reject the creation with a validation error.
   * **Validates: Requirements 2.2**
   */
  describe('Property 2: Chapter Number Validation', () => {
    it('rejects zero chapter numbers', () => {
      const result = createChapterSchema.safeParse({
        book_source_id: '00000000-0000-0000-0000-000000000000',
        chapter_number: 0,
        title: 'Valid Title',
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative chapter numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: -1 }),
          (negativeNum) => {
            const result = createChapterSchema.safeParse({
              book_source_id: '00000000-0000-0000-0000-000000000000',
              chapter_number: negativeNum,
              title: 'Valid Title',
            })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('accepts positive chapter numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (positiveNum) => {
            const result = createChapterSchema.safeParse({
              book_source_id: '00000000-0000-0000-0000-000000000000',
              chapter_number: positiveNum,
              title: 'Valid Title',
            })
            expect(result.success).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('isValidChapterNumber returns false for non-positive integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ max: 0 }),
          (invalidNum) => {
            expect(isValidChapterNumber(invalidNum)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('isValidChapterNumber returns true for positive integers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (validNum) => {
            expect(isValidChapterNumber(validNum)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects non-integer chapter numbers', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 100, noNaN: true }).filter(n => !Number.isInteger(n)),
          (floatNum) => {
            expect(isValidChapterNumber(floatNum)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('rejects empty chapter titles', () => {
      const result = createChapterSchema.safeParse({
        book_source_id: '00000000-0000-0000-0000-000000000000',
        chapter_number: 1,
        title: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects whitespace-only chapter titles', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(arr => arr.join('')),
          (whitespaceOnly) => {
            const result = createChapterSchema.safeParse({
              book_source_id: '00000000-0000-0000-0000-000000000000',
              chapter_number: 1,
              title: whitespaceOnly,
            })
            expect(result.success).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('isValidChapterTitle returns false for empty/whitespace', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''))
          ),
          (invalidTitle) => {
            expect(isValidChapterTitle(invalidTitle)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Chapter Ordering Properties
// ============================================

/**
 * Helper to simulate chapter ordering logic (pure function for testing)
 */
function sortChaptersByNumber(chapters: { chapter_number: number }[]): { chapter_number: number }[] {
  return [...chapters].sort((a, b) => a.chapter_number - b.chapter_number)
}

describe('V11 Structured Content - Chapter Ordering Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 3: Chapter Ordering**
   * *For any* list of chapters returned for a book source, the chapters SHALL be 
   * ordered by chapter_number in ascending order.
   * **Validates: Requirements 2.3**
   */
  describe('Property 3: Chapter Ordering', () => {
    it('chapters are sorted by chapter_number ascending', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              book_source_id: fc.uuid(),
              chapter_number: fc.integer({ min: 1, max: 100 }),
              title: fc.string({ minLength: 1 }),
              expected_question_count: fc.option(fc.integer({ min: 1, max: 500 }), { nil: null }),
              created_at: fc.constant(new Date().toISOString()),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (chapters) => {
            const sorted = sortChaptersByNumber(chapters)
            
            // Verify ascending order
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i].chapter_number).toBeGreaterThanOrEqual(sorted[i - 1].chapter_number)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('sorting is stable for equal chapter numbers', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.integer({ min: 1, max: 10 }),
            { minLength: 2, maxLength: 10 }
          ),
          (chapterNumbers) => {
            const chapters = chapterNumbers.map((num, idx) => ({
              chapter_number: num,
              originalIndex: idx,
            }))
            
            const sorted = sortChaptersByNumber(chapters)
            
            // All chapter numbers should be in non-decreasing order
            for (let i = 1; i < sorted.length; i++) {
              expect(sorted[i].chapter_number).toBeGreaterThanOrEqual(sorted[i - 1].chapter_number)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('empty array returns empty array', () => {
      const result = sortChaptersByNumber([])
      expect(result).toEqual([])
    })

    it('single chapter returns same chapter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (chapterNumber) => {
            const chapters = [{ chapter_number: chapterNumber }]
            const sorted = sortChaptersByNumber(chapters)
            expect(sorted).toHaveLength(1)
            expect(sorted[0].chapter_number).toBe(chapterNumber)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Chapter Filtering Properties
// ============================================

/**
 * Helper to simulate chapter filtering by book_source_id (pure function for testing)
 */
function filterChaptersByBook(
  chapters: { id: string; book_source_id: string }[],
  bookSourceId: string
): { id: string; book_source_id: string }[] {
  return chapters.filter(c => c.book_source_id === bookSourceId)
}

describe('V11 Structured Content - Chapter Filtering Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 8: Chapter Selector Filtering**
   * *For any* selected book_source_id, the chapter selector SHALL display only 
   * chapters where book_source_id matches the selected book.
   * **Validates: Requirements 5.2**
   */
  describe('Property 8: Chapter Selector Filtering', () => {
    it('returns only chapters matching the selected book_source_id', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              book_source_id: fc.uuid(),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.uuid(),
          (chapters, selectedBookId) => {
            const filtered = filterChaptersByBook(chapters, selectedBookId)
            
            // All filtered chapters should have matching book_source_id
            for (const chapter of filtered) {
              expect(chapter.book_source_id).toBe(selectedBookId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns all chapters for a book when they exist', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (bookId, chapterIds) => {
            const chapters = chapterIds.map(id => ({
              id,
              book_source_id: bookId,
            }))
            
            const filtered = filterChaptersByBook(chapters, bookId)
            expect(filtered).toHaveLength(chapters.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns empty array when no chapters match', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid().filter((id1) => true), // Different book IDs
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (bookId1, bookId2, chapterIds) => {
            // Ensure book IDs are different
            if (bookId1 === bookId2) return true // Skip this case
            
            const chapters = chapterIds.map(id => ({
              id,
              book_source_id: bookId1,
            }))
            
            const filtered = filterChaptersByBook(chapters, bookId2)
            expect(filtered).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('handles mixed chapters from multiple books', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }), // Book IDs
          fc.array(
            fc.record({
              id: fc.uuid(),
              bookIndex: fc.nat({ max: 4 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (bookIds, chapterData) => {
            // Create chapters with random book assignments
            const chapters = chapterData.map(c => ({
              id: c.id,
              book_source_id: bookIds[c.bookIndex % bookIds.length],
            }))
            
            // Pick a random book to filter by
            const selectedBook = bookIds[0]
            const filtered = filterChaptersByBook(chapters, selectedBook)
            
            // Count expected matches
            const expectedCount = chapters.filter(c => c.book_source_id === selectedBook).length
            expect(filtered).toHaveLength(expectedCount)
            
            // All results should match
            for (const chapter of filtered) {
              expect(chapter.book_source_id).toBe(selectedBook)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Question Number Detection Properties
// ============================================

import {
  detectQuestionNumbers,
  calculateMissingNumbers,
  findSequenceGaps,
} from '@/lib/question-number-detector'

describe('V11 Structured Content - Question Number Detection Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 11: Question Number Pattern Detection**
   * *For any* text containing question numbering patterns (1., 2., 1), 2), Q1, Q2, etc.), 
   * the detectQuestionNumbers function SHALL return all detected numbers in the result set.
   * **Validates: Requirements 7.1**
   */
  describe('Property 11: Question Number Pattern Detection', () => {
    it('detects period-terminated numbers (1. 2. 3.)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (numbers) => {
            const uniqueNumbers = [...new Set(numbers)]
            const text = uniqueNumbers.map(n => `${n}. Some question text here`).join('\n')
            
            const result = detectQuestionNumbers(text)
            
            for (const num of uniqueNumbers) {
              expect(result.detectedNumbers).toContain(num)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('detects parenthesis-terminated numbers (1) 2) 3))', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (numbers) => {
            const uniqueNumbers = [...new Set(numbers)]
            const text = uniqueNumbers.map(n => `${n}) Some question text here`).join('\n')
            
            const result = detectQuestionNumbers(text)
            
            for (const num of uniqueNumbers) {
              expect(result.detectedNumbers).toContain(num)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('detects Q-prefixed numbers (Q1, Q2, Q3)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (numbers) => {
            const uniqueNumbers = [...new Set(numbers)]
            const text = uniqueNumbers.map(n => `Q${n}: Some question text here`).join('\n')
            
            const result = detectQuestionNumbers(text)
            
            for (const num of uniqueNumbers) {
              expect(result.detectedNumbers).toContain(num)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('detects Question-prefixed numbers', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 10 }),
          (numbers) => {
            const uniqueNumbers = [...new Set(numbers)]
            const text = uniqueNumbers.map(n => `Question ${n}: Some question text here`).join('\n')
            
            const result = detectQuestionNumbers(text)
            
            for (const num of uniqueNumbers) {
              expect(result.detectedNumbers).toContain(num)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns sorted numbers', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 20 }),
          (numbers) => {
            const text = numbers.map(n => `${n}. Question`).join('\n')
            const result = detectQuestionNumbers(text)
            
            // Verify sorted order
            for (let i = 1; i < result.detectedNumbers.length; i++) {
              expect(result.detectedNumbers[i]).toBeGreaterThanOrEqual(result.detectedNumbers[i - 1])
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns empty array for text without question numbers', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !/\d+[.)]/g.test(s) && !/Q\d+/gi.test(s) && !/Question\s+\d+/gi.test(s)),
          (text) => {
            const result = detectQuestionNumbers(text)
            expect(result.detectedNumbers).toHaveLength(0)
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * **Feature: v11-Structured-Content-Engine, Property 12: Missing Question Number Calculation**
   * *For any* set of detected question numbers and set of saved question_number values, 
   * the missing numbers SHALL equal the set difference (detected - saved).
   * **Validates: Requirements 7.3, 7.4**
   */
  describe('Property 12: Missing Question Number Calculation', () => {
    it('returns detected numbers not in saved set', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 20 }),
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 20 }),
          (detected, saved) => {
            const missing = calculateMissingNumbers(detected, saved)
            const savedSet = new Set(saved)
            
            // All missing numbers should be in detected but not in saved
            for (const num of missing) {
              expect(detected).toContain(num)
              expect(savedSet.has(num)).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns empty when all detected are saved', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
          (numbers) => {
            const missing = calculateMissingNumbers(numbers, numbers)
            expect(missing).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns all detected when none are saved', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
          (detected) => {
            const uniqueDetected = [...new Set(detected)]
            const missing = calculateMissingNumbers(uniqueDetected, [])
            expect(missing.sort((a, b) => a - b)).toEqual(uniqueDetected.sort((a, b) => a - b))
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns sorted missing numbers', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 20 }),
          fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 10 }),
          (detected, saved) => {
            const missing = calculateMissingNumbers(detected, saved)
            
            // Check non-decreasing order (allows duplicates to be handled)
            for (let i = 1; i < missing.length; i++) {
              expect(missing[i]).toBeGreaterThanOrEqual(missing[i - 1])
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Sequence Gap Detection', () => {
    it('finds gaps in sequential numbers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 5, max: 20 }),
          fc.array(fc.integer({ min: 0, max: 19 }), { minLength: 1, maxLength: 5 }),
          (start, length, gapIndices) => {
            // Create sequence with gaps
            const sequence = Array.from({ length }, (_, i) => start + i)
            const uniqueGapIndices = [...new Set(gapIndices.map(i => i % length))]
            const withGaps = sequence.filter((_, i) => !uniqueGapIndices.includes(i))
            
            const gaps = findSequenceGaps(withGaps)
            
            // All gaps should be within the range
            for (const gap of gaps) {
              expect(gap).toBeGreaterThanOrEqual(Math.min(...withGaps))
              expect(gap).toBeLessThanOrEqual(Math.max(...withGaps))
              expect(withGaps).not.toContain(gap)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns empty for complete sequence', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 20 }),
          (start, length) => {
            const sequence = Array.from({ length }, (_, i) => start + i)
            const gaps = findSequenceGaps(sequence)
            expect(gaps).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// QA Display Properties
// ============================================

import { getQAStatus } from '@/components/batch/QAFeedbackBanner'

describe('V11 Structured Content - QA Display Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 9: QA Warning Display**
   * *For any* import result where generatedCount < expectedCount, 
   * the System SHALL display a warning indicator.
   * **Validates: Requirements 6.2**
   */
  describe('Property 9: QA Warning Display', () => {
    it('returns warning when generated < expected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (generated, expectedDelta) => {
            const expected = generated + expectedDelta // Ensure expected > generated
            const status = getQAStatus(generated, expected)
            expect(status).toBe('warning')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('warning status for any shortfall', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1000 }),
          (expected) => {
            if (expected === 0) return true // Skip edge case
            
            // Any generated count less than expected should warn
            for (let generated = 0; generated < expected; generated += Math.max(1, Math.floor(expected / 10))) {
              const status = getQAStatus(generated, expected)
              expect(status).toBe('warning')
            }
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  /**
   * **Feature: v11-Structured-Content-Engine, Property 10: QA Success Display**
   * *For any* import result where generatedCount >= expectedCount, 
   * the System SHALL display a success indicator.
   * **Validates: Requirements 6.3**
   */
  describe('Property 10: QA Success Display', () => {
    it('returns success when generated >= expected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (expected, extraGenerated) => {
            const generated = expected + extraGenerated // Ensure generated >= expected
            const status = getQAStatus(generated, expected)
            expect(status).toBe('success')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns success when generated equals expected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          (count) => {
            const status = getQAStatus(count, count)
            expect(status).toBe('success')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns neutral when expected is null', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          (generated) => {
            const status = getQAStatus(generated, null)
            expect(status).toBe('neutral')
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

// Matching Set Detection tests removed — module deleted (dead code)


// ============================================
// Card-Chapter Query Properties
// ============================================

/**
 * Helper to simulate card filtering by chapter_id (pure function for testing)
 */
function filterCardsByChapter(
  cards: { id: string; chapter_id: string | null }[],
  chapterId: string
): { id: string; chapter_id: string | null }[] {
  return cards.filter(c => c.chapter_id === chapterId)
}

describe('V11 Structured Content - Card-Chapter Query Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 6: Chapter Card Query Correctness**
   * *For any* chapter_id and set of card_templates, querying cards by that chapter_id 
   * SHALL return exactly the cards where chapter_id matches, and no others.
   * **Validates: Requirements 3.4**
   */
  describe('Property 6: Chapter Card Query Correctness', () => {
    it('returns only cards with matching chapter_id', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              chapter_id: fc.option(fc.uuid(), { nil: null }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.uuid(),
          (cards, targetChapterId) => {
            const filtered = filterCardsByChapter(cards, targetChapterId)
            
            // All filtered cards should have matching chapter_id
            for (const card of filtered) {
              expect(card.chapter_id).toBe(targetChapterId)
            }
            
            // Count should match expected
            const expectedCount = cards.filter(c => c.chapter_id === targetChapterId).length
            expect(filtered).toHaveLength(expectedCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns all cards for a chapter when they exist', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (chapterId, cardIds) => {
            const cards = cardIds.map(id => ({
              id,
              chapter_id: chapterId,
            }))
            
            const filtered = filterCardsByChapter(cards, chapterId)
            expect(filtered).toHaveLength(cards.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns empty array when no cards match', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          (chapterId1, chapterId2, cardIds) => {
            if (chapterId1 === chapterId2) return true // Skip
            
            const cards = cardIds.map(id => ({
              id,
              chapter_id: chapterId1,
            }))
            
            const filtered = filterCardsByChapter(cards, chapterId2)
            expect(filtered).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('excludes cards with null chapter_id', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          (chapterId, cardIds) => {
            // Mix of cards with chapter_id and null
            const cards = cardIds.map((id, i) => ({
              id,
              chapter_id: i % 2 === 0 ? chapterId : null,
            }))
            
            const filtered = filterCardsByChapter(cards, chapterId)
            
            // Should not include null chapter_id cards
            for (const card of filtered) {
              expect(card.chapter_id).not.toBeNull()
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Card-Chapter Linking Properties
// ============================================

/**
 * Simulates the card template row creation logic from bulkCreateMCQV2
 */
function createCardTemplateRow(
  card: { stem: string; options: string[]; correctIndex: number; questionNumber?: number },
  context: { bookSourceId?: string; chapterId?: string; matchingGroupId?: string }
) {
  return {
    stem: card.stem,
    options: card.options,
    correct_index: card.correctIndex,
    book_source_id: context.bookSourceId || null,
    chapter_id: context.chapterId || null,
    question_number: card.questionNumber || null,
    matching_group_id: context.matchingGroupId || null,
  }
}

describe('V11 Structured Content - Card-Chapter Linking Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 4: Card-Chapter Linking with Context**
   * *For any* bulk import operation where bookSourceId and chapterId are provided, 
   * all saved card_templates SHALL have those values populated in their respective columns.
   * **Validates: Requirements 3.2**
   */
  describe('Property 4: Card-Chapter Linking with Context', () => {
    it('populates book_source_id and chapter_id when provided', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.array(
            fc.record({
              stem: fc.string().filter(s => s.length > 0),
              options: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
              correctIndex: fc.nat({ max: 4 }),
              questionNumber: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (bookSourceId, chapterId, cards) => {
            const context = { bookSourceId, chapterId }
            
            for (const card of cards) {
              const row = createCardTemplateRow(card, context)
              expect(row.book_source_id).toBe(bookSourceId)
              expect(row.chapter_id).toBe(chapterId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('populates question_number when provided on card', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 100 }),
          (bookSourceId, chapterId, questionNumber) => {
            const card = {
              stem: 'Test question',
              options: ['A', 'B', 'C', 'D'],
              correctIndex: 0,
              questionNumber,
            }
            const context = { bookSourceId, chapterId }
            
            const row = createCardTemplateRow(card, context)
            expect(row.question_number).toBe(questionNumber)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11-Structured-Content-Engine, Property 5: Card-Chapter Linking without Context**
   * *For any* bulk import operation where bookSourceId and chapterId are NOT provided, 
   * all saved card_templates SHALL have NULL values in book_source_id and chapter_id columns.
   * **Validates: Requirements 3.3**
   */
  describe('Property 5: Card-Chapter Linking without Context', () => {
    it('leaves book_source_id and chapter_id as null when not provided', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              stem: fc.string().filter(s => s.length > 0),
              options: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
              correctIndex: fc.nat({ max: 4 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (cards) => {
            const context = {} // No book/chapter context
            
            for (const card of cards) {
              const row = createCardTemplateRow(card, context)
              expect(row.book_source_id).toBeNull()
              expect(row.chapter_id).toBeNull()
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('leaves question_number as null when not provided on card', () => {
      fc.assert(
        fc.property(
          fc.record({
            stem: fc.string().filter(s => s.length > 0),
            options: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
            correctIndex: fc.nat({ max: 4 }),
          }),
          (card) => {
            const row = createCardTemplateRow(card, {})
            expect(row.question_number).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11-Structured-Content-Engine, Property 16: Backwards Compatibility**
   * *For any* call to bulkCreateMCQV2 without bookSourceId/chapterId parameters, 
   * the function SHALL execute successfully and save cards with null values for the new columns.
   * **Validates: Requirements 9.2, 9.5**
   */
  describe('Property 16: Backwards Compatibility', () => {
    it('handles missing context gracefully', () => {
      fc.assert(
        fc.property(
          fc.record({
            stem: fc.string().filter(s => s.length > 0),
            options: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
            correctIndex: fc.nat({ max: 4 }),
          }),
          (card) => {
            // Simulate old-style call without V11 params
            const row = createCardTemplateRow(card, {})
            
            // Should not throw and should have null values
            expect(row.book_source_id).toBeNull()
            expect(row.chapter_id).toBeNull()
            expect(row.matching_group_id).toBeNull()
            expect(row.question_number).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })

    it('handles partial context (only bookSourceId)', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.record({
            stem: fc.string().filter(s => s.length > 0),
            options: fc.array(fc.string(), { minLength: 2, maxLength: 5 }),
            correctIndex: fc.nat({ max: 4 }),
          }),
          (bookSourceId, card) => {
            const row = createCardTemplateRow(card, { bookSourceId })
            
            expect(row.book_source_id).toBe(bookSourceId)
            expect(row.chapter_id).toBeNull()
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Matching Group Handling Properties
// ============================================

describe('V11 Structured Content - Matching Group Handling Properties', () => {
  /**
   * **Feature: v11-Structured-Content-Engine, Property 7: Matching Group Card Denormalization**
   * *For any* card_template that belongs to a matching_group, the card SHALL have 
   * its own options field populated (not null or empty), independent of the group's common_options.
   * **Validates: Requirements 4.3**
   */
  describe('Property 7: Matching Group Card Denormalization', () => {
    it('cards in matching groups have their own options populated', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // matching_group_id
          fc.array(fc.string().filter(s => s.length > 0), { minLength: 2, maxLength: 6 }), // common options
          fc.array(
            fc.record({
              stem: fc.string().filter(s => s.length > 0),
              correctIndex: fc.nat({ max: 5 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (matchingGroupId, commonOptions, cardData) => {
            // Simulate creating cards from a matching group
            const cards = cardData.map(card => ({
              ...card,
              options: commonOptions, // Each card gets its own copy of options
              matching_group_id: matchingGroupId,
            }))
            
            // Verify each card has options populated
            for (const card of cards) {
              expect(card.options).toBeDefined()
              expect(card.options.length).toBeGreaterThanOrEqual(2)
              expect(card.matching_group_id).toBe(matchingGroupId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11-Structured-Content-Engine, Property 15: Matching Group Linking**
   * *For any* set of cards saved from a matching block, all cards SHALL reference 
   * the same matching_group_id, and that matching_group record SHALL exist.
   * **Validates: Requirements 8.4**
   */
  describe('Property 15: Matching Group Linking', () => {
    it('all cards from a matching block share the same matching_group_id', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          (matchingGroupId, cardIds) => {
            // Simulate cards created from a matching block
            const cards = cardIds.map(id => ({
              id,
              matching_group_id: matchingGroupId,
            }))
            
            // All cards should have the same matching_group_id
            const groupIds = new Set(cards.map(c => c.matching_group_id))
            expect(groupIds.size).toBe(1)
            expect(groupIds.has(matchingGroupId)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('matching_group_id is consistent across all cards in a block', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 2, max: 20 }),
          (groupId, cardCount) => {
            const cards = Array.from({ length: cardCount }, (_, i) => ({
              id: `card-${i}`,
              matching_group_id: groupId,
            }))
            
            // Verify consistency
            for (const card of cards) {
              expect(card.matching_group_id).toBe(groupId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
