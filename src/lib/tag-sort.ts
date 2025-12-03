/**
 * Tag Sorting Utility
 * V9.4: Visual Hierarchy - Enforces consistent tag ordering
 * Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4
 */

import type { Tag, TagCategory } from '@/types/database'

/**
 * Category priority for visual sorting
 * Lower number = higher priority (appears first)
 * Order: Source → Topic → Concept
 */
export const CATEGORY_PRIORITY: Record<TagCategory, number> = {
  source: 1,
  topic: 2,
  concept: 3,
}

/**
 * Default priority for tags without a category
 * Appears after all categorized tags
 */
export const UNCATEGORIZED_PRIORITY = 99

/**
 * Sorts tags by category priority (Source → Topic → Concept)
 * Within same category, sorts alphabetically by name
 * 
 * @param tags - Array of tags to sort
 * @returns New sorted array (does not mutate input)
 * 
 * V9.4: Requirements 1.1, 2.1, 2.2
 */
export function sortTagsByCategory(tags: Tag[]): Tag[] {
  if (tags.length === 0) return []
  
  return [...tags].sort((a, b) => {
    const priorityA = a.category ? CATEGORY_PRIORITY[a.category] : UNCATEGORIZED_PRIORITY
    const priorityB = b.category ? CATEGORY_PRIORITY[b.category] : UNCATEGORIZED_PRIORITY
    
    // Sort by category priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // Within same category, sort alphabetically
    return a.name.localeCompare(b.name)
  })
}
