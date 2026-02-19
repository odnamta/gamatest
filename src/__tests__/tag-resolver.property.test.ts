import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { resolveTopicTag, resolveConceptTag, isValidTopic } from '@/lib/tag-resolver'
import { GOLDEN_TOPIC_TAGS } from '@/lib/golden-list'

/**
 * Tag Resolver Property Tests
 * 
 * **Feature: v11.5-global-study-stabilization**
 * Tests for tag resolution logic.
 */

describe('Tag Resolver Property Tests', () => {
  /**
   * **Property 10: Topic Tag Resolution - Valid Input**
   * For any string S that matches a Golden List topic (case-insensitive), 
   * resolveTopicTag SHALL return the canonical form.
   * **Validates: Requirements 8.2, 8.4**
   */
  describe('Property 10: Topic Tag Resolution - Valid Input', () => {
    it('should return canonical form for valid topics', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...GOLDEN_TOPIC_TAGS),
          (topic) => {
            const result = resolveTopicTag(topic)
            expect(result).toBe(topic)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should be case-insensitive', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...GOLDEN_TOPIC_TAGS),
          (topic) => {
            // Test lowercase
            const lowerResult = resolveTopicTag(topic.toLowerCase())
            expect(lowerResult).toBe(topic)
            
            // Test uppercase
            const upperResult = resolveTopicTag(topic.toUpperCase())
            expect(upperResult).toBe(topic)
            
            // Test mixed case
            const mixedCase = topic
              .split('')
              .map((c, i) => (i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()))
              .join('')
            const mixedResult = resolveTopicTag(mixedCase)
            expect(mixedResult).toBe(topic)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle whitespace padding', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...GOLDEN_TOPIC_TAGS),
          fc.nat({ max: 5 }),
          fc.nat({ max: 5 }),
          (topic, leadingCount, trailingCount) => {
            const leadingSpaces = ' '.repeat(leadingCount)
            const trailingSpaces = ' '.repeat(trailingCount)
            const padded = leadingSpaces + topic + trailingSpaces
            const result = resolveTopicTag(padded)
            expect(result).toBe(topic)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * **Property 11: Topic Tag Resolution - Invalid Input**
   * For any string S not in the Golden List, resolveTopicTag SHALL return null.
   * **Validates: Requirements 8.3**
   */
  describe('Property 11: Topic Tag Resolution - Invalid Input', () => {
    it('should return null for invalid topics', () => {
      // Generate strings that are definitely not in the Golden List
      const invalidTopicArb = fc.string({ minLength: 1, maxLength: 50 }).filter(
        (s) => !GOLDEN_TOPIC_TAGS.some((t) => t.toLowerCase() === s.trim().toLowerCase())
      )

      fc.assert(
        fc.property(invalidTopicArb, (invalidTopic) => {
          const result = resolveTopicTag(invalidTopic)
          expect(result).toBeNull()
        }),
        { numRuns: 100 }
      )
    })

    it('should return null for empty string', () => {
      expect(resolveTopicTag('')).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10 }).map((n) => {
            const chars = [' ', '\t', '\n']
            return Array.from({ length: Math.max(1, n) }, () => 
              chars[Math.floor(Math.random() * chars.length)]
            ).join('')
          }),
          (whitespace) => {
            const result = resolveTopicTag(whitespace)
            expect(result).toBeNull()
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should return null for partial matches', () => {
      // "Safe" should not match "Safety"
      expect(resolveTopicTag('Safe')).toBeNull()
      expect(resolveTopicTag('Oper')).toBeNull()
      expect(resolveTopicTag('Manag')).toBeNull()
    })

    it('should return null for topics with extra characters', () => {
      expect(resolveTopicTag('Safety!')).toBeNull()
      expect(resolveTopicTag('Safety123')).toBeNull()
      expect(resolveTopicTag('_Safety')).toBeNull()
    })
  })

  /**
   * isValidTopic tests
   */
  describe('isValidTopic', () => {
    it('should return true for valid topics', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...GOLDEN_TOPIC_TAGS),
          (topic) => {
            expect(isValidTopic(topic)).toBe(true)
            expect(isValidTopic(topic.toLowerCase())).toBe(true)
            expect(isValidTopic(topic.toUpperCase())).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return false for invalid topics', () => {
      expect(isValidTopic('NotATopic')).toBe(false)
      expect(isValidTopic('')).toBe(false)
      expect(isValidTopic('   ')).toBe(false)
    })
  })

  /**
   * resolveConceptTag tests
   */
  describe('resolveConceptTag', () => {
    it('should convert to PascalCase', () => {
      expect(resolveConceptTag('fire safety')).toBe('FireSafety')
      expect(resolveConceptTag('forklift')).toBe('Forklift')
      expect(resolveConceptTag('INVENTORY MANAGEMENT')).toBe('InventoryManagement')
    })

    it('should handle single words', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-zA-Z]+$/.test(s)),
          (word) => {
            const result = resolveConceptTag(word)
            // First letter uppercase, rest lowercase
            expect(result).toBe(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return empty string for empty input', () => {
      expect(resolveConceptTag('')).toBe('')
    })

    it('should return empty string for whitespace-only input', () => {
      expect(resolveConceptTag('   ')).toBe('')
    })

    it('should trim whitespace', () => {
      expect(resolveConceptTag('  forklift  ')).toBe('Forklift')
    })
  })

  /**
   * Known Golden List topics
   */
  describe('Known Golden List topics', () => {
    const knownTopics = [
      'General',
      'Safety',
      'Operations',
      'Management',
      'Technical',
      'Compliance',
      'Customer Service',
      'Logistics',
      'Finance',
      'Human Resources',
      'Quality Control',
      'IT Systems',
      'Leadership',
      'Communication',
    ]

    it('should resolve all known topics', () => {
      for (const topic of knownTopics) {
        expect(resolveTopicTag(topic)).toBe(topic)
        expect(resolveTopicTag(topic.toLowerCase())).toBe(topic)
      }
    })
  })
})
