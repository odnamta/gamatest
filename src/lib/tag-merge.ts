/**
 * Tag Merge Utility
 * 
 * Merges session tags and AI-suggested tags with normalization and deduplication.
 * 
 * Requirements: R1.5 - Tag Handling for Batch Drafts, R2.3 - Interaction with Existing Tags
 */

/**
 * Normalize a tag name for comparison.
 * Trims whitespace and converts to lowercase.
 */
export function normalizeTagName(tag: string): string {
  return tag.trim().toLowerCase()
}

/**
 * Merge session tags and AI tags with deduplication.
 * 
 * - Session tags take precedence (appear first)
 * - AI tags are added if they don't duplicate session tags (case-insensitive)
 * - All tags are trimmed
 * - Empty tags are filtered out
 * 
 * Property 9: Tag merge produces unique normalized tags
 * 
 * @param sessionTags - Tags from session presets (already selected by user)
 * @param aiTags - Tags suggested by AI for this draft
 * @returns Merged array of unique tag names
 */
export function mergeAndDeduplicateTags(
  sessionTags: string[],
  aiTags: string[]
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  // Process session tags first (they take precedence)
  for (const tag of sessionTags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    
    const normalized = normalizeTagName(trimmed)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(trimmed) // Keep original casing from session
    }
  }

  // Process AI tags (skip duplicates)
  for (const tag of aiTags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    
    const normalized = normalizeTagName(trimmed)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(trimmed) // Keep original casing from AI
    }
  }

  return result
}

/**
 * Check if two tag arrays have any duplicates (case-insensitive).
 * Useful for validation.
 */
export function hasTagDuplicates(tags: string[]): boolean {
  const seen = new Set<string>()
  for (const tag of tags) {
    const normalized = normalizeTagName(tag)
    if (seen.has(normalized)) {
      return true
    }
    seen.add(normalized)
  }
  return false
}

/**
 * Remove duplicates from a single tag array (case-insensitive).
 * Preserves first occurrence.
 */
export function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    
    const normalized = normalizeTagName(trimmed)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(trimmed)
    }
  }
  
  return result
}
