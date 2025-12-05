/**
 * V10.6: Digital Notebook Property Tests
 * Tests for flag toggle, notes, search, and flagged study mode
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ============================================
// Pure Function Helpers for Testing
// ============================================

/**
 * Default values for new user_card_progress records
 * **Feature: v10.6-digital-notebook-search, Property 9: Progress Record Defaults**
 */
export const PROGRESS_DEFAULTS = {
  is_flagged: false,
  notes: null,
  interval: 0,
  ease_factor: 2.5,
  repetitions: 0,
  suspended: false,
  correct_count: 0,
  total_attempts: 0,
} as const

/**
 * Creates a new progress record with defaults
 */
export function createProgressRecord(
  userId: string,
  cardTemplateId: string,
  overrides: Partial<typeof PROGRESS_DEFAULTS> = {}
): {
  user_id: string
  card_template_id: string
  is_flagged: boolean
  notes: string | null
  interval: number
  ease_factor: number
  repetitions: number
  suspended: boolean
  correct_count: number
  total_attempts: number
  next_review: string
  last_answered_at: string | null
} {
  return {
    user_id: userId,
    card_template_id: cardTemplateId,
    ...PROGRESS_DEFAULTS,
    ...overrides,
    next_review: new Date().toISOString(),
    last_answered_at: null,
  }
}

/**
 * Toggles the flag state
 * **Feature: v10.6-digital-notebook-search, Property 1: Flag Toggle Inverts State**
 */
export function toggleFlag(currentState: boolean): boolean {
  return !currentState
}

/**
 * Determines which icon to render based on flag state
 * **Feature: v10.6-digital-notebook-search, Property 2: Flag Icon Reflects State**
 */
export function getFlagIconType(isFlagged: boolean): 'filled' | 'outline' {
  return isFlagged ? 'filled' : 'outline'
}

/**
 * Search result type
 */
export interface SearchResult {
  id: string
  stem: string
  explanation: string | null
  deckTemplateId: string
}

/**
 * Filters search results to only include cards from subscribed decks
 * **Feature: v10.6-digital-notebook-search, Property 4: Search Results Subscription Filter**
 */
export function filterBySubscribedDecks(
  results: SearchResult[],
  subscribedDeckIds: Set<string>
): SearchResult[] {
  return results.filter(r => subscribedDeckIds.has(r.deckTemplateId))
}

/**
 * Limits search results to max count
 * **Feature: v10.6-digital-notebook-search, Property 5: Search Results Limit**
 */
export function limitResults<T>(results: T[], maxCount: number): T[] {
  return results.slice(0, maxCount)
}

/**
 * Checks if a card matches a search query (case-insensitive)
 * **Feature: v10.6-digital-notebook-search, Property 6: Search Results Contain Query**
 */
export function cardMatchesQuery(
  card: { stem: string; explanation: string | null },
  query: string
): boolean {
  const lowerQuery = query.toLowerCase()
  const stemMatches = card.stem.toLowerCase().includes(lowerQuery)
  const explanationMatches = card.explanation?.toLowerCase().includes(lowerQuery) ?? false
  return stemMatches || explanationMatches
}

/**
 * Filters cards to only flagged ones
 * **Feature: v10.6-digital-notebook-search, Property 7: Flagged Filter Correctness**
 */
export function filterFlaggedOnly<T extends { is_flagged: boolean }>(
  cards: T[],
  flaggedOnly: boolean
): T[] {
  if (!flaggedOnly) return cards
  return cards.filter(c => c.is_flagged)
}

/**
 * Combined filter for custom sessions
 * **Feature: v10.6-digital-notebook-search, Property 8: Combined Filters AND Logic**
 */
export interface FilterConfig {
  tagIds?: string[]
  deckIds?: string[]
  flaggedOnly?: boolean
}

export interface FilterableCard {
  id: string
  deckTemplateId: string
  tagIds: string[]
  is_flagged: boolean
}

