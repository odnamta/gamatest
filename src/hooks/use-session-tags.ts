'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getUserTags } from '@/actions/tag-actions'
import type { Tag } from '@/types/database'

/**
 * Hook for managing session tags on the Bulk Import page.
 * 
 * Session tags are persisted in localStorage per deck and automatically
 * applied to all cards created from the Bulk Import page.
 * 
 * Requirements: R2.1 - Session Tag Selector
 */

const STORAGE_KEY_PREFIX = 'session_tags_'

/**
 * Get the localStorage key for a specific deck.
 */
function getStorageKey(deckId: string): string {
  return `${STORAGE_KEY_PREFIX}${deckId}`
}

/**
 * Safely read from localStorage.
 */
function readFromStorage(deckId: string): string[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(getStorageKey(deckId))
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    
    // Filter to only valid strings
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

/**
 * Safely write to localStorage.
 */
function writeToStorage(deckId: string, tagIds: string[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(getStorageKey(deckId), JSON.stringify(tagIds))
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
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
