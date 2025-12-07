'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getUserTags } from '@/actions/tag-actions'
import { getImportContext, updateImportContext } from '@/lib/import-context-storage'
import type { Tag } from '@/types/database'

/**
 * Hook for managing session tags on the Bulk Import page.
 * 
 * V11.1: Session tags are now persisted via unified import context storage.
 * Session tags are persisted in localStorage per deck and automatically
 * applied to all cards created from the Bulk Import page.
 * 
 * Requirements: R2.1 - Session Tag Selector, V11.1 5.3, 5.4
 */

/**
 * Safely read session tag IDs from import context storage.
 * V11.1: Uses unified import context storage
 */
function readFromStorage(deckId: string): string[] {
  const context = getImportContext(deckId)
  return context.sessionTagIds
}

/**
 * Safely write session tag IDs to import context storage.
 * V11.1: Uses unified import context storage
 */
function writeToStorage(deckId: string, tagIds: string[]): void {
  updateImportContext(deckId, { sessionTagIds: tagIds })
}

export interface UseSessionTagsReturn {
  /** Currently selected session tag IDs */
  sessionTagIds: string[]
  /** Update session tag IDs (persists to localStorage) */
  setSessionTagIds: (ids: string[]) => void
  /** Tag names resolved from IDs (for display and API calls) */
  sessionTagNames: string[]
  /** All available tags for the user */
  allTags: Tag[]
  /** Whether tags are still loading */
  isLoading: boolean
}

/**
 * Hook for managing session tags with localStorage persistence.
 * 
 * Property 16: Session tags localStorage round-trip
 * 
 * @param deckId - The deck ID to scope session tags to
 * @returns Session tag state and helpers
 */
export function useSessionTags(deckId: string): UseSessionTagsReturn {
  const [sessionTagIds, setSessionTagIdsState] = useState<string[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load tags and restore session tags from localStorage on mount
  useEffect(() => {
    async function loadTags() {
      setIsLoading(true)
      
      // Fetch all user tags
      const tags = await getUserTags()
      setAllTags(tags)
      
      // Restore session tags from localStorage
      const storedIds = readFromStorage(deckId)
      
      // Filter to only IDs that still exist
      const validIds = storedIds.filter((id) => tags.some((tag) => tag.id === id))
      setSessionTagIdsState(validIds)
      
      // Update storage if some IDs were invalid
      if (validIds.length !== storedIds.length) {
        writeToStorage(deckId, validIds)
      }
      
      setIsLoading(false)
    }
    
    loadTags()
  }, [deckId])

  // Update session tags and persist to localStorage
  const setSessionTagIds = useCallback(
    (ids: string[]) => {
      setSessionTagIdsState(ids)
      writeToStorage(deckId, ids)
    },
    [deckId]
  )

  // Compute tag names from IDs
  const sessionTagNames = useMemo(() => {
    return sessionTagIds
      .map((id) => allTags.find((tag) => tag.id === id)?.name)
      .filter((name): name is string => name !== undefined)
  }, [sessionTagIds, allTags])

  return {
    sessionTagIds,
    setSessionTagIds,
    sessionTagNames,
    allTags,
    isLoading,
  }
}
