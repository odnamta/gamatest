/**
 * Property-Based Tests for Text Selection Transfer
 * Feature: v3-ux-overhaul, Property 6: Text selection transfer
 * Validates: Requirements 5.2
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { transferSelectedText } from '@/components/cards/TextToStemButton'

describe('transferSelectedText', () => {
  /**
   * Property 6: Text selection transfer
   * For any non-empty text selection in the PDF text area, clicking the copy button
   * SHALL result in the Question Stem field containing exactly that selected text.
   */
  it('should transfer exactly the selected text for any valid selection', () => {
    fc.assert(
      fc.property(
        // Generate source text
        fc.string({ minLength: 1, maxLength: 1000 }),
        // Generate selection indices
        fc.nat({ max: 999 }),
        fc.nat({ max: 999 }),
        (sourceText, start, end) => {
          // Ensure valid selection range
          const actualStart = Math.min(start, end, sourceText.length)
          const actualEnd = Math.min(Math.max(start, end), sourceText.length)
          
          if (actualStart >= actualEnd) {
            // Empty selection - should return empty string
            const result = transferSelectedText(sourceText, actualStart, actualEnd)
            expect(result).toBe('')
          } else {
            // Valid selection - should return exact substring
            const result = transferSelectedText(sourceText, actualStart, actualEnd)
            const expected = sourceText.substring(actualStart, actualEnd)
            expect(result).toBe(expected)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return empty string for empty selection (start === end)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.nat({ max: 99 }),
        (sourceText, position) => {
          const pos = Math.min(position, sourceText.length)
          const result = transferSelectedText(sourceText, pos, pos)
          expect(result).toBe('')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return empty string for reversed selection (start > end)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 100 }),
        fc.nat({ max: 98 }),
        fc.nat({ max: 98 }),
        (sourceText, a, b) => {
          const start = Math.max(a, b) + 1
          const end = Math.min(a, b)
          const result = transferSelectedText(sourceText, start, end)
          expect(result).toBe('')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle selection at start of text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.integer({ min: 1, max: 5 }),
        (sourceText, length) => {
          const result = transferSelectedText(sourceText, 0, length)
          expect(result).toBe(sourceText.substring(0, length))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle selection at end of text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.integer({ min: 1, max: 5 }),
        (sourceText, offset) => {
          const start = Math.max(0, sourceText.length - offset)
          const result = transferSelectedText(sourceText, start, sourceText.length)
          expect(result).toBe(sourceText.substring(start))
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle full text selection', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (sourceText) => {
          const result = transferSelectedText(sourceText, 0, sourceText.length)
          expect(result).toBe(sourceText)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle negative indices gracefully', () => {
    const result = transferSelectedText('hello world', -1, 5)
    expect(result).toBe('')
  })

  it('should handle end index beyond text length', () => {
    const result = transferSelectedText('hello', 2, 100)
    expect(result).toBe('llo')
  })
})