export function applyFilters(
  cards: FilterableCard[],
  config: FilterConfig
): FilterableCard[] {
  let filtered = cards

  // Filter by deck IDs (if specified)
  if (config.deckIds && config.deckIds.length > 0) {
    const deckSet = new Set(config.deckIds)
    filtered = filtered.filter(c => deckSet.has(c.deckTemplateId))
  }

  // Filter by tag IDs (if specified) - card must have at least one matching tag
  if (config.tagIds && config.tagIds.length > 0) {
    const tagSet = new Set(config.tagIds)
    filtered = filtered.filter(c => c.tagIds.some(t => tagSet.has(t)))
  }

  // Filter by flagged status
  if (config.flaggedOnly) {
    filtered = filtered.filter(c => c.is_flagged)
  }

  return filtered
}

// ============================================
// Property Tests
// ============================================

describe('V10.6: Digital Notebook Properties', () => {
  /**
   * **Feature: v10.6-digital-notebook-search, Property 9: Progress Record Defaults**
   * **Validates: Requirements 6.1, 6.2**
   */
  describe('Property 9: Progress Record Defaults', () => {
    it('new progress records have is_flagged = false and notes = null', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          (userId, cardTemplateId) => {
            const record = createProgressRecord(userId, cardTemplateId)
            
            // Verify defaults
            expect(record.is_flagged).toBe(false)
            expect(record.notes).toBeNull()
            expect(record.user_id).toBe(userId)
            expect(record.card_template_id).toBe(cardTemplateId)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 1: Flag Toggle Inverts State**
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Flag Toggle Inverts State', () => {
    it('toggling flag produces opposite boolean value', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (initialState) => {
            const newState = toggleFlag(initialState)
            expect(newState).toBe(!initialState)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('double toggle returns to original state', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (initialState) => {
            const afterFirstToggle = toggleFlag(initialState)
            const afterSecondToggle = toggleFlag(afterFirstToggle)
            expect(afterSecondToggle).toBe(initialState)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 2: Flag Icon Reflects State**
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('Property 2: Flag Icon Reflects State', () => {
    it('returns filled icon when flagged, outline when not', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isFlagged) => {
            const iconType = getFlagIconType(isFlagged)
            if (isFlagged) {
              expect(iconType).toBe('filled')
            } else {
              expect(iconType).toBe('outline')
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 10: Upsert Creates Record**
   * **Validates: Requirements 6.3, 6.4**
   */
  describe('Property 10: Upsert Creates Record', () => {
    it('createProgressRecord with flag override sets is_flagged correctly', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.boolean(),
          (userId, cardTemplateId, flagValue) => {
            const record = createProgressRecord(userId, cardTemplateId, { is_flagged: flagValue })
            expect(record.is_flagged).toBe(flagValue)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('createProgressRecord with notes override sets notes correctly', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 0, maxLength: 1000 }),
          (userId, cardTemplateId, notesValue) => {
            const record = createProgressRecord(userId, cardTemplateId, { notes: notesValue })
            expect(record.notes).toBe(notesValue)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

describe('V10.6: Notes Properties', () => {
  /**
   * **Feature: v10.6-digital-notebook-search, Property 3: Notes Round-Trip Consistency**
   * **Validates: Requirements 2.6**
   */
  describe('Property 3: Notes Round-Trip Consistency', () => {
    it('notes value is preserved through record creation', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.option(fc.string({ minLength: 0, maxLength: 5000 }), { nil: null }),
          (userId, cardTemplateId, notes) => {
            const record = createProgressRecord(userId, cardTemplateId, { notes })
            expect(record.notes).toBe(notes)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

describe('V10.6: Search Properties', () => {
  // Arbitrary for search results
  const searchResultArb = fc.record({
    id: fc.uuid(),
    stem: fc.string({ minLength: 1, maxLength: 500 }),
    explanation: fc.option(fc.string({ minLength: 1, maxLength: 1000 }), { nil: null }),
    deckTemplateId: fc.uuid(),
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 4: Search Results Subscription Filter**
   * **Validates: Requirements 3.2**
   */
  describe('Property 4: Search Results Subscription Filter', () => {
    it('all filtered results belong to subscribed decks', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultArb, { minLength: 0, maxLength: 50 }),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          (results, subscribedIds) => {
            const subscribedSet = new Set(subscribedIds)
            const filtered = filterBySubscribedDecks(results, subscribedSet)
            
            // Every result must be from a subscribed deck
            for (const result of filtered) {
              expect(subscribedSet.has(result.deckTemplateId)).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 5: Search Results Limit**
   * **Validates: Requirements 3.3**
   */
  describe('Property 5: Search Results Limit', () => {
    it('results are limited to max count', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultArb, { minLength: 0, maxLength: 100 }),
          fc.integer({ min: 1, max: 20 }),
          (results, maxCount) => {
            const limited = limitResults(results, maxCount)
            expect(limited.length).toBeLessThanOrEqual(maxCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('limit of 10 is enforced', () => {
      fc.assert(
        fc.property(
          fc.array(searchResultArb, { minLength: 0, maxLength: 100 }),
          (results) => {
            const limited = limitResults(results, 10)
            expect(limited.length).toBeLessThanOrEqual(10)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 6: Search Results Contain Query**
   * **Validates: Requirements 3.1**
   */
  describe('Property 6: Search Results Contain Query', () => {
    it('matching cards contain query in stem or explanation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 500 }),
          fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
          (query, stemBase, explanationBase) => {
            // Create a card that contains the query
            const cardWithMatch = {
              stem: stemBase + query + stemBase,
              explanation: explanationBase,
            }
            
            expect(cardMatchesQuery(cardWithMatch, query)).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('non-matching cards do not contain query', () => {
      // Use a query that won't appear in random strings
      const uniqueQuery = '___UNIQUE_SEARCH_TERM_12345___'
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 500 }).filter(s => !s.includes(uniqueQuery)),
          fc.option(fc.string({ minLength: 0, maxLength: 500 }).filter(s => !s.includes(uniqueQuery)), { nil: null }),
          (stem, explanation) => {
            const card = { stem, explanation }
            expect(cardMatchesQuery(card, uniqueQuery)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})

describe('V10.6: Flagged Study Mode Properties', () => {
  // Arbitrary for filterable cards
  const filterableCardArb = fc.record({
    id: fc.uuid(),
    deckTemplateId: fc.uuid(),
    tagIds: fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
    is_flagged: fc.boolean(),
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 7: Flagged Filter Correctness**
   * **Validates: Requirements 5.2**
   */
  describe('Property 7: Flagged Filter Correctness', () => {
    it('when flaggedOnly=true, all results have is_flagged=true', () => {
      fc.assert(
        fc.property(
          fc.array(filterableCardArb, { minLength: 0, maxLength: 50 }),
          (cards) => {
            const filtered = filterFlaggedOnly(cards, true)
            
            for (const card of filtered) {
              expect(card.is_flagged).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('when flaggedOnly=false, all cards are returned', () => {
      fc.assert(
        fc.property(
          fc.array(filterableCardArb, { minLength: 0, maxLength: 50 }),
          (cards) => {
            const filtered = filterFlaggedOnly(cards, false)
            expect(filtered.length).toBe(cards.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v10.6-digital-notebook-search, Property 8: Combined Filters AND Logic**
   * **Validates: Requirements 5.4**
   */
  describe('Property 8: Combined Filters AND Logic', () => {
    it('results satisfy all active filter conditions', () => {
      fc.assert(
        fc.property(
          fc.array(filterableCardArb, { minLength: 0, maxLength: 50 }),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
          fc.boolean(),
          (cards, deckIds, tagIds, flaggedOnly) => {
            const config: FilterConfig = {
              deckIds: deckIds.length > 0 ? deckIds : undefined,
              tagIds: tagIds.length > 0 ? tagIds : undefined,
              flaggedOnly,
            }
            
            const filtered = applyFilters(cards, config)
            
            const deckSet = new Set(deckIds)
            const tagSet = new Set(tagIds)
            
            for (const card of filtered) {
              // Check deck filter
              if (config.deckIds && config.deckIds.length > 0) {
                expect(deckSet.has(card.deckTemplateId)).toBe(true)
              }
              
              // Check tag filter (at least one tag must match)
              if (config.tagIds && config.tagIds.length > 0) {
                const hasMatchingTag = card.tagIds.some(t => tagSet.has(t))
                expect(hasMatchingTag).toBe(true)
              }
              
              // Check flagged filter
              if (config.flaggedOnly) {
                expect(card.is_flagged).toBe(true)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
