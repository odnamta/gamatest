/**
 * V8.3: Deduplication utility functions
 * Pure functions for identifying duplicate cards.
 * V13: Added deduplicateMCQBatch for batch MCQ pipeline dedup.
 */

/**
 * V8.3: Normalize stem for comparison.
 * Converts to lowercase, trims whitespace, and collapses internal whitespace.
 */
export function normalizeStem(stem: string | null): string {
  return (stem || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * Result type for batch MCQ deduplication.
 */
export interface DeduplicateMCQBatchResult<T extends { stem: string }> {
  /** Deduplicated array with first occurrence of each unique stem kept */
  unique: T[]
  /** Number of duplicates removed from the input */
  removedCount: number
}

/**
 * V13: Deduplicate an array of MCQ objects by normalized stem.
 *
 * - Normalizes stems (lowercase, trim, collapse whitespace)
 * - Keeps the first occurrence of each unique normalized stem
 * - Preserves original array order
 * - Optionally checks against a set of existing stems to skip
 *
 * @param items - Array of objects with a `stem` field
 * @param existingStems - Optional set of already-normalized stems to skip (e.g., from DB)
 * @returns Deduplicated array and count of removed duplicates
 */
export function deduplicateMCQBatch<T extends { stem: string }>(
  items: T[],
  existingStems?: Set<string>,
): DeduplicateMCQBatchResult<T> {
  const seen = new Set<string>(existingStems)
  const unique: T[] = []
  let removedCount = 0

  for (const item of items) {
    const normalized = normalizeStem(item.stem)
    if (!normalized) {
      // Keep items with empty stems (they won't match anything meaningful)
      unique.push(item)
      continue
    }
    if (seen.has(normalized)) {
      removedCount++
    } else {
      seen.add(normalized)
      unique.push(item)
    }
  }

  return { unique, removedCount }
}

/**
 * V8.3: Pure function to identify duplicate cards.
 * Returns array of card IDs to delete (keeps oldest per stem).
 */
export function identifyDuplicates(
  cards: Array<{ id: string; stem: string | null; created_at: string }>
): string[] {
  // Group by normalized stem
  const stemGroups = new Map<string, typeof cards>()

  for (const card of cards) {
    const normalizedStem = normalizeStem(card.stem)
    if (!normalizedStem) continue // Skip empty stems

    const group = stemGroups.get(normalizedStem) || []
    group.push(card)
    stemGroups.set(normalizedStem, group)
  }

  // For each group with duplicates, keep oldest, mark rest for deletion
  const toDelete: string[] = []

  for (const [, group] of stemGroups) {
    if (group.length <= 1) continue // No duplicates

    // Sort by created_at ascending (oldest first)
    group.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Keep first (oldest), delete rest
    for (let i = 1; i < group.length; i++) {
      toDelete.push(group[i].id)
    }
  }

  return toDelete
}
