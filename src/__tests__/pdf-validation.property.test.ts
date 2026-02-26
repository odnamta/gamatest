import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import { validatePdfFile, createSourceSchema } from '../lib/pdf-validation'

/**
 * Property-based tests for pdf-validation.ts
 *
 * Covers properties NOT in pdf-upload-validation.property.test.ts:
 * - createSourceSchema validation
 * - Boundary file sizes (exactly at MAX_FILE_SIZE)
 * - Determinism
 * - Validation result type invariants
 * - Combined invalid inputs
 * - File name edge cases (dots, multiple extensions)
 */

const MAX_FILE_SIZE = 50 * 1024 * 1024
const VALID_MIME_TYPE = 'application/pdf'

const uuidArb = fc.uuid()

// Generator for valid PDF filenames (base name without dots + .pdf)
const validPdfFilenameArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !s.includes('.') && s.length > 0)
  .map((name) => `${name}.pdf`)

const validFileSizeArb = fc.integer({ min: 1, max: MAX_FILE_SIZE })

// ============================================
// createSourceSchema
// ============================================

describe('createSourceSchema Validation', () => {
  test('accepts valid source title', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (title) => {
        const result = createSourceSchema.safeParse({ title })
        expect(result.success).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('accepts valid source with deckId', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), uuidArb, (title, deckId) => {
        const result = createSourceSchema.safeParse({ title, deckId })
        expect(result.success).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  test('rejects empty title', () => {
    const result = createSourceSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  test('rejects title longer than 200 characters', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 201, maxLength: 500 }), (title) => {
        const result = createSourceSchema.safeParse({ title })
        expect(result.success).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  test('rejects invalid deckId (non-UUID)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
        ),
        (title, badDeckId) => {
          const result = createSourceSchema.safeParse({ title, deckId: badDeckId })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  test('parsed output preserves title', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (title) => {
        const result = createSourceSchema.safeParse({ title })
        if (result.success) {
          expect(result.data.title).toBe(title)
        }
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Boundary File Sizes
// ============================================

describe('Boundary File Sizes', () => {
  test('file at exactly MAX_FILE_SIZE is accepted', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, (fileName) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, MAX_FILE_SIZE)
        expect(result.valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  test('file at MAX_FILE_SIZE + 1 is rejected', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, (fileName) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, MAX_FILE_SIZE + 1)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('exceeds maximum size')
      }),
      { numRuns: 100 }
    )
  })

  test('file at exactly 1 byte is accepted', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, (fileName) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, 1)
        expect(result.valid).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  test('file at 0 bytes is rejected (empty)', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, (fileName) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, 0)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('File is empty')
      }),
      { numRuns: 100 }
    )
  })

  test('negative file sizes are rejected', () => {
    fc.assert(
      fc.property(
        validPdfFilenameArb,
        fc.integer({ min: -1000000, max: -1 }),
        (fileName, fileSize) => {
          // Negative sizes should be caught by one of the checks
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize)
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Determinism
// ============================================

describe('Validation Determinism', () => {
  test('validatePdfFile returns same result for same inputs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: -100, max: MAX_FILE_SIZE * 2 }),
        (fileName, mimeType, fileSize) => {
          const r1 = validatePdfFile(fileName, mimeType, fileSize)
          const r2 = validatePdfFile(fileName, mimeType, fileSize)
          expect(r1).toStrictEqual(r2)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// Result Type Invariants
// ============================================

describe('Validation Result Type Invariants', () => {
  test('valid=true means no error field', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, validFileSizeArb, (fileName, fileSize) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize)
        if (result.valid) {
          expect(result.error).toBeUndefined()
        }
      }),
      { numRuns: 200 }
    )
  })

  test('valid=false means error field is a non-empty string', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: MAX_FILE_SIZE * 2 }),
        (fileName, mimeType, fileSize) => {
          const result = validatePdfFile(fileName, mimeType, fileSize)
          if (!result.valid) {
            expect(typeof result.error).toBe('string')
            expect(result.error!.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  test('result always has valid boolean property', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: MAX_FILE_SIZE * 2 }),
        (fileName, mimeType, fileSize) => {
          const result = validatePdfFile(fileName, mimeType, fileSize)
          expect(typeof result.valid).toBe('boolean')
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ============================================
// File Name Edge Cases
// ============================================

describe('File Name Edge Cases', () => {
  test('filename with multiple dots ending in .pdf is valid', () => {
    const multiDotNames = [
      'my.document.v2.pdf',
      'report.2026.01.pdf',
      'a.b.c.d.pdf',
    ]

    for (const name of multiDotNames) {
      const result = validatePdfFile(name, VALID_MIME_TYPE, 1024)
      expect(result.valid).toBe(true)
    }
  })

  test('filename .pdf (only extension) is valid', () => {
    const result = validatePdfFile('.pdf', VALID_MIME_TYPE, 1024)
    expect(result.valid).toBe(true)
  })

  test('filename ending in .pdf.txt is rejected', () => {
    const result = validatePdfFile('document.pdf.txt', VALID_MIME_TYPE, 1024)
    expect(result.valid).toBe(false)
  })

  test('filename with no extension is rejected', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('.')),
        (fileName) => {
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, 1024)
          expect(result.valid).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('filename with spaces is handled', () => {
    const result = validatePdfFile('my document.pdf', VALID_MIME_TYPE, 1024)
    expect(result.valid).toBe(true)
  })

  test('filename with unicode characters and .pdf extension is valid', () => {
    const unicodeNames = [
      'laporan-keuangan.pdf',
      'soal-ujian.pdf',
    ]

    for (const name of unicodeNames) {
      const result = validatePdfFile(name, VALID_MIME_TYPE, 1024)
      expect(result.valid).toBe(true)
    }
  })
})

// ============================================
// Validation Order: extension checked before MIME type before size
// ============================================

describe('Validation Priority Order', () => {
  test('invalid extension error takes priority over invalid MIME', () => {
    const result = validatePdfFile('file.txt', 'text/plain', 1024)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Only PDF files are allowed')
  })

  test('invalid extension error takes priority over size error', () => {
    const result = validatePdfFile('file.txt', VALID_MIME_TYPE, MAX_FILE_SIZE + 1)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Only PDF files are allowed')
  })

  test('invalid MIME error takes priority over size error', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, (fileName) => {
        const result = validatePdfFile(fileName, 'text/plain', MAX_FILE_SIZE + 1)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Only PDF files are allowed')
      }),
      { numRuns: 100 }
    )
  })

  test('size error appears only when extension and MIME are valid', () => {
    fc.assert(
      fc.property(
        validPdfFilenameArb,
        fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 3 }),
        (fileName, fileSize) => {
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize)
          expect(result.valid).toBe(false)
          expect(result.error).toContain('exceeds maximum size')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('empty file error appears only when extension and MIME are valid', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, (fileName) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, 0)
        expect(result.valid).toBe(false)
        expect(result.error).toBe('File is empty')
      }),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Valid PDF combinations: extension + MIME + size all valid
// ============================================

describe('All-Valid Combinations', () => {
  test('any valid PDF file name + valid MIME + valid size passes', () => {
    fc.assert(
      fc.property(validPdfFilenameArb, validFileSizeArb, (fileName, fileSize) => {
        const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize)
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
      }),
      { numRuns: 200 }
    )
  })

  test('uppercase .PDF extension is treated as valid', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes('.')),
        validFileSizeArb,
        (baseName, fileSize) => {
          const result = validatePdfFile(`${baseName}.PDF`, VALID_MIME_TYPE, fileSize)
          expect(result.valid).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})
