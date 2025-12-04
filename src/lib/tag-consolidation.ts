/**
 * Tag Consolidation Utilities
 * V9.6: AI-powered tag analysis and merge suggestion processing
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3
 */

// ============================================
// Types
// ============================================

/**
 * Raw AI response structure from OpenAI
 */
export interface AIConsolidationResponse {
  groups: Array<{
    master: string
    variations: string[]
  }>
}

/**
 * Resolved merge suggestion with database IDs
 */
export interface MergeSuggestion {
  masterTagId: string
  masterTagName: string
  variations: Array<{
    tagId: string
    tagName: string
  }>
}

/**
 * Tag lookup entry for resolution
 */
export interface TagEntry {
  id: string
  name: string
}

// ============================================
// Constants
// ============================================

/** Threshold for single-batch processing */
const SINGLE_BATCH_THRESHOLD = 200

/** Maximum tags per batch when batching is needed */
const BATCH_SIZE = 100

// ============================================
// Batching Functions
// ============================================

/**
 * Batch tags for API processing.
 * Single batch if < 200 tags, otherwise chunks of 100.
 * 
 * Requirements: 1.2, 1.3
 * 
 * @param tags - Array of tag names to batch
 * @returns Array of batches, each containing up to 100 tags
 */
export function batchTagsForAnalysis(tags: string[]): string[][] {
  if (tags.length === 0) {
    return []
  }

  // Single batch for small lists
  if (tags.length < SINGLE_BATCH_THRESHOLD) {
    return [tags]
  }

  // Chunk into batches of 100
  const batches: string[][] = []
  for (let i = 0; i < tags.length; i += BATCH_SIZE) {
    batches.push(tags.slice(i, i + BATCH_SIZE))
  }

  return batches
}

// ============================================
// Parsing Functions
// ============================================

/**
 * Parse AI JSON response into structured format.
 * Handles malformed JSON gracefully by returning empty array.
 * 
 * Requirements: 1.4, 2.1
 * 
 * @param response - Raw JSON string from OpenAI
 * @returns Parsed AIConsolidationResponse or null if invalid
 */
export function parseConsolidationResponse(response: string): AIConsolidationResponse | null {
  try {
    const parsed = JSON.parse(response)
    
    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      return null
    }

    if (!Array.isArray(parsed.groups)) {
      return null
    }

    // Validate and normalize each group
    const normalizedGroups: Array<{ master: string; variations: string[] }> = []
    
    for (const group of parsed.groups) {
      if (typeof group.master !== 'string') {
        return null
      }
      
      const trimmedMaster = group.master.trim()
      if (!trimmedMaster) {
        return null
      }
      
      if (!Array.isArray(group.variations)) {
        return null
      }
      
      // Ensure all variations are strings
      if (!group.variations.every((v: unknown) => typeof v === 'string')) {
        return null
      }
      
      normalizedGroups.push({
        master: trimmedMaster,
        variations: group.variations.map((v: string) => v.trim()).filter((v: string) => v),
      })
    }

    return { groups: normalizedGroups }
  } catch {
    return null
  }
}

// ============================================
// Resolution Functions
// ============================================

/**
 * Build a case-insensitive lookup map from tag entries.
 * 
 * @param tags - Array of tag entries with id and name
 * @returns Map from lowercase name to tag entry
 */
export function buildTagLookup(tags: TagEntry[]): Map<string, TagEntry> {
  const lookup = new Map<string, TagEntry>()
  for (const tag of tags) {
    lookup.set(tag.name.toLowerCase(), tag)
  }
  return lookup
}

/**
 * Resolve AI suggestions to database tag IDs.
 * - Case-insensitive matching
 * - Prefers existing tag IDs for master
 * - Filters out non-existent variations
 * 
 * Requirements: 1.5, 2.2, 2.3
 * 
 * @param aiResponse - Parsed AI response
 * @param tagLookup - Map from lowercase name to tag entry
 * @returns Array of resolved merge suggestions
 */
export function resolveTagSuggestions(
  aiResponse: AIConsolidationResponse,
  tagLookup: Map<string, TagEntry>
): MergeSuggestion[] {
  const suggestions: MergeSuggestion[] = []

  for (const group of aiResponse.groups) {
    // Resolve master tag (case-insensitive)
    const masterKey = group.master.toLowerCase()
    const masterTag = tagLookup.get(masterKey)

    if (!masterTag) {
      // Master tag doesn't exist in database, skip this group
      continue
    }

    // Resolve variations (filter out non-existent)
    const variations: Array<{ tagId: string; tagName: string }> = []
    for (const variation of group.variations) {
      const variationKey = variation.toLowerCase()
      const variationTag = tagLookup.get(variationKey)

      if (variationTag && variationTag.id !== masterTag.id) {
        variations.push({
          tagId: variationTag.id,
          tagName: variationTag.name,
        })
      }
    }

    // Only include groups with at least one variation
    if (variations.length > 0) {
      suggestions.push({
        masterTagId: masterTag.id,
        masterTagName: masterTag.name,
        variations,
      })
    }
  }

  return suggestions
}
