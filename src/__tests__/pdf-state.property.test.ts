/**
 * Property-Based Tests for PDF State Persistence
 * Feature: v5-content-workstation, Property 5: PDF Page Persistence Round-Trip
 * Validates: Requirements 3.1, 3.2
 * 
 * Tests that PDF page state is correctly saved and restored from localStorage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { savePdfPage, getPdfPage, clearPdfPage, clearAllPdfPages } from '@/lib/pdf-state'

// Mock localStorage for testing
const createMockLocalStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    // Helper to get all keys for testing
    keys: () => Object.keys(store),
  }
}

describe('PDF State Persistence - Property Tests', () => {
  let mockStorage: ReturnType<typeof createMockLocalStorage>
  let originalLocalStorage: Storage

  beforeEach(() => {
    mockStorage = createMockLocalStorage()
    originalLocalStorage = global.localStorage
    // @ts-expect-error - mocking localStorage
    global.localStorage = mockStorage
    // Also need to mock Object.keys for clearAllPdfPages
    vi.spyOn(Object, 'keys').mockImplementation((obj) => {
      if (obj === mockStorage) {
        return mockStorage.keys()
      }
      return Object.getOwnPropertyNames(obj)
    })
  })

  afterEach(() => {
    global.localStorage = originalLocalStorage
    vi.restoreAllMocks()
  })

  /**
   * Property 5: PDF Page Persistence Round-Trip
   * For any PDF file and page number, saving to localStorage and then 
   * restoring should return the same page number.
   */
  describe('Property 5: PDF Page Persistence Round-Trip', () => {
    it('should round-trip any valid page number', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          (fileId, pageNumber) => {
            savePdfPage(fileId, pageNumber)
            const restored = getPdfPage(fileId)
            expect(restored).toBe(pageNumber)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle multiple PDFs independently', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              fileId: fc.uuid(),
              page: fc.integer({ min: 1, max: 1000 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          (pdfs) => {
            // Save all pages
            for (const pdf of pdfs) {
              savePdfPage(pdf.fileId, pdf.page)
            }
            
            // Verify each can be retrieved independently
            for (const pdf of pdfs) {
              const restored = getPdfPage(pdf.fileId)
              expect(restored).toBe(pdf.page)
            }
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should return 1 for unknown file IDs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (fileId) => {
            // Don't save anything, just try to get
            const page = getPdfPage(fileId)
            expect(page).toBe(1)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle clearing specific PDF state', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 1000 }),
          (fileId, pageNumber) => {
            savePdfPage(fileId, pageNumber)
            expect(getPdfPage(fileId)).toBe(pageNumber)
            
            clearPdfPage(fileId)
            expect(getPdfPage(fileId)).toBe(1) // Default after clear
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve other PDFs when clearing one', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          (fileId1, fileId2, page1, page2) => {
            // Skip if same ID generated
            if (fileId1 === fileId2) return true
            
            savePdfPage(fileId1, page1)
            savePdfPage(fileId2, page2)
            
            clearPdfPage(fileId1)
            
            expect(getPdfPage(fileId1)).toBe(1) // Cleared
            expect(getPdfPage(fileId2)).toBe(page2) // Preserved
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle page 1 correctly (boundary)', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (fileId) => {
            savePdfPage(fileId, 1)
            const restored = getPdfPage(fileId)
            expect(restored).toBe(1)
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should handle very large page numbers', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1000, max: 100000 }),
          (fileId, pageNumber) => {
            savePdfPage(fileId, pageNumber)
            const restored = getPdfPage(fileId)
            expect(restored).toBe(pageNumber)
            return true
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should handle file IDs with special characters', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
          fc.integer({ min: 1, max: 1000 }),
          (fileId, pageNumber) => {
            savePdfPage(fileId, pageNumber)
            const restored = getPdfPage(fileId)
            expect(restored).toBe(pageNumber)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should overwrite previous page when saving new page', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 500 }),
          fc.integer({ min: 501, max: 1000 }),
          (fileId, page1, page2) => {
            savePdfPage(fileId, page1)
            expect(getPdfPage(fileId)).toBe(page1)
            
            savePdfPage(fileId, page2)
            expect(getPdfPage(fileId)).toBe(page2)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
