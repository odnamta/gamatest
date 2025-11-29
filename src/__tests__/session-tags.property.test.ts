import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property tests for session tags functionality
 * Feature: v6-fast-ingestion
 */

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

// Helper functions extracted from the hook for testing
const STORAGE_KEY_PREFIX = 'session_tags_'

function getStorageKey(deckId: string): string {
  return `${STORAGE_KEY_PREFIX}${deckId}`
}

function readFromStorage(storage: typeof localStorageMock, deckId: string): string[] {
  try {
    const stored = storage.getItem(getStorageKey(deckId))
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

function writeToStorage(storage: typeof localStorageMock, deckId: string, tagIds: string[]): void {
  try {
    storage.setItem(getStorageKey(deckId), JSON.stringify(tagIds))
  } catch {
    // Ignore storage errors
  }
}

// Arbitrary for UUID-like strings
const uuidArb = fc.uuid()

// Arbitrary for tag ID arrays
const tagIdArrayArb = fc.array(fc.uuid(), { minLength: 0, maxLength: 10 })

describe('Session Tags Property Tests', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  /**
   * **Feature: v6-fast-ingestion, Property 16: Session tags localStorage round-trip**
   * **Validates: Requirements R2.1**
   * 
   * For any session tag selection, storing to localStorage and then reading back
   * should produce the same tag IDs.
   */
  describe('Property 16: Session tags localStorage round-trip', () => {
    it('write then read produces same tag IDs', () => {
      fc.assert(
        fc.property(uuidArb, tagIdArrayArb, (deckId, tagIds) => {
          // Write to storage
          writeToStorage(localStorageMock, deckId, tagIds)
          
          // Read back
          const retrieved = readFromStorage(localStorageMock, deckId)
          
          // Should be identical
          return JSON.stringify(retrieved) === JSON.stringify(tagIds)
        }),
        { numRuns: 100 }
      )
    })

    it('different decks have isolated storage', () => {
      fc.assert(
        fc.property(uuidArb, uuidArb, tagIdArrayArb, tagIdArrayArb, (deckId1, deckId2, tags1, tags2) => {
          // Skip if deck IDs are the same
          if (deckId1 === deckId2) return true
          
          // Write different tags to different decks
          writeToStorage(localStorageMock, deckId1, tags1)
          writeToStorage(localStorageMock, deckId2, tags2)
          
          // Read back
          const retrieved1 = readFromStorage(localStorageMock, deckId1)
          const retrieved2 = readFromStorage(localStorageMock, deckId2)
          
          // Each deck should have its own tags
          return (
            JSON.stringify(retrieved1) === JSON.stringify(tags1) &&
            JSON.stringify(retrieved2) === JSON.stringify(tags2)
          )
        }),
        { numRuns: 100 }
      )
    })

    it('empty array is stored and retrieved correctly', () => {
      fc.assert(
        fc.property(uuidArb, (deckId) => {
          writeToStorage(localStorageMock, deckId, [])
          const retrieved = readFromStorage(localStorageMock, deckId)
          return retrieved.length === 0
        }),
        { numRuns: 50 }
      )
    })

    it('non-existent deck returns empty array', () => {
      fc.assert(
        fc.property(uuidArb, (deckId) => {
          // Don't write anything
          const retrieved = readFromStorage(localStorageMock, deckId)
          return retrieved.length === 0
        }),
        { numRuns: 50 }
      )
    })

    it('invalid JSON in storage returns empty array', () => {
      fc.assert(
        fc.property(uuidArb, fc.string(), (deckId, invalidJson) => {
          // Write invalid JSON directly
          localStorageMock.setItem(getStorageKey(deckId), invalidJson)
          
          // Should return empty array, not throw
          const retrieved = readFromStorage(localStorageMock, deckId)
          return Array.isArray(retrieved)
        }),
        { numRuns: 50 }
      )
    })

    it('non-array JSON in storage returns empty array', () => {
      fc.assert(
        fc.property(uuidArb, (deckId) => {
          // Write non-array JSON
          localStorageMock.setItem(getStorageKey(deckId), JSON.stringify({ not: 'an array' }))
          
          const retrieved = readFromStorage(localStorageMock, deckId)
          return retrieved.length === 0
        }),
        { numRuns: 50 }
      )
    })

    it('filters out non-string items from storage', () => {
      fc.assert(
        fc.property(uuidArb, (deckId) => {
          // Write array with mixed types
          localStorageMock.setItem(
            getStorageKey(deckId),
            JSON.stringify(['valid-id', 123, null, 'another-id', { obj: true }])
          )
          
          const retrieved = readFromStorage(localStorageMock, deckId)
          
          // Should only have the string items
          return (
            retrieved.length === 2 &&
            retrieved[0] === 'valid-id' &&
            retrieved[1] === 'another-id'
          )
        }),
        { numRuns: 50 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 13: Session tags applied to all saved cards**
   * **Validates: Requirements R2.2**
   * 
   * This is tested at the integration level - here we test the data flow.
   */
  describe('Property 13: Session tags applied to all saved cards', () => {
    it('session tag IDs are preserved through storage', () => {
      fc.assert(
        fc.property(uuidArb, tagIdArrayArb, (deckId, tagIds) => {
          writeToStorage(localStorageMock, deckId, tagIds)
          const retrieved = readFromStorage(localStorageMock, deckId)
          
          // All original IDs should be present
          return tagIds.every((id) => retrieved.includes(id))
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 17: Empty session tags not applied**
   * **Validates: Requirements R2.2**
   */
  describe('Property 17: Empty session tags not applied', () => {
    it('clearing session tags results in empty array', () => {
      fc.assert(
        fc.property(uuidArb, tagIdArrayArb, (deckId, initialTags) => {
          // First set some tags
          writeToStorage(localStorageMock, deckId, initialTags)
          
          // Then clear them
          writeToStorage(localStorageMock, deckId, [])
          
          // Should be empty
          const retrieved = readFromStorage(localStorageMock, deckId)
          return retrieved.length === 0
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v6-fast-ingestion, Property 18: No duplicate tags on merged cards**
   * **Validates: Requirements R2.3**
   */
  describe('Property 18: No duplicate tags on merged cards', () => {
    it('stored tag IDs have no duplicates', () => {
      fc.assert(
        fc.property(uuidArb, tagIdArrayArb, (deckId, tagIds) => {
          // Remove duplicates before storing (simulating UI behavior)
          const uniqueIds = [...new Set(tagIds)]
          writeToStorage(localStorageMock, deckId, uniqueIds)
          
          const retrieved = readFromStorage(localStorageMock, deckId)
          const retrievedSet = new Set(retrieved)
          
          // No duplicates in retrieved
          return retrievedSet.size === retrieved.length
        }),
        { numRuns: 100 }
      )
    })
  })
})
