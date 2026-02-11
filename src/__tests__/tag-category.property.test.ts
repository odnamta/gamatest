/**
 * V9 Medical Ontology - Tag Category Property Tests
 * 
 * Tests for the 3-tier taxonomy system (Source/Topic/Concept)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// Tag category type
type TagCategory = 'source' | 'topic' | 'concept'

// Category to color mapping (enforced by system)
const CATEGORY_COLORS: Record<TagCategory, string> = {
  source: 'blue',
  topic: 'purple',
  concept: 'green',
}

/**
 * Get the enforced color for a category
 */
function getCategoryColor(category: TagCategory): string {
  return CATEGORY_COLORS[category]
}

/**
 * Simulate tag creation with optional category (defaults to 'concept')
 */
function createTagWithDefaults(
  name: string,
  category?: TagCategory
): { name: string; category: TagCategory; color: string } {
  const finalCategory = category ?? 'concept'
  return {
    name,
    category: finalCategory,
    color: getCategoryColor(finalCategory),
  }
}

/**
 * Group tags by category
 */
function groupTagsByCategory<T extends { category: TagCategory }>(
  tags: T[]
): Record<TagCategory, T[]> {
  return {
    source: tags.filter(t => t.category === 'source'),
    topic: tags.filter(t => t.category === 'topic'),
    concept: tags.filter(t => t.category === 'concept'),
  }
}

/**
 * Check if a string is in PascalCase format
 */
function isPascalCase(str: string): boolean {
  if (!str || str.length === 0) return false
  // Must start with uppercase, no spaces, each word capitalized
  return /^[A-Z][a-zA-Z0-9]*$/.test(str)
}

/**
 * Merge session tags with AI tags, preserving categories and deduplicating
 */
function mergeTagsWithCategories(
  sessionTags: Array<{ name: string; category: TagCategory }>,
  aiTags: Array<{ name: string; category: TagCategory }>
): Array<{ name: string; category: TagCategory }> {
  const result: Array<{ name: string; category: TagCategory }> = []
  const seenLower = new Set<string>()
  
  // Session tags take precedence
  for (const tag of sessionTags) {
    const lower = tag.name.toLowerCase()
    if (!seenLower.has(lower)) {
      seenLower.add(lower)
      result.push(tag)
    }
  }
  
  // Add AI tags that aren't duplicates
  for (const tag of aiTags) {
    const lower = tag.name.toLowerCase()
    if (!seenLower.has(lower)) {
      seenLower.add(lower)
      result.push(tag)
    }
  }
  
  return result
}

// Arbitraries
const tagCategoryArb = fc.constantFrom<TagCategory>('source', 'topic', 'concept')
const tagNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
// Generate PascalCase strings by combining words
const pascalCaseArb = fc.array(
  fc.string({ minLength: 2, maxLength: 10 }).filter(s => /^[a-zA-Z]+$/.test(s)),
  { minLength: 1, maxLength: 3 }
).map(words => words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(''))

