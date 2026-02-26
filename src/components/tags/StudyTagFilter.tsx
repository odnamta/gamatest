'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Tag } from '@/types/database'

const STORAGE_KEY = 'study-tag-filter'

export interface StudyTagFilterProps {
  tags: Tag[]
  onSelectionChange: (tagIds: string[]) => void
  initialSelection?: string[]
}

/**
 * Load saved tag selection from localStorage.
 * Returns empty array if not found or invalid.
 */
function loadSavedSelection(): string[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed.selectedTagIds)) {
      return parsed.selectedTagIds
    }
    return []
  } catch {
    return []
  }
}

/**
 * Save tag selection to localStorage.
 */
function saveSelection(tagIds: string[]): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      selectedTagIds: tagIds,
      updatedAt: Date.now(),
    }))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Filter tags to only include topic and source categories.
 * 
 * **Property 6: Tag filter loads only topic/source categories**
 * **Validates: Requirements 3.2**
 */
export function filterStudyTags(tags: Tag[]): Tag[] {
  return tags.filter(tag => tag.category === 'topic' || tag.category === 'source')
}

/**
 * StudyTagFilter Component
 * Multi-select tag filter for global study sessions.
 * Persists selection to localStorage.
 * 
 * **Feature: v11.7-companion-dashboard-tag-filtered-study**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7**
 */
export function StudyTagFilter({
  tags,
  onSelectionChange,
  initialSelection,
}: StudyTagFilterProps) {
  // Filter to topic/source tags only
  const filteredTags = filterStudyTags(tags)

  // Initialize selection from localStorage or props (computed once)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const savedSelection = loadSavedSelection()
    const initial = initialSelection?.length ? initialSelection : savedSelection
    const validIds = initial.filter(id =>
      tags.some(tag => (tag.category === 'topic' || tag.category === 'source') && tag.id === id)
    )
    return new Set(validIds)
  })

  // Notify parent of initial selection on mount
  useEffect(() => {
    if (selectedIds.size > 0) {
      onSelectionChange(Array.from(selectedIds))
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle tag selection
  const toggleTag = useCallback((tagId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) {
        next.delete(tagId)
      } else {
        next.add(tagId)
      }
      
      const newSelection = Array.from(next)
      saveSelection(newSelection)
      onSelectionChange(newSelection)
      
      return next
    })
  }, [onSelectionChange])

  // Clear all selections
  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
    saveSelection([])
    onSelectionChange([])
  }, [onSelectionChange])

  if (filteredTags.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Filter by topic
        </span>
        {selectedIds.size > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      
      {/* Tag chips - flex-wrap for mobile */}
      <div className="flex flex-wrap gap-2">
        {filteredTags.map(tag => {
          const isSelected = selectedIds.has(tag.id)
          
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-150 active:scale-95
                ${isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }
              `}
              style={isSelected ? {} : { borderLeft: `3px solid ${tag.color}` }}
            >
              {tag.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
