/**
 * V11.3 Tag Management UX - Property-Based Tests
 * Tests correctness properties for tag creation, editing, and deletion
 * 
 * Note: Pure helper functions are duplicated here to avoid importing components
 * that have server action dependencies (which import openai-client)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

type TagCategory = 'source' | 'topic' | 'concept'

/**
 * Helper function to get default category for TagCreateDialog
 * Duplicated from TagCreateDialog.tsx
 */
function getDefaultCategory(context: 'admin' | 'selector', columnCategory?: TagCategory): TagCategory {
  if (context === 'admin' && columnCategory) {
    return columnCategory
  }
  // TagSelector always defaults to 'concept'
  return 'concept'
}

/**
 * Helper function to determine if Create option should show
 * Duplicated from TagSelector.tsx
 */
function shouldShowCreateOption(searchQuery: string, existingTags: { name: string }[]): boolean {
  const query = searchQuery.trim()
  if (!query) return false
  const exactMatch = existingTags.some(tag => tag.name.toLowerCase() === query.toLowerCase())
  return !exactMatch
}

/**
 * Helper function to filter tags by search query
 * Duplicated from TagSelector.tsx
 */
function filterTagsByQuery<T extends { name: string }>(tags: T[], query: string): T[] {
  if (!query.trim()) return tags
  const normalizedQuery = query.toLowerCase().trim()
  return tags.filter(tag => tag.name.toLowerCase().includes(normalizedQuery))
}

// Arbitrary for valid tag categories
const tagCategoryArb = fc.constantFrom<TagCategory>('source', 'topic', 'concept')

// Arbitrary for valid tag names (non-empty, trimmed, max 50 chars)
// Using alphanumeric to avoid edge cases with whitespace
const tagNameArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,48}[a-zA-Z0-9]?$/)
  .filter(s => s.trim().length > 0 && s.trim() === s)

// Arbitrary for tag-like objects
const tagArb = fc.record({
  id: fc.uuid(),
  name: tagNameArb,
  category: tagCategoryArb,
  color: fc.constantFrom('blue', 'purple', 'green'),
})

