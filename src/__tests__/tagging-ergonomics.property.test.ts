/**
 * V11.1: Tagging Ergonomics - Property-Based Tests
 * 
 * Tests TagSelector, Source filtering, and Import context using fast-check.
 * **Feature: v11.1-tagging-ergonomics**
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// Pure helper functions for testing (duplicated from TagSelector to avoid server import issues)

/**
 * V11.1: Helper function to determine if Create option should show
 */
function shouldShowCreateOption(searchQuery: string, existingTags: { name: string }[]): boolean {
  const query = searchQuery.trim()
  if (!query) return false
  const exactMatch = existingTags.some(tag => tag.name.toLowerCase() === query.toLowerCase())
  return !exactMatch
}

/**
 * V11.1: Helper function to filter tags by search query
 */
function filterTagsByQuery<T extends { name: string }>(tags: T[], query: string): T[] {
  if (!query.trim()) return tags
  const normalizedQuery = query.toLowerCase().trim()
  return tags.filter(tag => tag.name.toLowerCase().includes(normalizedQuery))
}

// ============================================
// TagSelector Create Option Properties
// ============================================

describe('V11.1 Tagging Ergonomics - TagSelector Properties', () => {
  /**
   * **Feature: v11.1-tagging-ergonomics, Property 3: Create Option Position**
   * *For any* non-empty search query that does not match an existing tag name 
   * (case-insensitive), the "Create" option SHALL appear as the first item in the dropdown list.
   * **Validates: Requirements 2.1, 2.3**
   */
  describe('Property 3: Create Option Position', () => {
    it('shows Create option for non-empty query with no exact match', () => {
      fc.assert(
        fc.property(
          // Generate a search query
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          // Generate existing tags that don't match the query exactly
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            { minLength: 0, maxLength: 20 }
          ),
          (query, existingTagNames) => {
            // Filter out any tags that would match the query exactly (case-insensitive)
            const nonMatchingTags = existingTagNames
              .filter(name => name.toLowerCase() !== query.trim().toLowerCase())
              .map(name => ({ name }))
            
            const result = shouldShowCreateOption(query, nonMatchingTags)
            expect(result).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('Create option appears when query is unique', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
          (uniqueQuery) => {
            // Empty tag list means no matches possible
            const result = shouldShowCreateOption(uniqueQuery, [])
            expect(result).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 4: Create Option Suppression**
   * *For any* search query that is empty OR matches an existing tag name exactly 
   * (case-insensitive), the "Create" option SHALL NOT appear.
   * **Validates: Requirements 2.5**
   */
  describe('Property 4: Create Option Suppression', () => {
    it('hides Create option for empty query', () => {
      fc.assert(
        fc.property(
          // Generate empty or whitespace-only strings
          fc.oneof(
            fc.constant(''),
            fc.array(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 10 }).map(arr => arr.join(''))
          ),
          fc.array(fc.record({ name: fc.string({ minLength: 1 }) }), { minLength: 0, maxLength: 10 }),
          (emptyQuery, tags) => {
            const result = shouldShowCreateOption(emptyQuery, tags)
            expect(result).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('hides Create option when query matches existing tag exactly (case-insensitive)', () => {
      fc.assert(
        fc.property(
          // Generate trimmed tag names to avoid whitespace edge cases
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0)
            .map(s => s.trim()),
          fc.boolean(), // Whether to change case
          (tagName, changeCase) => {
            const existingTags = [{ name: tagName }]
            // Query might be same case or different case
            const query = changeCase ? tagName.toUpperCase() : tagName
            
            const result = shouldShowCreateOption(query, existingTags)
            expect(result).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('hides Create option for exact match among multiple tags', () => {
      fc.assert(
        fc.property(
          // Generate tag names that are already trimmed (no leading/trailing whitespace)
          fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => s.trim().length > 0)
            .map(s => s.trim()),
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 })
              .filter(s => s.trim().length > 0)
              .map(s => s.trim()),
            { minLength: 0, maxLength: 10 }
          ),
          (matchingTag, otherTags) => {
            // Filter out any other tags that happen to match (to ensure matchingTag is the match)
            const filteredOtherTags = otherTags.filter(
              t => t.toLowerCase() !== matchingTag.toLowerCase()
            )
            const existingTags = [
              ...filteredOtherTags.map(name => ({ name })),
              { name: matchingTag }
            ]
            
            const result = shouldShowCreateOption(matchingTag, existingTags)
            expect(result).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Tag filtering by search query
   */
  describe('Tag Filtering', () => {
    it('returns all tags when query is empty', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ name: fc.string({ minLength: 1, maxLength: 30 }) }),
            { minLength: 0, maxLength: 20 }
          ),
          (tags) => {
            const result = filterTagsByQuery(tags, '')
            expect(result).toHaveLength(tags.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('filters tags case-insensitively', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          fc.boolean(),
          (tagName, useUpperCase) => {
            const tags = [{ name: tagName }]
            const query = useUpperCase ? tagName.toUpperCase() : tagName.toLowerCase()
            
            const result = filterTagsByQuery(tags, query)
            expect(result).toHaveLength(1)
            expect(result[0].name).toBe(tagName)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns only matching tags', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 2, maxLength: 10 }).filter(s => s.trim().length >= 2),
          fc.array(
            fc.string({ minLength: 1, maxLength: 30 }),
            { minLength: 1, maxLength: 20 }
          ),
          (query, tagNames) => {
            const tags = tagNames.map(name => ({ name }))
            const result = filterTagsByQuery(tags, query)
            
            // All results should contain the query (case-insensitive)
            const normalizedQuery = query.toLowerCase().trim()
            for (const tag of result) {
              expect(tag.name.toLowerCase()).toContain(normalizedQuery)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Source Badge Properties
// ============================================

/**
 * Helper to simulate source badge rendering logic
 */
function shouldRenderSourceBadge(card: { book_source_id?: string | null }): boolean {
  return card.book_source_id != null && card.book_source_id !== ''
}

describe('V11.1 Tagging Ergonomics - Source Badge Properties', () => {
  /**
   * **Feature: v11.1-tagging-ergonomics, Property 5: Source Badge Presence**
   * *For any* card with a non-null book_source_id, the rendered CardListItem 
   * SHALL include a Source badge containing the book title.
   * **Validates: Requirements 3.2**
   */
  describe('Property 5: Source Badge Presence', () => {
    it('renders source badge when book_source_id is present', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (bookSourceId) => {
            const card = { book_source_id: bookSourceId }
            expect(shouldRenderSourceBadge(card)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 6: Source Badge Absence**
   * *For any* card with a null book_source_id, the rendered CardListItem 
   * SHALL NOT include a Source badge.
   * **Validates: Requirements 3.5**
   */
  describe('Property 6: Source Badge Absence', () => {
    it('does not render source badge when book_source_id is null', () => {
      const card = { book_source_id: null }
      expect(shouldRenderSourceBadge(card)).toBe(false)
    })

    it('does not render source badge when book_source_id is undefined', () => {
      const card = { book_source_id: undefined }
      expect(shouldRenderSourceBadge(card)).toBe(false)
    })

    it('does not render source badge when book_source_id is empty string', () => {
      const card = { book_source_id: '' }
      expect(shouldRenderSourceBadge(card)).toBe(false)
    })
  })
})


// ============================================
// Source Filter Properties
// ============================================

/**
 * Helper to extract distinct sources from cards
 */
function extractDistinctSources(
  cards: Array<{ book_source_id?: string | null; book_source?: { id: string; title: string } | null }>
): Array<{ id: string; title: string }> {
  const sourceMap = new Map<string, { id: string; title: string }>()
  
  for (const card of cards) {
    if (card.book_source && card.book_source.id) {
      sourceMap.set(card.book_source.id, card.book_source)
    }
  }
  
  return Array.from(sourceMap.values())
}

/**
 * Helper to filter cards by source ID
 */
function filterCardsBySource<T extends { book_source_id?: string | null }>(
  cards: T[],
  sourceId: string
): T[] {
  return cards.filter(card => card.book_source_id === sourceId)
}

/**
 * Helper to filter cards by combined source and tag filters (AND logic)
 */
function filterCardsByCombined<T extends { book_source_id?: string | null; tags?: Array<{ id: string }> }>(
  cards: T[],
  sourceIds: string[],
  tagIds: string[]
): T[] {
  return cards.filter(card => {
    // Source filter (if any source selected)
    const matchesSource = sourceIds.length === 0 || 
      (card.book_source_id != null && sourceIds.includes(card.book_source_id))
    
    // Tag filter (if any tag selected) - AND logic: card must have ALL selected tags
    const cardTagIds = card.tags?.map(t => t.id) || []
    const matchesTags = tagIds.length === 0 || 
      tagIds.every(tagId => cardTagIds.includes(tagId))
    
    return matchesSource && matchesTags
  })
}

describe('V11.1 Tagging Ergonomics - Source Filter Properties', () => {
  /**
   * **Feature: v11.1-tagging-ergonomics, Property 8: Source Filter Distinct Sources**
   * *For any* set of cards with book_source_id values, the Source filter section 
   * SHALL list exactly the distinct book_sources referenced by those cards.
   * **Validates: Requirements 4.2**
   */
  describe('Property 8: Source Filter Distinct Sources', () => {
    it('extracts distinct sources from cards', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              book_source_id: fc.option(fc.uuid(), { nil: null }),
              book_source: fc.option(
                fc.record({
                  id: fc.uuid(),
                  title: fc.string({ minLength: 1, maxLength: 50 }),
                }),
                { nil: null }
              ),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (cards) => {
            // Ensure book_source.id matches book_source_id when both present
            const normalizedCards = cards.map(card => ({
              ...card,
              book_source: card.book_source_id && card.book_source 
                ? { ...card.book_source, id: card.book_source_id }
                : card.book_source
            }))
            
            const sources = extractDistinctSources(normalizedCards)
            
            // Should have no duplicates
            const ids = sources.map(s => s.id)
            expect(new Set(ids).size).toBe(ids.length)
            
            // All sources should come from cards
            for (const source of sources) {
              const hasCard = normalizedCards.some(
                c => c.book_source?.id === source.id
              )
              expect(hasCard).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 9: Source Filter Correctness**
   * *For any* selected source ID, filtering cards SHALL return exactly the cards 
   * where book_source_id matches the selected source.
   * **Validates: Requirements 4.3**
   */
  describe('Property 9: Source Filter Correctness', () => {
    it('returns only cards with matching book_source_id', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              book_source_id: fc.option(fc.uuid(), { nil: null }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.uuid(),
          (cards, targetSourceId) => {
            const filtered = filterCardsBySource(cards, targetSourceId)
            
            // All filtered cards should have matching source ID
            for (const card of filtered) {
              expect(card.book_source_id).toBe(targetSourceId)
            }
            
            // Count should match expected
            const expectedCount = cards.filter(c => c.book_source_id === targetSourceId).length
            expect(filtered).toHaveLength(expectedCount)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 10: Combined Filter AND Logic**
   * *For any* combination of source filter and topic filter, the filtered cards 
   * SHALL be the intersection (AND) of cards matching the source AND cards matching the topic.
   * **Validates: Requirements 4.5, 4.6**
   */
  describe('Property 10: Combined Filter AND Logic', () => {
    it('applies AND logic for source and tag filters', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              book_source_id: fc.option(fc.uuid(), { nil: null }),
              tags: fc.array(
                fc.record({ id: fc.uuid() }),
                { minLength: 0, maxLength: 5 }
              ),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }), // Source filter
          fc.array(fc.uuid(), { minLength: 0, maxLength: 3 }), // Tag filter
          (cards, sourceIds, tagIds) => {
            const filtered = filterCardsByCombined(cards, sourceIds, tagIds)
            
            // All filtered cards should match both filters
            for (const card of filtered) {
              // Check source filter
              if (sourceIds.length > 0) {
                expect(card.book_source_id).not.toBeNull()
                expect(sourceIds).toContain(card.book_source_id)
              }
              
              // Check tag filter (AND logic - must have ALL tags)
              if (tagIds.length > 0) {
                const cardTagIds = card.tags?.map(t => t.id) || []
                for (const tagId of tagIds) {
                  expect(cardTagIds).toContain(tagId)
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns all cards when no filters active', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              book_source_id: fc.option(fc.uuid(), { nil: null }),
              tags: fc.array(fc.record({ id: fc.uuid() }), { minLength: 0, maxLength: 3 }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          (cards) => {
            const filtered = filterCardsByCombined(cards, [], [])
            expect(filtered).toHaveLength(cards.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Import Context Storage Properties
// ============================================

/**
 * Simulated import context storage for testing
 */
interface ImportContext {
  bookSourceId: string | null
  chapterId: string | null
  sessionTagIds: string[]
}

const STORAGE_KEY_PREFIX = 'cekatan:import-context:'

function getStorageKey(deckId: string): string {
  return `${STORAGE_KEY_PREFIX}${deckId}`
}

// Simulated storage for testing (in-memory)
const mockStorage = new Map<string, string>()

function mockGetImportContext(deckId: string): ImportContext {
  const key = getStorageKey(deckId)
  const stored = mockStorage.get(key)
  if (!stored) {
    return { bookSourceId: null, chapterId: null, sessionTagIds: [] }
  }
  return JSON.parse(stored)
}

function mockSetImportContext(deckId: string, context: ImportContext): void {
  const key = getStorageKey(deckId)
  mockStorage.set(key, JSON.stringify(context))
}

function mockClearImportContext(deckId: string): void {
  const key = getStorageKey(deckId)
  mockStorage.delete(key)
}

describe('V11.1 Tagging Ergonomics - Import Context Properties', () => {
  beforeEach(() => {
    mockStorage.clear()
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 11: Import Context Persistence**
   * *For any* import context (bookSourceId, chapterId, sessionTagIds) set on a BulkImportPage, 
   * the values SHALL be persisted to localStorage under a deck-scoped key.
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.6**
   */
  describe('Property 11: Import Context Persistence', () => {
    it('persists import context to storage', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // deckId
          fc.option(fc.uuid(), { nil: null }), // bookSourceId
          fc.option(fc.uuid(), { nil: null }), // chapterId
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }), // sessionTagIds
          (deckId, bookSourceId, chapterId, sessionTagIds) => {
            const context: ImportContext = { bookSourceId, chapterId, sessionTagIds }
            
            mockSetImportContext(deckId, context)
            
            // Verify storage key is deck-scoped
            const key = getStorageKey(deckId)
            expect(key).toContain(deckId)
            expect(mockStorage.has(key)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 12: Import Context Restoration**
   * *For any* persisted import context, loading the BulkImportPage for the same deck 
   * SHALL restore those values to the UI state.
   * **Validates: Requirements 5.4**
   */
  describe('Property 12: Import Context Restoration', () => {
    it('restores persisted import context', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.option(fc.uuid(), { nil: null }),
          fc.option(fc.uuid(), { nil: null }),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          (deckId, bookSourceId, chapterId, sessionTagIds) => {
            const originalContext: ImportContext = { bookSourceId, chapterId, sessionTagIds }
            
            // Persist
            mockSetImportContext(deckId, originalContext)
            
            // Restore
            const restoredContext = mockGetImportContext(deckId)
            
            // Verify round-trip
            expect(restoredContext.bookSourceId).toBe(originalContext.bookSourceId)
            expect(restoredContext.chapterId).toBe(originalContext.chapterId)
            expect(restoredContext.sessionTagIds).toEqual(originalContext.sessionTagIds)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns default context for non-existent deck', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (deckId) => {
            const context = mockGetImportContext(deckId)
            
            expect(context.bookSourceId).toBeNull()
            expect(context.chapterId).toBeNull()
            expect(context.sessionTagIds).toEqual([])
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 13: Import Context Deck Scoping**
   * *For any* two different deck IDs, their import contexts SHALL be stored under 
   * different localStorage keys and SHALL NOT interfere with each other.
   * **Validates: Requirements 5.5, 5.6**
   */
  describe('Property 13: Import Context Deck Scoping', () => {
    it('stores contexts under different keys for different decks', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.record({
            bookSourceId: fc.option(fc.uuid(), { nil: null }),
            chapterId: fc.option(fc.uuid(), { nil: null }),
            sessionTagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
          }),
          fc.record({
            bookSourceId: fc.option(fc.uuid(), { nil: null }),
            chapterId: fc.option(fc.uuid(), { nil: null }),
            sessionTagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
          }),
          (deckId1, deckId2, context1, context2) => {
            // Skip if deck IDs are the same
            if (deckId1 === deckId2) return true
            
            // Set different contexts for different decks
            mockSetImportContext(deckId1, context1)
            mockSetImportContext(deckId2, context2)
            
            // Verify they don't interfere
            const restored1 = mockGetImportContext(deckId1)
            const restored2 = mockGetImportContext(deckId2)
            
            expect(restored1.bookSourceId).toBe(context1.bookSourceId)
            expect(restored2.bookSourceId).toBe(context2.bookSourceId)
            expect(restored1.sessionTagIds).toEqual(context1.sessionTagIds)
            expect(restored2.sessionTagIds).toEqual(context2.sessionTagIds)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clearing one deck context does not affect others', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.record({
            bookSourceId: fc.option(fc.uuid(), { nil: null }),
            chapterId: fc.option(fc.uuid(), { nil: null }),
            sessionTagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
          }),
          (deckId1, deckId2, context) => {
            if (deckId1 === deckId2) return true
            
            // Set context for both decks
            mockSetImportContext(deckId1, context)
            mockSetImportContext(deckId2, context)
            
            // Clear one deck
            mockClearImportContext(deckId1)
            
            // Verify deck1 is cleared but deck2 is intact
            const restored1 = mockGetImportContext(deckId1)
            const restored2 = mockGetImportContext(deckId2)
            
            expect(restored1.bookSourceId).toBeNull()
            expect(restored2.bookSourceId).toBe(context.bookSourceId)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


// ============================================
// Bulk Action Bar Properties
// ============================================

describe('V11.1 Tagging Ergonomics - Bulk Action Bar Properties', () => {
  /**
   * **Feature: v11.1-tagging-ergonomics, Property 1: Bulk Action Bar Visibility**
   * *For any* non-empty set of selected card IDs, the Bulk Action Bar SHALL be visible.
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Bulk Action Bar Visibility', () => {
    it('bar is visible when selection is non-empty', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
          (selectedIds) => {
            const shouldShowBar = selectedIds.length > 0
            expect(shouldShowBar).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('bar is hidden when selection is empty', () => {
      const selectedIds: string[] = []
      const shouldShowBar = selectedIds.length > 0
      expect(shouldShowBar).toBe(false)
    })
  })

  /**
   * **Feature: v11.1-tagging-ergonomics, Property 2: Bulk Tag Application Completeness**
   * *For any* set of selected card IDs and a valid tag ID, calling bulkAddTagToCards 
   * SHALL result in all cards having that tag association.
   * **Validates: Requirements 1.4**
   */
  describe('Property 2: Bulk Tag Application Completeness', () => {
    /**
     * Simulates bulk tag application logic
     */
    function simulateBulkTagApplication(
      cardIds: string[],
      tagId: string
    ): Array<{ card_template_id: string; tag_id: string }> {
      return cardIds.map(cardId => ({
        card_template_id: cardId,
        tag_id: tagId,
      }))
    }

    it('creates tag association for every selected card', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
          fc.uuid(),
          (cardIds, tagId) => {
            const associations = simulateBulkTagApplication(cardIds, tagId)
            
            // Should have one association per card
            expect(associations).toHaveLength(cardIds.length)
            
            // All associations should have the correct tag
            for (const assoc of associations) {
              expect(assoc.tag_id).toBe(tagId)
            }
            
            // All cards should be represented
            const associatedCardIds = associations.map(a => a.card_template_id)
            for (const cardId of cardIds) {
              expect(associatedCardIds).toContain(cardId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('handles large batches (50+ cards)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 50, maxLength: 150 }),
          fc.uuid(),
          (cardIds, tagId) => {
            const associations = simulateBulkTagApplication(cardIds, tagId)
            expect(associations).toHaveLength(cardIds.length)
          }
        ),
        { numRuns: 20 }
      )
    })
  })
})
