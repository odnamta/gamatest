import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  mergeAndDeduplicateTags,
  normalizeTagName,
  hasTagDuplicates,
  deduplicateTags,
} from '@/lib/tag-merge'

/**
 * Property tests for tag merge utility
 * Feature: v6-fast-ingestion
 */

// Arbitrary for non-empty tag strings
const tagArb = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0)

// Arbitrary for tag arrays
const tagArrayArb = fc.array(tagArb, { minLength: 0, maxLength: 10 })

describe('Tag Merge Property Tests', () => {
  /**
   * **Feature: v6-fast-ingestion, Property 9: Tag merge produces unique normalized tags**
   * **Validates: Requirements R1.5, R2.3**
   * 
   * For any combination of session tags and AI tags, the merged result
   * should contain no duplicate tag names (case-insensitive, trimmed).
   */
  describe('Property 9: Tag merge produces unique normalized tags', () => {
    it('merged tags have no duplicates (case-insensitive)', () => {
      fc.assert(
        fc.property(tagArrayArb, tagArrayArb, (sessionTags, aiTags) => {
          const merged = mergeAndDeduplicateTags(sessionTags, aiTags)
          
          // Check for duplicates using normalized comparison
          const normalized = merged.map((t) => normalizeTagName(t))
          const unique = new Set(normalized)
          
          return unique.size === merged.length
        }),
        { numRuns: 100 }
      )
    })

    it('session tags appear before AI tags in result', () => {
      fc.assert(
        fc.property(tagArrayArb, tagArrayArb, (sessionTags, aiTags) => {
          const merged = mergeAndDeduplicateTags(sessionTags, aiTags)
          
          // Get unique session tags (in order)
          const uniqueSessionTags = deduplicateTags(sessionTags)
          
          // First N items should be the unique session tags
          for (let i = 0; i < uniqueSessionTags.length && i < merged.length; i++) {
            if (normalizeTagName(merged[i]) !== normalizeTagName(uniqueSessionTags[i])) {
              return false
            }
          }
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('all non-empty tags from both arrays are represented', () => {
      fc.assert(
        fc.property(tagArrayArb, tagArrayArb, (sessionTags, aiTags) => {
          const merged = mergeAndDeduplicateTags(sessionTags, aiTags)
          const mergedNormalized = new Set(merged.map(normalizeTagName))
          
          // Every non-empty tag from session should be in result
          for (const tag of sessionTags) {
            const trimmed = tag.trim()
            if (trimmed && !mergedNormalized.has(normalizeTagName(trimmed))) {
              return false
            }
          }
          
          // Every non-empty tag from AI should be in result
          for (const tag of aiTags) {
            const trimmed = tag.trim()
            if (trimmed && !mergedNormalized.has(normalizeTagName(trimmed))) {
              return false
            }
          }
          
          return true
        }),
        { numRuns: 100 }
      )
    })

    it('empty and whitespace-only tags are filtered out', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(tagArb, fc.constant(''), fc.constant('   '))),
          fc.array(fc.oneof(tagArb, fc.constant(''), fc.constant('   '))),
          (sessionTags, aiTags) => {
            const merged = mergeAndDeduplicateTags(sessionTags, aiTags)
            
            // No empty or whitespace-only tags in result
            return merged.every((tag) => tag.trim().length > 0)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('case variations are deduplicated', () => {
      // Specific test for case-insensitive deduplication
      const result1 = mergeAndDeduplicateTags(['Preeclampsia'], ['preeclampsia'])
      expect(result1).toHaveLength(1)
      expect(result1[0]).toBe('Preeclampsia') // Session tag wins
      
      const result2 = mergeAndDeduplicateTags(['labor'], ['LABOR', 'Labor'])
      expect(result2).toHaveLength(1)
      expect(result2[0]).toBe('labor')
      
      const result3 = mergeAndDeduplicateTags([], ['Tag', 'TAG', 'tag'])
      expect(result3).toHaveLength(1)
      expect(result3[0]).toBe('Tag') // First occurrence wins
    })

    it('whitespace is trimmed from tags', () => {
      const result = mergeAndDeduplicateTags(['  Diabetes  '], ['  Hypertension  '])
      expect(result).toEqual(['Diabetes', 'Hypertension'])
    })
  })

  describe('normalizeTagName', () => {
    it('trims and lowercases consistently', () => {
      fc.assert(
        fc.property(fc.string(), (tag) => {
          const normalized = normalizeTagName(tag)
          // Should be trimmed and lowercase
          return normalized === tag.trim().toLowerCase()
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('hasTagDuplicates', () => {
    it('returns false for unique tags', () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(tagArb, { minLength: 0, maxLength: 10 }),
          (uniqueTags) => {
            return hasTagDuplicates(uniqueTags) === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns true when duplicates exist', () => {
      expect(hasTagDuplicates(['Tag', 'tag'])).toBe(true)
      expect(hasTagDuplicates(['A', 'B', 'a'])).toBe(true)
      expect(hasTagDuplicates(['  X  ', 'X'])).toBe(true)
    })
  })

  describe('deduplicateTags', () => {
    it('produces no duplicates', () => {
      fc.assert(
        fc.property(tagArrayArb, (tags) => {
          const deduped = deduplicateTags(tags)
          return !hasTagDuplicates(deduped)
        }),
        { numRuns: 100 }
      )
    })

    it('preserves first occurrence', () => {
      const result = deduplicateTags(['First', 'FIRST', 'first'])
      expect(result).toEqual(['First'])
    })
  })
})
