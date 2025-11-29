import { describe, test, expect } from 'vitest'
import fc from 'fast-check'

/**
 * Tag Operations Property-Based Tests
 * 
 * These tests verify the tagging system correctness properties from the design document.
 * 
 * **Feature: v5-content-workstation, Properties 1-3**
 * **Validates: Requirements 1.1, 1.2, 1.5, 1.6**
 */

// Types for testing
interface Tag {
  id: string
  user_id: string
  name: string
  color: string
}

interface CardTag {
  card_id: string
  tag_id: string
}

// Simulated tag store for testing pure logic
class TagStore {
  private tags: Map<string, Tag> = new Map()
  private cardTags: Map<string, Set<string>> = new Map() // card_id -> Set<tag_id>

  createTag(userId: string, name: string, color: string): { ok: true; tag: Tag } | { ok: false; error: string } {
    // Check uniqueness per user
    for (const tag of this.tags.values()) {
      if (tag.user_id === userId && tag.name === name) {
        return { ok: false, error: `Tag "${name}" already exists` }
      }
    }

    const tag: Tag = {
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      color,
    }
    this.tags.set(tag.id, tag)
    return { ok: true, tag }
  }

  deleteTag(tagId: string): void {
    this.tags.delete(tagId)
    // Cascade delete from card_tags
    for (const [cardId, tagIds] of this.cardTags.entries()) {
      tagIds.delete(tagId)
    }
  }

  assignTagToCard(cardId: string, tagId: string): void {
    if (!this.cardTags.has(cardId)) {
      this.cardTags.set(cardId, new Set())
    }
    this.cardTags.get(cardId)!.add(tagId)
  }

  deleteCard(cardId: string): void {
    this.cardTags.delete(cardId)
  }

  getTagsForCard(cardId: string): string[] {
    return Array.from(this.cardTags.get(cardId) || [])
  }

  hasTag(tagId: string): boolean {
    return this.tags.has(tagId)
  }

  getTagsByUser(userId: string): Tag[] {
    return Array.from(this.tags.values()).filter(t => t.user_id === userId)
  }
}

// Arbitraries
const userIdArb = fc.uuid()
const tagNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
const colorArb = fc.constantFrom(
  'bg-red-100',
  'bg-blue-100',
  'bg-green-100',
  'bg-yellow-100',
  'bg-purple-100'
)
const cardIdArb = fc.uuid()

