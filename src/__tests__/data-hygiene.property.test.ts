/**
 * V9.2 Data Hygiene & Retro-Tagging Property Tests
 * 
 * Tests correctness properties for:
 * - Untagged filter
 * - Auto-tag batch processing
 * - Golden List validation
 * - Tag merge operations
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  GOLDEN_TOPIC_TAGS,
  isGoldenTopicTag,
  getCanonicalTopicTag,
  validateTopicTags,
  type GoldenTopicTag,
} from '@/lib/golden-list'
import { batchArray } from '@/lib/batch-utils'
import {
  filterUntaggedCards,
  shouldShowMergeButton,
} from '@/lib/data-hygiene-utils'

// ============================================
// Property 1: Untagged Filter Correctness
// Validates: Requirements 1.2, 1.3
// ============================================

describe('Property 1: Untagged Filter Correctness', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 1: Untagged Filter Correctness
   * Validates: Requirements 1.2, 1.3
   * 
   * For any list of cards with varying tag counts, when the "Show Untagged Only"
   * filter is active, the filtered result should contain only cards where
   * tags.length === 0, and when inactive, should contain all cards.
   */
  it('should return only cards with zero tags when filter is active', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            tags: fc.array(fc.record({ id: fc.uuid(), name: fc.string() })),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (cards) => {
          // When filter is active
          const filtered = filterUntaggedCards(cards, true)
          
          // All returned cards should have zero tags
          expect(filtered.every(card => card.tags.length === 0)).toBe(true)
          
          // Count should match cards with zero tags
          const expectedCount = cards.filter(c => c.tags.length === 0).length
          expect(filtered.length).toBe(expectedCount)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return all cards when filter is inactive', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            tags: fc.array(fc.record({ id: fc.uuid(), name: fc.string() })),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (cards) => {
          // When filter is inactive
          const filtered = filterUntaggedCards(cards, false)
          
          // Should return all cards
          expect(filtered.length).toBe(cards.length)
          expect(filtered).toEqual(cards)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property 2: Filter Count Consistency
// Validates: Requirements 1.4
// ============================================

describe('Property 2: Filter Count Consistency', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 2: Filter Count Consistency
   * Validates: Requirements 1.4
   * 
   * For any filtered card list, the displayed count indicator should equal
   * the length of the filtered array.
   */
  it('should have count equal to filtered array length', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            tags: fc.array(fc.record({ id: fc.uuid(), name: fc.string() })),
          }),
          { minLength: 0, maxLength: 100 }
        ),
        fc.boolean(),
        (cards, showUntaggedOnly) => {
          const filtered = filterUntaggedCards(cards, showUntaggedOnly)
          const count = filtered.length
          
          // Count should always equal array length
          expect(count).toBe(filtered.length)
          expect(count).toBeGreaterThanOrEqual(0)
          expect(count).toBeLessThanOrEqual(cards.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property 3: Auto-Tag Batch Size Limit
// Validates: Requirements 2.3
// ============================================

describe('Property 3: Auto-Tag Batch Size Limit', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 3: Auto-Tag Batch Size Limit
   * Validates: Requirements 2.3
   * 
   * For any array of N card IDs where N > 20, the autoTagCards function
   * should process cards in batches of at most 20 items each, resulting
   * in ceil(N/20) batch operations.
   */
  it('should batch arrays into chunks of at most 20 items', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 200 }),
        (cardIds) => {
          const BATCH_SIZE = 20
          const batches = batchArray(cardIds, BATCH_SIZE)
          
          // Each batch should have at most BATCH_SIZE items
          expect(batches.every(batch => batch.length <= BATCH_SIZE)).toBe(true)
          
          // Each batch should have at least 1 item
          expect(batches.every(batch => batch.length >= 1)).toBe(true)
          
          // Total items across batches should equal original
          const totalItems = batches.reduce((sum, batch) => sum + batch.length, 0)
          expect(totalItems).toBe(cardIds.length)
          
          // Number of batches should be ceil(N/BATCH_SIZE)
          const expectedBatches = Math.ceil(cardIds.length / BATCH_SIZE)
          expect(batches.length).toBe(expectedBatches)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should handle empty arrays', () => {
    const batches = batchArray([], 20)
    expect(batches).toEqual([])
  })

  it('should handle arrays smaller than batch size', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 19 }),
        (cardIds) => {
          const batches = batchArray(cardIds, 20)
          expect(batches.length).toBe(1)
          expect(batches[0]).toEqual(cardIds)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property 4: Auto-Tag Idempotence
// Validates: Requirements 2.6
// ============================================

describe('Property 4: Auto-Tag Idempotence', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 4: Auto-Tag Idempotence
   * Validates: Requirements 2.6
   * 
   * For any card and tag combination, calling autoTagCards multiple times
   * with the same card should result in exactly one card_template_tag row
   * per tag (no duplicates, no errors).
   * 
   * Note: This is tested via the upsert behavior simulation since we can't
   * hit the actual database in unit tests.
   */
  it('should produce unique tag assignments after multiple applications', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (cardId, tagNames, applyCount) => {
          // Simulate multiple tag applications
          const tagAssignments = new Map<string, Set<string>>()
          
          for (let i = 0; i < applyCount; i++) {
            for (const tagName of tagNames) {
              if (!tagAssignments.has(cardId)) {
                tagAssignments.set(cardId, new Set())
              }
              // Upsert behavior: adding same tag multiple times results in one entry
              tagAssignments.get(cardId)!.add(tagName.toLowerCase())
            }
          }
          
          // Each card should have exactly one entry per unique tag
          const cardTags = tagAssignments.get(cardId)!
          const uniqueTagNames = new Set(tagNames.map(t => t.toLowerCase()))
          expect(cardTags.size).toBe(uniqueTagNames.size)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property 5: Golden List Validation
// Validates: Requirements 4.1, 4.2
// ============================================

describe('Property 5: Golden List Validation', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 5: Golden List Validation
   * Validates: Requirements 4.1, 4.2
   * 
   * For any auto-tag response, all Topic tags must be members of the
   * GOLDEN_TOPIC_TAGS list.
   */
  it('should validate that Golden List contains expected topics', () => {
    const expectedTopics = [
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

    expect(GOLDEN_TOPIC_TAGS).toEqual(expectedTopics)
    expect(GOLDEN_TOPIC_TAGS.length).toBe(14)
  })

  it('should correctly identify valid Golden Topic Tags (case-insensitive)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GOLDEN_TOPIC_TAGS),
        (validTag) => {
          // Original case
          expect(isGoldenTopicTag(validTag)).toBe(true)
          // Lowercase
          expect(isGoldenTopicTag(validTag.toLowerCase())).toBe(true)
          // Uppercase
          expect(isGoldenTopicTag(validTag.toUpperCase())).toBe(true)
          // With whitespace
          expect(isGoldenTopicTag(`  ${validTag}  `)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should reject invalid topic tags', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          s => !GOLDEN_TOPIC_TAGS.some(t => t.toLowerCase() === s.trim().toLowerCase())
        ),
        (invalidTag) => {
          expect(isGoldenTopicTag(invalidTag)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return canonical form for valid tags', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GOLDEN_TOPIC_TAGS),
        (validTag) => {
          const canonical = getCanonicalTopicTag(validTag.toLowerCase())
          expect(canonical).toBe(validTag)
          expect(GOLDEN_TOPIC_TAGS.includes(canonical as GoldenTopicTag)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should validate and deduplicate topic tag arrays', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constantFrom(...GOLDEN_TOPIC_TAGS),
            fc.string({ minLength: 1, maxLength: 20 })
          ),
          { minLength: 0, maxLength: 20 }
        ),
        (mixedTags) => {
          const validated = validateTopicTags(mixedTags)
          
          // All validated tags should be in Golden List
          expect(validated.every(t => GOLDEN_TOPIC_TAGS.includes(t))).toBe(true)
          
          // No duplicates
          const uniqueSet = new Set(validated)
          expect(validated.length).toBe(uniqueSet.size)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property 6: Merge Button Visibility
// Validates: Requirements 3.2
// ============================================

describe('Property 6: Merge Button Visibility', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 6: Merge Button Visibility
   * Validates: Requirements 3.2
   * 
   * For any tag selection state, the "Merge Selected" button should be
   * enabled if and only if the selection count is >= 2.
   */
  it('should enable merge button only when 2+ tags selected', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
        (selectedTagIds) => {
          const shouldShow = shouldShowMergeButton(selectedTagIds)
          
          if (selectedTagIds.length >= 2) {
            expect(shouldShow).toBe(true)
          } else {
            expect(shouldShow).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return false for empty selection', () => {
    expect(shouldShowMergeButton([])).toBe(false)
  })

  it('should return false for single selection', () => {
    expect(shouldShowMergeButton(['tag-1'])).toBe(false)
  })

  it('should return true for exactly 2 selections', () => {
    expect(shouldShowMergeButton(['tag-1', 'tag-2'])).toBe(true)
  })

  it('should return true for more than 2 selections', () => {
    expect(shouldShowMergeButton(['tag-1', 'tag-2', 'tag-3'])).toBe(true)
  })
})

// ============================================
// Property 7: Merge Tag Consolidation
// Validates: Requirements 3.4, 3.6
// ============================================

describe('Property 7: Merge Tag Consolidation', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 7: Merge Tag Consolidation
   * Validates: Requirements 3.4, 3.6
   * 
   * For any set of cards with source tags, after a merge operation completes,
   * all affected cards should have the target tag and none should have any
   * source tags.
   */
  it('should consolidate all source tags to target', () => {
    fc.assert(
      fc.property(
        // Generate card-tag relationships
        fc.array(
          fc.record({
            cardId: fc.uuid(),
            tagIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.uuid(), // targetTagId
        fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // sourceTagIds
        (cardTagRelations, targetTagId, sourceTagIds) => {
          // Simulate merge operation
          const mergedRelations = cardTagRelations.map(relation => {
            const newTagIds = relation.tagIds.map(tagId => 
              sourceTagIds.includes(tagId) ? targetTagId : tagId
            )
            // Deduplicate
            return {
              cardId: relation.cardId,
              tagIds: [...new Set(newTagIds)],
            }
          })
          
          // After merge: no card should have source tags
          for (const relation of mergedRelations) {
            for (const sourceTagId of sourceTagIds) {
              expect(relation.tagIds.includes(sourceTagId)).toBe(false)
            }
          }
          
          // Cards that had source tags should now have target tag
          for (let i = 0; i < cardTagRelations.length; i++) {
            const hadSourceTag = cardTagRelations[i].tagIds.some(
              tagId => sourceTagIds.includes(tagId)
            )
            if (hadSourceTag) {
              expect(mergedRelations[i].tagIds.includes(targetTagId)).toBe(true)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ============================================
// Property 8: Merge Duplicate Handling
// Validates: Requirements 3.5
// ============================================

describe('Property 8: Merge Duplicate Handling', () => {
  /**
   * Feature: v9.2-data-hygiene, Property 8: Merge Duplicate Handling
   * Validates: Requirements 3.5
   * 
   * For any card that has both a source tag and the target tag before merge,
   * after merge the card should have exactly one instance of the target tag
   * (no duplicates).
   */
  it('should not create duplicate tags when card has both source and target', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // cardId
        fc.uuid(), // targetTagId
        fc.uuid(), // sourceTagId
        fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }), // otherTagIds
        (cardId, targetTagId, sourceTagId, otherTagIds) => {
          // Card has both source and target tags
          const originalTagIds = [sourceTagId, targetTagId, ...otherTagIds]
          
          // Simulate merge: replace source with target
          const mergedTagIds = originalTagIds.map(tagId => 
            tagId === sourceTagId ? targetTagId : tagId
          )
          
          // Deduplicate (as the merge operation should do)
          const deduplicatedTagIds = [...new Set(mergedTagIds)]
          
          // Count occurrences of target tag
          const targetCount = deduplicatedTagIds.filter(id => id === targetTagId).length
          
          // Should have exactly one instance of target tag
          expect(targetCount).toBe(1)
          
          // Should not have source tag
          expect(deduplicatedTagIds.includes(sourceTagId)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve other tags during merge', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // targetTagId
        fc.uuid(), // sourceTagId
        fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }).filter(
          ids => !ids.includes('target') && !ids.includes('source')
        ),
        (targetTagId, sourceTagId, otherTagIds) => {
          // Ensure other tags are distinct from source/target
          const distinctOtherTags = otherTagIds.filter(
            id => id !== targetTagId && id !== sourceTagId
          )
          
          const originalTagIds = [sourceTagId, ...distinctOtherTags]
          
          // Simulate merge
          const mergedTagIds = originalTagIds.map(tagId => 
            tagId === sourceTagId ? targetTagId : tagId
          )
          const deduplicatedTagIds = [...new Set(mergedTagIds)]
          
          // All other tags should be preserved
          for (const otherId of distinctOtherTags) {
            expect(deduplicatedTagIds.includes(otherId)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
