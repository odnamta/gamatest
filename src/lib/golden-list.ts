/**
 * Golden List Configuration
 * V9.2: Curated set of standard Topic tags for AI classification
 *
 * Requirements: 4.1, 4.2, 4.4
 */

/**
 * The Golden List of approved Topic tags for assessment topic management.
 * AI classification will only suggest topics from this list.
 */
export const GOLDEN_TOPIC_TAGS = [
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
] as const

/**
 * Type-safe Golden Topic Tag type.
 * Use this for type checking when working with topic tags.
 */
export type GoldenTopicTag = typeof GOLDEN_TOPIC_TAGS[number]

/**
 * Check if a string is a valid Golden Topic Tag.
 * Case-insensitive comparison.
 *
 * @param tag - The tag name to validate
 * @returns true if the tag is in the Golden List
 */
export function isGoldenTopicTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase()
  return GOLDEN_TOPIC_TAGS.some(t => t.toLowerCase() === normalized)
}

/**
 * Get the canonical form of a Golden Topic Tag.
 * Returns the properly cased version from the Golden List.
 *
 * @param tag - The tag name to normalize
 * @returns The canonical tag name, or null if not in Golden List
 */
export function getCanonicalTopicTag(tag: string): GoldenTopicTag | null {
  const normalized = tag.trim().toLowerCase()
  const found = GOLDEN_TOPIC_TAGS.find(t => t.toLowerCase() === normalized)
  return found ?? null
}

/**
 * Validate an array of topic tags against the Golden List.
 * Returns only the valid tags in their canonical form.
 *
 * @param tags - Array of tag names to validate
 * @returns Array of valid canonical tag names
 */
export function validateTopicTags(tags: string[]): GoldenTopicTag[] {
  const result: GoldenTopicTag[] = []
  for (const tag of tags) {
    const canonical = getCanonicalTopicTag(tag)
    if (canonical && !result.includes(canonical)) {
      result.push(canonical)
    }
  }
  return result
}