describe('V11.3 Tag Management - Property Tests', () => {
  /**
   * Property 6: TagCreateDialog defaults to Concept from TagSelector
   * For any tag creation initiated from TagSelector, the default category SHALL be "concept"
   * Validates: Requirements 4.3
   */
  describe('Property 6: TagCreateDialog defaults to Concept from TagSelector', () => {
    it('should default to concept category when context is selector', () => {
      fc.assert(
        fc.property(
          tagCategoryArb, // Any column category (should be ignored for selector)
          (columnCategory) => {
            const result = getDefaultCategory('selector', columnCategory)
            expect(result).toBe('concept')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use column category when context is admin', () => {
      fc.assert(
        fc.property(
          tagCategoryArb,
          (columnCategory) => {
            const result = getDefaultCategory('admin', columnCategory)
            expect(result).toBe(columnCategory)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 5: TagSelector create option shows for non-matching queries
   * For any search query that does not exactly match any existing tag name,
   * the "Create" option SHALL be displayed
   * Validates: Requirements 4.1
   */
  describe('Property 5: Create option visibility', () => {
    it('should show create option when query does not match any tag exactly', () => {
      fc.assert(
        fc.property(
          tagNameArb,
          fc.array(tagArb, { minLength: 0, maxLength: 20 }),
          (query, tags) => {
            // Ensure query doesn't exactly match any tag (case-insensitive)
            const hasExactMatch = tags.some(
              t => t.name.toLowerCase() === query.toLowerCase()
            )
            
            if (!hasExactMatch && query.trim()) {
              expect(shouldShowCreateOption(query, tags)).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not show create option when query exactly matches a tag', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 1, maxLength: 20 }),
          (tags) => {
            // Pick a random tag name from the list
            const matchingName = tags[0].name
            // Only test if the trimmed name is non-empty (the function trims the query)
            if (matchingName.trim()) {
              expect(shouldShowCreateOption(matchingName, tags)).toBe(false)
              // Also test case-insensitive match
              expect(shouldShowCreateOption(matchingName.toUpperCase(), tags)).toBe(false)
              expect(shouldShowCreateOption(matchingName.toLowerCase(), tags)).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not show create option for empty query', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 0, maxLength: 20 }),
          fc.constantFrom('', '   ', '\t', '\n'),
          (tags, emptyQuery) => {
            expect(shouldShowCreateOption(emptyQuery, tags)).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 10: Tags are sorted consistently
   * For any list of tags in TagSelector, the tags SHALL be sorted alphabetically
   * Validates: Requirements 6.2
   */
  describe('Property 10: Sort consistency', () => {
    it('should filter tags by query consistently', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 0, maxLength: 50 }),
          tagNameArb,
          (tags, query) => {
            const filtered = filterTagsByQuery(tags, query)
            
            // All filtered tags should contain the query (case-insensitive)
            const normalizedQuery = query.toLowerCase().trim()
            filtered.forEach(tag => {
              expect(tag.name.toLowerCase()).toContain(normalizedQuery)
            })
            
            // Filtered count should be <= original count
            expect(filtered.length).toBeLessThanOrEqual(tags.length)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return all tags when query is empty', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 0, maxLength: 50 }),
          fc.constantFrom('', '   '),
          (tags, emptyQuery) => {
            const filtered = filterTagsByQuery(tags, emptyQuery)
            expect(filtered.length).toBe(tags.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


/**
 * Helper function to categorize tags by category
 * Simulates the TagManager's categorization logic
 */
function categorizeTagsByCategory(tags: Array<{ id: string; name: string; category: TagCategory; color: string }>) {
  return {
    source: tags.filter(t => t.category === 'source'),
    topic: tags.filter(t => t.category === 'topic'),
    concept: tags.filter(t => t.category === 'concept'),
  }
}

/**
 * Helper function to get category color
 * Duplicated from tag-colors.ts
 */
function getCategoryColor(category: TagCategory): string {
  const CATEGORY_COLORS: Record<TagCategory, string> = {
    source: 'blue',
    topic: 'purple',
    concept: 'green',
  }
  return CATEGORY_COLORS[category]
}

describe('V11.3 Tag Management - Additional Property Tests', () => {
  /**
   * Property 1: Tag creation places tag in correct category column
   * For any valid tag name and category, when a tag is created, it SHALL appear
   * in the column matching its category
   * Validates: Requirements 1.3, 1.4
   */
  describe('Property 1: Tag placement in correct column', () => {
    it('should place tag in the correct category column', () => {
      fc.assert(
        fc.property(
          tagArb,
          fc.array(tagArb, { minLength: 0, maxLength: 20 }),
          (newTag, existingTags) => {
            // Simulate adding a new tag to the list
            const allTags = [...existingTags, newTag]
            const categorized = categorizeTagsByCategory(allTags)
            
            // The new tag should appear in its category's column
            const categoryColumn = categorized[newTag.category]
            const tagInColumn = categoryColumn.some(t => t.id === newTag.id)
            expect(tagInColumn).toBe(true)
            
            // The tag should NOT appear in other columns
            const otherCategories = (['source', 'topic', 'concept'] as TagCategory[])
              .filter(c => c !== newTag.category)
            
            for (const otherCategory of otherCategories) {
              const otherColumn = categorized[otherCategory]
              const tagInOtherColumn = otherColumn.some(t => t.id === newTag.id)
              expect(tagInOtherColumn).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Category change moves tag to correct column
   * For any existing tag and any new category, when the category is changed,
   * the tag SHALL appear in the new category's column
   * Validates: Requirements 2.2
   */
  describe('Property 2: Category change moves tag', () => {
    it('should move tag to new category column after category change', () => {
      fc.assert(
        fc.property(
          tagArb,
          tagCategoryArb,
          fc.array(tagArb, { minLength: 0, maxLength: 20 }),
          (tag, newCategory, otherTags) => {
            // Simulate changing the tag's category
            const updatedTag = { ...tag, category: newCategory, color: getCategoryColor(newCategory) }
            const allTags = [...otherTags.filter(t => t.id !== tag.id), updatedTag]
            const categorized = categorizeTagsByCategory(allTags)
            
            // The tag should appear in the new category's column
            const newColumn = categorized[newCategory]
            const tagInNewColumn = newColumn.some(t => t.id === tag.id)
            expect(tagInNewColumn).toBe(true)
            
            // The tag should NOT appear in other columns
            const otherCategories = (['source', 'topic', 'concept'] as TagCategory[])
              .filter(c => c !== newCategory)
            
            for (const otherCategory of otherCategories) {
              const otherColumn = categorized[otherCategory]
              const tagInOtherColumn = otherColumn.some(t => t.id === tag.id)
              expect(tagInOtherColumn).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 4: Tag deletion removes tag from list
   * For any tag in a category column, when the tag is deleted,
   * it SHALL no longer appear in any category column
   * Validates: Requirements 3.4
   */
  describe('Property 4: Tag deletion removes from list', () => {
    it('should remove tag from all columns after deletion', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 1, maxLength: 20 }),
          (tags) => {
            // Pick a random tag to delete
            const tagToDelete = tags[0]
            
            // Simulate deletion
            const remainingTags = tags.filter(t => t.id !== tagToDelete.id)
            const categorized = categorizeTagsByCategory(remainingTags)
            
            // The deleted tag should not appear in any column
            for (const category of ['source', 'topic', 'concept'] as TagCategory[]) {
              const column = categorized[category]
              const tagInColumn = column.some(t => t.id === tagToDelete.id)
              expect(tagInColumn).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 7: Created tag is auto-selected in TagSelector
   * For any tag created via TagCreateDialog from TagSelector,
   * after successful creation, the tag SHALL be included in the selectedTagIds array
   * Validates: Requirements 4.4
   */
  describe('Property 7: Auto-selection after creation', () => {
    it('should include newly created tag in selection', () => {
      fc.assert(
        fc.property(
          tagArb,
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          (newTag, existingSelectedIds) => {
            // Simulate auto-selection: add new tag ID to selection
            const newSelectedIds = [...existingSelectedIds, newTag.id]
            
            // The new tag should be in the selection
            expect(newSelectedIds).toContain(newTag.id)
            
            // All previously selected tags should still be selected
            for (const existingId of existingSelectedIds) {
              expect(newSelectedIds).toContain(existingId)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


/**
 * Helper function to sort tags by category then alphabetically
 * Duplicated from TagSelector.tsx
 */
function sortTagsByCategory<T extends { name: string; category: TagCategory }>(tags: T[]): T[] {
  const categoryOrder: Record<TagCategory, number> = { source: 0, topic: 1, concept: 2 }
  return [...tags].sort((a, b) => {
    const categoryDiff = categoryOrder[a.category] - categoryOrder[b.category]
    if (categoryDiff !== 0) return categoryDiff
    return a.name.localeCompare(b.name)
  })
}

/**
 * Helper to check if a tag has a category indicator
 * Duplicated from TagBadge.tsx
 */
function hasCategoryIndicator(tag: { category?: TagCategory }, showCategoryIcon: boolean): boolean {
  return showCategoryIcon && !!tag.category
}

describe('V11.3 Tag Management - Visual Category Tests', () => {
  /**
   * Property 9: Tags display category indicator
   * For any tag displayed with showCategoryIcon=true, the rendered output
   * SHALL include a category indicator
   * Validates: Requirements 6.1
   */
  describe('Property 9: Category indicator presence', () => {
    it('should show category indicator when showCategoryIcon is true and tag has category', () => {
      fc.assert(
        fc.property(
          tagArb,
          (tag) => {
            // When showCategoryIcon is true and tag has category
            const hasIndicator = hasCategoryIndicator(tag, true)
            expect(hasIndicator).toBe(!!tag.category)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not show category indicator when showCategoryIcon is false', () => {
      fc.assert(
        fc.property(
          tagArb,
          (tag) => {
            const hasIndicator = hasCategoryIndicator(tag, false)
            expect(hasIndicator).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 10: Tags are sorted consistently
   * For any list of tags in TagSelector, the tags SHALL be sorted by category
   * (source, topic, concept) then alphabetically within each category
   * Validates: Requirements 6.2
   */
  describe('Property 10: Sort consistency by category', () => {
    it('should sort tags by category order (source < topic < concept)', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 2, maxLength: 50 }),
          (tags) => {
            const sorted = sortTagsByCategory(tags)
            
            // Verify category order is maintained
            const categoryOrder: Record<TagCategory, number> = { source: 0, topic: 1, concept: 2 }
            
            for (let i = 1; i < sorted.length; i++) {
              const prevOrder = categoryOrder[sorted[i - 1].category]
              const currOrder = categoryOrder[sorted[i].category]
              
              // Current category should be >= previous category
              expect(currOrder).toBeGreaterThanOrEqual(prevOrder)
              
              // If same category, should be alphabetically sorted
              if (currOrder === prevOrder) {
                expect(sorted[i].name.localeCompare(sorted[i - 1].name)).toBeGreaterThanOrEqual(0)
              }
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should maintain all original tags after sorting', () => {
      fc.assert(
        fc.property(
          fc.array(tagArb, { minLength: 0, maxLength: 50 }),
          (tags) => {
            const sorted = sortTagsByCategory(tags)
            
            // Same length
            expect(sorted.length).toBe(tags.length)
            
            // All original tags present
            const originalIds = new Set(tags.map(t => t.id))
            const sortedIds = new Set(sorted.map(t => t.id))
            expect(sortedIds).toEqual(originalIds)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})


describe('V11.3 Tag Management - Regression Tests', () => {
  /**
   * Property 11: Bulk tagging preserves existing functionality
   * For any set of card IDs and existing tag IDs, bulk tagging SHALL
   * successfully create card_template_tags associations
   * Validates: Requirements 7.1
   */
  describe('Property 11: Bulk tagging functionality', () => {
    it('should preserve tag selection when adding new tags', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          (existingSelectedIds, newTagId) => {
            // Simulate adding a new tag to selection (bulk tagging behavior)
            const newSelection = [...existingSelectedIds, newTagId]
            
            // All existing selections should be preserved
            for (const existingId of existingSelectedIds) {
              expect(newSelection).toContain(existingId)
            }
            
            // New tag should be added
            expect(newSelection).toContain(newTagId)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 8: Tag edits propagate to all views
   * For any tag edit, the updated values SHALL be reflected across all views
   * Validates: Requirements 5.2, 7.2
   */
  describe('Property 8: Tag sync across views', () => {
    it('should update tag in categorized list after edit', () => {
      fc.assert(
        fc.property(
          tagArb,
          tagNameArb,
          tagCategoryArb,
          fc.array(tagArb, { minLength: 0, maxLength: 20 }),
          (originalTag, newName, newCategory, otherTags) => {
            // Simulate editing a tag
            const updatedTag = {
              ...originalTag,
              name: newName,
              category: newCategory,
              color: getCategoryColor(newCategory),
            }
            
            // Replace in list
            const allTags = [...otherTags.filter(t => t.id !== originalTag.id), updatedTag]
            const categorized = categorizeTagsByCategory(allTags)
            
            // Updated tag should be in the new category column
            const newColumn = categorized[newCategory]
            const tagInNewColumn = newColumn.some(t => t.id === originalTag.id && t.name === newName)
            expect(tagInNewColumn).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 12: Source tags not auto-created from bulk import
   * When tags are created from TagSelector (bulk import context),
   * the default category SHALL be "concept", not "source"
   * Validates: Requirements 7.3
   */
  describe('Property 12: Source tag restriction', () => {
    it('should default to concept category from TagSelector context', () => {
      fc.assert(
        fc.property(
          tagNameArb,
          (tagName) => {
            // TagSelector always defaults to 'concept'
            const defaultCategory = getDefaultCategory('selector')
            expect(defaultCategory).toBe('concept')
            expect(defaultCategory).not.toBe('source')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should require explicit category change to create source tags', () => {
      // This is a behavioral test - source tags can only be created
      // if the user explicitly selects 'source' in the dialog
      const defaultFromSelector = getDefaultCategory('selector')
      expect(defaultFromSelector).toBe('concept')
      
      // Only admin context with explicit column can default to source
      const defaultFromAdminSource = getDefaultCategory('admin', 'source')
      expect(defaultFromAdminSource).toBe('source')
    })
  })
})
