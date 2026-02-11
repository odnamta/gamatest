/**
 * V8.4: Tag Persistence Property Tests
 * 
 * Tests for the AI Tag Persistence fixes in V8.4 Auto-Scan Polish.
 * These tests verify that tags are properly deduplicated and persisted.
 * 
 * Note: These are unit tests for the tag deduplication logic, not integration
 * tests with the actual database. The bulkCreateMCQV2 server action is tested
 * via its internal logic patterns.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Helper function that mimics the tag deduplication logic in bulkCreateMCQV2.
 * This is extracted for testability without needing database access.
 */
function collectUniqueTags(
  sessionTags: string[],
  cards: Array<{ tagNames: string[] }>
): Set<string> {
  const allTagNames = new Set<string>()

  // Add session tags with case-insensitive deduplication
  for (const tagName of sessionTags) {
    const trimmed = tagName.trim()
    if (trimmed) {
      const lowerTrimmed = trimmed.toLowerCase()
      const alreadyExists = Array.from(allTagNames).some(
        existing => existing.toLowerCase() === lowerTrimmed
      )
      if (!alreadyExists) allTagNames.add(trimmed)
    }
  }
  
  // Add card tags with case-insensitive deduplication
  for (const card of cards) {
    // V8.4: Defensive check - ensure tagNames exists and is an array
    const cardTags = Array.isArray(card.tagNames) ? card.tagNames : []
    
    for (const tagName of cardTags) {
      const trimmed = tagName.trim()
      if (trimmed) {
        const lowerTrimmed = trimmed.toLowerCase()
        const alreadyExists = Array.from(allTagNames).some(
          existing => existing.toLowerCase() === lowerTrimmed
        )
        if (!alreadyExists) allTagNames.add(trimmed)
      }
    }
  }
  
  return allTagNames
}

/**
 * Helper function that mimics the tag-to-card linking logic in bulkCreateMCQV2.
 * Returns the set of unique (cardIndex, tagName) pairs that would be created.
 */
function computeCardTagLinks(
  sessionTags: string[],
  cards: Array<{ tagNames: string[] }>,
  tagNameToId: Map<string, string>
): Array<{ cardIndex: number; tagId: string }> {
  const links: Array<{ cardIndex: number; tagId: string }> = []
  const seenPairs = new Set<string>()
  
  for (let i = 0; i < cards.length; i++) {
    // Link session tags
    for (const tagName of sessionTags) {
      const tagId = tagNameToId.get(tagName.trim().toLowerCase())
      if (tagId) {
        const key = `${i}:${tagId}`
        if (!seenPairs.has(key)) {
          seenPairs.add(key)
          links.push({ cardIndex: i, tagId })
        }
      }
    }
    
    // V8.4: Defensive check - ensure tagNames exists and is an array
    const cardTags = Array.isArray(cards[i].tagNames) ? cards[i].tagNames : []
    
    // Link AI-generated tags
    for (const tagName of cardTags) {
      const tagId = tagNameToId.get(tagName.trim().toLowerCase())
      if (tagId) {
        const key = `${i}:${tagId}`
        if (!seenPairs.has(key)) {
          seenPairs.add(key)
          links.push({ cardIndex: i, tagId })
        }
      }
    }
  }
  
  return links
}

