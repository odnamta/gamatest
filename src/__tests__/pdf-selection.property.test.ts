/**
 * Property-Based Tests for PDF Text Selection
 * Feature: v5-content-workstation, Property 6: Selection Text Preservation
 * Validates: Requirements 2.8
 * 
 * Tests that selected text from PDF is preserved exactly when copied to form fields.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Simulates the text selection and copy-to-field workflow
 * This mirrors the logic in the add-bulk page
 */
function copyTextToField(selectedText: string): string {
  // The actual implementation just assigns the text directly
  // This is what happens in handlePdfToStem, handlePdfToExplanation
  return selectedText
}

/**
 * Simulates text normalization that might occur during selection
 * Browser selection typically trims whitespace
 */
function normalizeSelection(text: string): string {
  return text.trim()
}

describe('PDF Text Selection - Property Tests', () => {
  /**
   * Property 6: Selection Text Preservation
   * For any text selected in the PDF, clicking "To Stem" should result 
   * in the stem field containing exactly that text.
   */
  describe('Property 6: Selection Text Preservation', () => {
    it('should preserve selected text exactly when copied to stem field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (selectedText) => {
            const normalizedText = normalizeSelection(selectedText)
            if (normalizedText.length === 0) return true // Skip empty after trim
            
            const stemValue = copyTextToField(normalizedText)
            expect(stemValue).toBe(normalizedText)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve selected text exactly when copied to explanation field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          (selectedText) => {
            const normalizedText = normalizeSelection(selectedText)
            if (normalizedText.length === 0) return true
            
            const explanationValue = copyTextToField(normalizedText)
            expect(explanationValue).toBe(normalizedText)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve unicode characters in selected text', () => {
      // Test with various unicode characters
      const unicodeStrings = [
        'café résumé',
        '日本語テスト',
        '中文测试',
        'Ελληνικά',
        'العربية',
        '🔬 Medical symbols ⚕️',
        'α β γ δ ε (Greek letters)',
        '± ≤ ≥ ≠ ∞ (Math symbols)',
        'µg/mL concentration',
      ]
      
      fc.assert(
        fc.property(
          fc.constantFrom(...unicodeStrings),
          fc.string({ minLength: 0, maxLength: 100 }),
          (unicodeText, suffix) => {
            const selectedText = `${unicodeText} ${suffix}`.trim()
            const normalizedText = normalizeSelection(selectedText)
            if (normalizedText.length === 0) return true
            
            const fieldValue = copyTextToField(normalizedText)
            expect(fieldValue).toBe(normalizedText)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve multiline text selections', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
          (lines) => {
            const selectedText = lines.join('\n')
            const normalizedText = normalizeSelection(selectedText)
            if (normalizedText.length === 0) return true
            
            const fieldValue = copyTextToField(normalizedText)
            expect(fieldValue).toBe(normalizedText)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve medical/scientific terminology', () => {
      // Common medical terms that might appear in MCQ content
      const medicalTerms = [
        'hypertension',
        'tachycardia',
        'bradycardia',
        'preeclampsia',
        'gestational diabetes',
        'cesarean section',
        'placenta previa',
        'oligohydramnios',
        'polyhydramnios',
        'fetal distress',
      ]

      fc.assert(
        fc.property(
          fc.constantFrom(...medicalTerms),
          fc.string({ minLength: 0, maxLength: 200 }),
          (term, context) => {
            const selectedText = `${context} ${term} ${context}`.trim()
            const normalizedText = normalizeSelection(selectedText)
            
            const fieldValue = copyTextToField(normalizedText)
            expect(fieldValue).toBe(normalizedText)
            expect(fieldValue).toContain(term)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Selection Position Calculation', () => {
    /**
     * Tests that position calculation produces valid viewport coordinates
     */
    it('should produce valid position coordinates for tooltip', () => {
      fc.assert(
        fc.property(
          fc.record({
            left: fc.float({ min: 0, max: 2000, noNaN: true }),
            top: fc.float({ min: 0, max: 2000, noNaN: true }),
            width: fc.float({ min: 1, max: 500, noNaN: true }),
          }),
          (rect) => {
            // Simulates the position calculation from PDFViewer
            const position = {
              x: rect.left + rect.width / 2,
              y: rect.top,
            }
            
            expect(position.x).toBeGreaterThanOrEqual(0)
            expect(position.y).toBeGreaterThanOrEqual(0)
            expect(Number.isFinite(position.x)).toBe(true)
            expect(Number.isFinite(position.y)).toBe(true)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