describe('Property 1: Tag Uniqueness Per User', () => {
  /**
   * **Validates: Requirements 1.1, 1.2**
   * 
   * For any user, creating a tag with a name that already exists for that user
   * should be rejected, preserving the uniqueness constraint.
   */
  test('Creating duplicate tag name for same user fails', () => {
    fc.assert(
      fc.property(userIdArb, tagNameArb, colorArb, colorArb, (userId, name, color1, color2) => {
        const store = new TagStore()
        
        // First creation should succeed
        const result1 = store.createTag(userId, name, color1)
        expect(result1.ok).toBe(true)
        
        // Second creation with same name should fail
        const result2 = store.createTag(userId, name, color2)
        expect(result2.ok).toBe(false)
        if (!result2.ok) {
          expect(result2.error).toContain('already exists')
        }
      }),
      { numRuns: 100 }
    )
  })

  test('Same tag name for different users succeeds', () => {
    fc.assert(
      fc.property(userIdArb, userIdArb, tagNameArb, colorArb, (userId1, userId2, name, color) => {
        // Skip if same user
        fc.pre(userId1 !== userId2)
        
        const store = new TagStore()
        
        // First user creates tag
        const result1 = store.createTag(userId1, name, color)
        expect(result1.ok).toBe(true)
        
        // Second user creates same tag name - should succeed
        const result2 = store.createTag(userId2, name, color)
        expect(result2.ok).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  test('User can have multiple tags with different names', () => {
    fc.assert(
      fc.property(
        userIdArb,
        fc.array(tagNameArb, { minLength: 2, maxLength: 5 }),
        colorArb,
        (userId, names, color) => {
          // Ensure unique names
          const uniqueNames = [...new Set(names)]
          fc.pre(uniqueNames.length >= 2)
          
          const store = new TagStore()
          
          // All unique names should succeed
          for (const name of uniqueNames) {
            const result = store.createTag(userId, name, color)
            expect(result.ok).toBe(true)
          }
          
          // User should have all tags
          const userTags = store.getTagsByUser(userId)
          expect(userTags.length).toBe(uniqueNames.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 2: Tag Cascade Delete', () => {
  /**
   * **Validates: Requirements 1.6**
   * 
   * For any tag that is deleted, all card_tags associations referencing that tag
   * should also be deleted, leaving no orphaned references.
   */
  test('Deleting tag removes all card associations', () => {
    fc.assert(
      fc.property(
        userIdArb,
        tagNameArb,
        colorArb,
        fc.array(cardIdArb, { minLength: 1, maxLength: 5 }),
        (userId, name, color, cardIds) => {
          const store = new TagStore()
          
          // Create tag
          const result = store.createTag(userId, name, color)
          expect(result.ok).toBe(true)
          if (!result.ok) return
          
          const tagId = result.tag.id
          
          // Assign tag to multiple cards
          for (const cardId of cardIds) {
            store.assignTagToCard(cardId, tagId)
          }
          
          // Verify assignments exist
          for (const cardId of cardIds) {
            expect(store.getTagsForCard(cardId)).toContain(tagId)
          }
          
          // Delete the tag
          store.deleteTag(tagId)
          
          // Verify tag is gone
          expect(store.hasTag(tagId)).toBe(false)
          
          // Verify all card associations are gone
          for (const cardId of cardIds) {
            expect(store.getTagsForCard(cardId)).not.toContain(tagId)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Property 3: Card Cascade Delete', () => {
  /**
   * **Validates: Requirements 1.5**
   * 
   * For any card that is deleted, all card_tags associations for that card
   * should also be deleted.
   */
  test('Deleting card removes all tag associations for that card', () => {
    fc.assert(
      fc.property(
        userIdArb,
        cardIdArb,
        fc.array(tagNameArb, { minLength: 1, maxLength: 3 }),
        colorArb,
        (userId, cardId, tagNames, color) => {
          const uniqueNames = [...new Set(tagNames)]
          fc.pre(uniqueNames.length >= 1)
          
          const store = new TagStore()
          const tagIds: string[] = []
          
          // Create tags
          for (const name of uniqueNames) {
            const result = store.createTag(userId, name, color)
            if (result.ok) {
              tagIds.push(result.tag.id)
            }
          }
          
          // Assign all tags to the card
          for (const tagId of tagIds) {
            store.assignTagToCard(cardId, tagId)
          }
          
          // Verify assignments exist
          expect(store.getTagsForCard(cardId).length).toBe(tagIds.length)
          
          // Delete the card
          store.deleteCard(cardId)
          
          // Verify card has no tags
          expect(store.getTagsForCard(cardId).length).toBe(0)
          
          // Tags themselves should still exist
          for (const tagId of tagIds) {
            expect(store.hasTag(tagId)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ============================================
// Property 4: Tag Filter Intersection
// ============================================

interface CardWithTags {
  id: string
  tags: string[] // tag IDs
}

/**
 * Pure function that filters cards by tag intersection (AND logic)
 */
function filterCardsByTags(cards: CardWithTags[], filterTagIds: string[]): CardWithTags[] {
  if (filterTagIds.length === 0) return cards
  return cards.filter((card) => {
    return filterTagIds.every((tagId) => card.tags.includes(tagId))
  })
}

describe('Property 4: Tag Filter Intersection', () => {
  /**
   * **Validates: Requirements 1.8**
   * 
   * For any set of selected filter tags, the filtered card list should contain
   * only cards that have ALL selected tags (AND logic).
   */
  
  const cardIdArb = fc.uuid()
  const tagIdArb = fc.uuid()
  
  const cardWithTagsArb = fc.record({
    id: cardIdArb,
    tags: fc.array(tagIdArb, { minLength: 0, maxLength: 5 }),
  })

  test('Empty filter returns all cards', () => {
    fc.assert(
      fc.property(
        fc.array(cardWithTagsArb, { minLength: 0, maxLength: 10 }),
        (cards) => {
          const filtered = filterCardsByTags(cards, [])
          expect(filtered.length).toBe(cards.length)
          expect(filtered).toEqual(cards)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Filtered cards always contain all filter tags', () => {
    fc.assert(
      fc.property(
        fc.array(cardWithTagsArb, { minLength: 1, maxLength: 10 }),
        fc.array(tagIdArb, { minLength: 1, maxLength: 3 }),
        (cards, filterTags) => {
          const filtered = filterCardsByTags(cards, filterTags)
          
          // Every filtered card must have ALL filter tags
          for (const card of filtered) {
            for (const tagId of filterTags) {
              expect(card.tags).toContain(tagId)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Cards missing any filter tag are excluded', () => {
    fc.assert(
      fc.property(
        fc.array(cardWithTagsArb, { minLength: 1, maxLength: 10 }),
        fc.array(tagIdArb, { minLength: 1, maxLength: 3 }),
        (cards, filterTags) => {
          const filtered = filterCardsByTags(cards, filterTags)
          const filteredIds = new Set(filtered.map(c => c.id))
          
          // Cards not in filtered list must be missing at least one filter tag
          for (const card of cards) {
            if (!filteredIds.has(card.id)) {
              const hasAllTags = filterTags.every(tagId => card.tags.includes(tagId))
              expect(hasAllTags).toBe(false)
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('Filter result is subset of original cards', () => {
    fc.assert(
      fc.property(
        fc.array(cardWithTagsArb, { minLength: 0, maxLength: 10 }),
        fc.array(tagIdArb, { minLength: 0, maxLength: 3 }),
        (cards, filterTags) => {
          const filtered = filterCardsByTags(cards, filterTags)
          
          expect(filtered.length).toBeLessThanOrEqual(cards.length)
          
          const originalIds = new Set(cards.map(c => c.id))
          for (const card of filtered) {
            expect(originalIds.has(card.id)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