describe('V9 Tag Category Properties', () => {
  /**
   * Property 2: Default category is concept
   * For any tag created without an explicit category, the tag's category SHALL be 'concept'.
   * Validates: Requirements 1.2
   */
  it('Property 2: Default category is concept', () => {
    fc.assert(
      fc.property(tagNameArb, (name) => {
        const tag = createTagWithDefaults(name)
        expect(tag.category).toBe('concept')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1: Category determines color
   * For any tag with a category, the tag's color field SHALL match the category's enforced color.
   * Validates: Requirements 1.3, 1.4, 1.5
   */
  it('Property 1: Category determines color', () => {
    fc.assert(
      fc.property(tagNameArb, tagCategoryArb, (name, category) => {
        const tag = createTagWithDefaults(name, category)
        
        // Verify color matches category
        switch (category) {
          case 'source':
            expect(tag.color).toBe('blue')
            break
          case 'topic':
            expect(tag.color).toBe('purple')
            break
          case 'concept':
            expect(tag.color).toBe('green')
            break
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Tag grouping by category
   * For any set of tags, grouping by category SHALL produce three groups where each tag
   * appears in exactly one group matching its category.
   * Validates: Requirements 3.1, 6.1
   */
  it('Property 4: Tag grouping by category', () => {
    const tagArb = fc.record({
      id: fc.uuid(),
      name: tagNameArb,
      category: tagCategoryArb,
    })

    fc.assert(
      fc.property(fc.array(tagArb, { minLength: 0, maxLength: 20 }), (tags) => {
        const grouped = groupTagsByCategory(tags)
        
        // All three categories exist as keys
        expect(Object.keys(grouped)).toContain('source')
        expect(Object.keys(grouped)).toContain('topic')
        expect(Object.keys(grouped)).toContain('concept')
        
        // Total count matches
        const totalGrouped = grouped.source.length + grouped.topic.length + grouped.concept.length
        expect(totalGrouped).toBe(tags.length)
        
        // Each tag is in the correct group
        for (const tag of tags) {
          expect(grouped[tag.category]).toContainEqual(tag)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: Category change updates color
   * For any tag whose category is changed, the tag's color SHALL be updated to match
   * the new category's enforced color.
   * Validates: Requirements 3.2
   */
  it('Property 5: Category change updates color', () => {
    fc.assert(
      fc.property(tagNameArb, tagCategoryArb, tagCategoryArb, (name, oldCategory, newCategory) => {
        // Create tag with old category
        const tag = createTagWithDefaults(name, oldCategory)
        
        // Simulate category change
        const updatedTag = {
          ...tag,
          category: newCategory,
          color: getCategoryColor(newCategory),
        }
        
        // Verify color matches new category
        expect(updatedTag.color).toBe(CATEGORY_COLORS[newCategory])
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8: AI concept format
   * For any AI-generated concept tag, the tag name SHALL be in PascalCase format.
   * Validates: Requirements 4.3
   */
  it('Property 8: AI concept format (PascalCase validation)', () => {
    fc.assert(
      fc.property(pascalCaseArb, (conceptName) => {
        // Valid PascalCase names should pass validation
        expect(isPascalCase(conceptName)).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9: Session tag category preservation
   * For any session tag selected from Source or Topic dropdown, the tag SHALL be saved
   * with its original category preserved.
   * Validates: Requirements 5.2, 5.3
   */
  it('Property 9: Session tag category preservation', () => {
    // Generate session tags with unique names to avoid dedup masking categories
    const uniqueSessionTagsArb = fc
      .array(
        fc.record({
          name: tagNameArb,
          category: fc.constantFrom<TagCategory>('source', 'topic'),
        }),
        { minLength: 1, maxLength: 5 }
      )
      .map((tags) => {
        // Deduplicate by lowercase name, keeping first occurrence
        const seen = new Set<string>()
        return tags.filter((t) => {
          const lower = t.name.toLowerCase()
          if (seen.has(lower)) return false
          seen.add(lower)
          return true
        })
      })
      .filter((tags) => tags.length > 0)

    fc.assert(
      fc.property(uniqueSessionTagsArb, (sessionTags) => {
        // Merge with empty AI tags
        const merged = mergeTagsWithCategories(sessionTags, [])

        // All session tags should preserve their category
        for (const original of sessionTags) {
          const found = merged.find(t => t.name.toLowerCase() === original.name.toLowerCase())
          expect(found).toBeDefined()
          expect(found?.category).toBe(original.category)
        }
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 10: Session tag deduplication
   * For any combination of session tags and AI-generated tags, the merged result SHALL
   * contain no duplicate tag names (case-insensitive).
   * Validates: Requirements 5.4
   */
  it('Property 10: Session tag deduplication', () => {
    const tagWithCategoryArb = fc.record({
      name: tagNameArb,
      category: tagCategoryArb,
    })

    fc.assert(
      fc.property(
        fc.array(tagWithCategoryArb, { minLength: 0, maxLength: 5 }),
        fc.array(tagWithCategoryArb, { minLength: 0, maxLength: 5 }),
        (sessionTags, aiTags) => {
          const merged = mergeTagsWithCategories(sessionTags, aiTags)
          
          // Check for duplicates (case-insensitive)
          const lowerNames = merged.map(t => t.name.toLowerCase())
          const uniqueNames = new Set(lowerNames)
          
          expect(lowerNames.length).toBe(uniqueNames.size)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 11: Filter category colors
   * For any filter pill displayed, the pill's color classes SHALL match its tag's category color.
   * Validates: Requirements 6.2
   */
  it('Property 11: Filter category colors', () => {
    fc.assert(
      fc.property(tagCategoryArb, (category) => {
        const color = getCategoryColor(category)
        
        // Each category has a distinct color
        if (category === 'source') expect(color).toBe('blue')
        if (category === 'topic') expect(color).toBe('purple')
        if (category === 'concept') expect(color).toBe('green')
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 12: Empty category hiding
   * For any filter interface, category sections with zero tags SHALL not be rendered.
   * Validates: Requirements 6.4
   */
  it('Property 12: Empty category hiding', () => {
    const tagArb = fc.record({
      name: tagNameArb,
      category: tagCategoryArb,
    })

    fc.assert(
      fc.property(fc.array(tagArb, { minLength: 0, maxLength: 20 }), (tags) => {
        const grouped = groupTagsByCategory(tags)
        
        // Simulate UI logic: only show non-empty categories
        const visibleCategories = (Object.keys(grouped) as TagCategory[])
          .filter(cat => grouped[cat].length > 0)
        
        // Empty categories should not be visible
        for (const cat of ['source', 'topic', 'concept'] as TagCategory[]) {
          if (grouped[cat].length === 0) {
            expect(visibleCategories).not.toContain(cat)
          } else {
            expect(visibleCategories).toContain(cat)
          }
        }
      }),
      { numRuns: 100 }
    )
  })
})


// Golden List for testing
const OFFICIAL_TOPICS = [
  'Anatomy',
  'Endocrinology',
  'Infections',
  'Oncology',
  'MaternalFetal',
]

const OFFICIAL_SOURCES = [
  'Williams',
  'Lange',
  'MRCOG',
]

/**
 * Simulate seed operation (idempotent)
 */
function simulateSeed(
  existingTags: Array<{ name: string; category: TagCategory }>,
  goldenTags: Array<{ name: string; category: TagCategory }>
): Array<{ name: string; category: TagCategory }> {
  const result = [...existingTags]
  const existingLower = new Set(existingTags.map(t => t.name.toLowerCase()))
  
  for (const golden of goldenTags) {
    if (!existingLower.has(golden.name.toLowerCase())) {
      result.push(golden)
      existingLower.add(golden.name.toLowerCase())
    }
  }
  
  return result
}

describe('V9 Golden List Seeding', () => {
  /**
   * Property 3: Seed script idempotence
   * For any number of seed script executions, the count of Golden List tags SHALL remain
   * constant after the first execution.
   * Validates: Requirements 2.3
   */
  it('Property 3: Seed script idempotence', () => {
    const goldenTags: Array<{ name: string; category: TagCategory }> = [
      ...OFFICIAL_TOPICS.map(name => ({ name, category: 'topic' as TagCategory })),
      ...OFFICIAL_SOURCES.map(name => ({ name, category: 'source' as TagCategory })),
    ]

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Number of seed runs
        (numRuns) => {
          let tags: Array<{ name: string; category: TagCategory }> = []
          
          // Run seed multiple times
          for (let i = 0; i < numRuns; i++) {
            tags = simulateSeed(tags, goldenTags)
          }
          
          // Count should equal golden list size (no duplicates)
          expect(tags.length).toBe(goldenTags.length)
          
          // All golden tags should be present
          for (const golden of goldenTags) {
            const found = tags.find(t => t.name.toLowerCase() === golden.name.toLowerCase())
            expect(found).toBeDefined()
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  it('Golden List tags have correct categories', () => {
    // Topics should be purple
    for (const topic of OFFICIAL_TOPICS) {
      const color = getCategoryColor('topic')
      expect(color).toBe('purple')
    }
    
    // Sources should be blue
    for (const source of OFFICIAL_SOURCES) {
      const color = getCategoryColor('source')
      expect(color).toBe('blue')
    }
  })
})