describe('V8.4: Tag Persistence Properties', () => {
  // Arbitrary generators
  const tagNameArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0)
  
  const tagNamesArrayArb = fc.array(tagNameArb, { maxLength: 10 })
  
  const cardArb = fc.record({
    tagNames: tagNamesArrayArb,
  })
  
  const cardsArrayArb = fc.array(cardArb, { minLength: 1, maxLength: 10 })

  /**
   * **Feature: v8.4-auto-scan-polish, Property 6: Tag deduplication across session and AI tags**
   * **Validates: Requirements 2.4**
   * 
   * For any card with both sessionTags and AI tagNames, the resulting
   * card_template_tags entries SHALL contain the union of both sets
   * without duplicates (case-insensitive).
   */
  describe('Property 6: Tag deduplication across session and AI tags', () => {
    it('collectUniqueTags returns union without duplicates', () => {
      fc.assert(
        fc.property(
          tagNamesArrayArb,
          cardsArrayArb,
          (sessionTags, cards) => {
            const uniqueTags = collectUniqueTags(sessionTags, cards)
            
            // Property: No two tags in the result should be case-insensitively equal
            const lowerCaseTags = Array.from(uniqueTags).map(t => t.toLowerCase())
            const uniqueLowerCase = new Set(lowerCaseTags)
            
            expect(lowerCaseTags.length).toBe(uniqueLowerCase.size)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('all session tags are included in unique tags', () => {
      fc.assert(
        fc.property(
          tagNamesArrayArb,
          cardsArrayArb,
          (sessionTags, cards) => {
            const uniqueTags = collectUniqueTags(sessionTags, cards)
            const uniqueLower = new Set(Array.from(uniqueTags).map(t => t.toLowerCase()))
            
            // Every non-empty session tag should be represented
            for (const tag of sessionTags) {
              const trimmed = tag.trim()
              if (trimmed) {
                expect(uniqueLower.has(trimmed.toLowerCase())).toBe(true)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('all AI tags are included in unique tags', () => {
      fc.assert(
        fc.property(
          tagNamesArrayArb,
          cardsArrayArb,
          (sessionTags, cards) => {
            const uniqueTags = collectUniqueTags(sessionTags, cards)
            const uniqueLower = new Set(Array.from(uniqueTags).map(t => t.toLowerCase()))
            
            // Every non-empty AI tag should be represented
            for (const card of cards) {
              const cardTags = Array.isArray(card.tagNames) ? card.tagNames : []
              for (const tag of cardTags) {
                const trimmed = tag.trim()
                if (trimmed) {
                  expect(uniqueLower.has(trimmed.toLowerCase())).toBe(true)
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('card-tag links have no duplicates per card', () => {
      fc.assert(
        fc.property(
          tagNamesArrayArb,
          cardsArrayArb,
          (sessionTags, cards) => {
            // Create a mock tagNameToId map
            const uniqueTags = collectUniqueTags(sessionTags, cards)
            const tagNameToId = new Map<string, string>()
            let idCounter = 0
            for (const tag of uniqueTags) {
              tagNameToId.set(tag.toLowerCase(), `tag-${idCounter++}`)
            }
            
            const links = computeCardTagLinks(sessionTags, cards, tagNameToId)
            
            // Property: No duplicate (cardIndex, tagId) pairs
            const seen = new Set<string>()
            for (const link of links) {
              const key = `${link.cardIndex}:${link.tagId}`
              expect(seen.has(key)).toBe(false)
              seen.add(key)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Feature: v8.4-auto-scan-polish, Property 7: Case-insensitive tag reuse**
   * **Validates: Requirements 2.5**
   * 
   * For any tag name that differs only in case from an existing user tag,
   * the system SHALL reuse the existing tag ID rather than creating a new tag.
   */
  describe('Property 7: Case-insensitive tag reuse', () => {
    it('tags differing only in case resolve to same entry', () => {
      fc.assert(
        fc.property(
          tagNameArb,
          (baseTag) => {
            // Generate case variations
            const variations = [
              baseTag.toLowerCase(),
              baseTag.toUpperCase(),
              baseTag.charAt(0).toUpperCase() + baseTag.slice(1).toLowerCase(),
            ]
            
            const sessionTags = variations
            const cards: Array<{ tagNames: string[] }> = []
            
            const uniqueTags = collectUniqueTags(sessionTags, cards)
            
            // Property: Only one tag should be in the result (case-insensitive)
            const lowerCaseTags = Array.from(uniqueTags).map(t => t.toLowerCase())
            const uniqueLowerCase = new Set(lowerCaseTags)
            
            expect(uniqueLowerCase.size).toBe(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('session tag and AI tag with same name (different case) resolve to one', () => {
      fc.assert(
        fc.property(
          tagNameArb,
          (baseTag) => {
            const sessionTags = [baseTag.toLowerCase()]
            const cards = [{ tagNames: [baseTag.toUpperCase()] }]
            
            const uniqueTags = collectUniqueTags(sessionTags, cards)
            
            // Property: Only one tag should be in the result
            expect(uniqueTags.size).toBe(1)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('card-tag links use same tagId for case variations', () => {
      fc.assert(
        fc.property(
          // Use alphanumeric strings to avoid edge cases with whitespace
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s)),
          (baseTag) => {
            const sessionTags = [baseTag.toLowerCase()]
            const cards = [
              { tagNames: [baseTag.toUpperCase()] },
              { tagNames: [baseTag] },
            ]
            
            // Create mock tagNameToId with single entry using trimmed lowercase
            const tagNameToId = new Map<string, string>()
            tagNameToId.set(baseTag.trim().toLowerCase(), 'tag-1')
            
            const links = computeCardTagLinks(sessionTags, cards, tagNameToId)
            
            // Property: All links should use the same tagId (if any links exist)
            if (links.length > 0) {
              const tagIds = new Set(links.map(l => l.tagId))
              expect(tagIds.size).toBe(1)
              expect(tagIds.has('tag-1')).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Defensive checks for undefined/null tagNames
   */
  describe('Defensive checks for tagNames', () => {
    it('handles undefined tagNames gracefully', () => {
      const sessionTags = ['Session1']
      const cards = [
        { tagNames: undefined as unknown as string[] },
        { tagNames: ['AI1'] },
      ]
      
      const uniqueTags = collectUniqueTags(sessionTags, cards)
      
      // Should include Session1 and AI1
      expect(uniqueTags.size).toBe(2)
      expect(uniqueTags.has('Session1')).toBe(true)
      expect(uniqueTags.has('AI1')).toBe(true)
    })

    it('handles null tagNames gracefully', () => {
      const sessionTags = ['Session1']
      const cards = [
        { tagNames: null as unknown as string[] },
        { tagNames: ['AI1'] },
      ]
      
      const uniqueTags = collectUniqueTags(sessionTags, cards)
      
      expect(uniqueTags.size).toBe(2)
    })

    it('handles empty tagNames array', () => {
      const sessionTags = ['Session1']
      const cards = [
        { tagNames: [] },
        { tagNames: ['AI1'] },
      ]
      
      const uniqueTags = collectUniqueTags(sessionTags, cards)
      
      expect(uniqueTags.size).toBe(2)
    })

    it('handles whitespace-only tag names', () => {
      const sessionTags = ['  ', 'Valid']
      const cards = [{ tagNames: ['   ', 'AlsoValid'] }]
      
      const uniqueTags = collectUniqueTags(sessionTags, cards)
      
      // Only non-whitespace tags should be included
      expect(uniqueTags.has('Valid')).toBe(true)
      expect(uniqueTags.has('AlsoValid')).toBe(true)
      expect(uniqueTags.size).toBe(2)
    })
  })
})
