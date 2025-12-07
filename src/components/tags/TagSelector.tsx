'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronDown, Plus, Check, Search } from 'lucide-react'
import { TagBadge } from './TagBadge'
import { getTagColorClasses } from '@/lib/tag-colors'
import { getUserTags, createTag } from '@/actions/tag-actions'
import { useToast } from '@/components/ui/Toast'
import type { Tag } from '@/types/database'

interface TagSelectorProps {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  maxSelections?: number // Optional limit on number of selections
}

/**
 * TagSelector - Multi-select dropdown with inline tag creation
 * V11.1: Enhanced with search input and "Create at Top" UX
 * Requirements: V5 Feature Set 1 - Req 1.3, V11.1 - Req 2.1-2.5
 */
export function TagSelector({ selectedTagIds, onChange, maxSelections }: TagSelectorProps) {
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // V11.1: Search query state
  const [searchQuery, setSearchQuery] = useState('')
  
  // V11.1: Keyboard navigation state
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  // Load tags on mount
  useEffect(() => {
    async function loadTags() {
      const userTags = await getUserTags()
      setTags(userTags)
      setIsLoading(false)
    }
    loadTags()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  // V11.1: Filter tags by search query (case-insensitive)
  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return tags
    const query = searchQuery.toLowerCase().trim()
    return tags.filter(tag => tag.name.toLowerCase().includes(query))
  }, [tags, searchQuery])

  // V11.1: Determine if Create option should be shown
  // Show when: query non-empty AND no exact match (case-insensitive)
  const shouldShowCreateOption = useMemo(() => {
    const query = searchQuery.trim()
    if (!query) return false
    const exactMatch = tags.some(tag => tag.name.toLowerCase() === query.toLowerCase())
    return !exactMatch
  }, [searchQuery, tags])

  // V11.1: Total navigable items (Create option + filtered tags)
  const totalItems = (shouldShowCreateOption ? 1 : 0) + filteredTags.length

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(shouldShowCreateOption ? 0 : (filteredTags.length > 0 ? 0 : -1))
  }, [shouldShowCreateOption, filteredTags.length])

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      // If maxSelections is set and we're at the limit, replace the last selection
      if (maxSelections && selectedTagIds.length >= maxSelections) {
        onChange([tagId])
      } else {
        onChange([...selectedTagIds, tagId])
      }
    }
  }

  // V11.1: Create tag from search query
  const handleCreateFromSearch = async () => {
    const tagName = searchQuery.trim()
    if (!tagName) return
    
    setIsCreating(true)
    const result = await createTag(tagName, 'concept') // Default to concept category
    setIsCreating(false)

    if (result.ok && result.tag) {
      setTags((prev) => [...prev, result.tag!].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...selectedTagIds, result.tag.id])
      setSearchQuery('')
      showToast(`Tag "${result.tag.name}" created`, 'success')
    } else if (!result.ok) {
      showToast(result.error, 'error')
    }
  }

  // V11.1: Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => Math.min(prev + 1, totalItems - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex === -1) return
        
        // If Create option is shown and highlighted (index 0)
        if (shouldShowCreateOption && highlightedIndex === 0) {
          handleCreateFromSearch()
        } else {
          // Adjust index for filtered tags (subtract 1 if Create option is shown)
          const tagIndex = shouldShowCreateOption ? highlightedIndex - 1 : highlightedIndex
          if (tagIndex >= 0 && tagIndex < filteredTags.length) {
            toggleTag(filteredTags[tagIndex].id)
          }
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setSearchQuery('')
        setHighlightedIndex(-1)
        break
    }
  }

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected tags display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer flex items-center gap-2 flex-wrap"
      >
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              onRemove={() => toggleTag(tag.id)}
            />
          ))
        ) : (
          <span className="text-slate-400 text-sm">Select tags...</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div 
          className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg"
          onKeyDown={handleKeyDown}
        >
          {/* V11.1: Search input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or create tag..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Scrollable options area */}
          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-sm text-slate-500">Loading tags...</div>
            ) : (
              <>
                {/* V11.1: Create option pinned at top */}
                {shouldShowCreateOption && (
                  <button
                    type="button"
                    onClick={handleCreateFromSearch}
                    disabled={isCreating}
                    className={`w-full px-3 py-2 flex items-center gap-2 transition-colors border-b border-slate-100 dark:border-slate-700 ${
                      highlightedIndex === 0
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-blue-600">
                      {isCreating ? 'Creating...' : `Create "${searchQuery.trim()}" tag`}
                    </span>
                  </button>
                )}

                {/* Filtered tag list */}
                {filteredTags.length > 0 ? (
                  filteredTags.map((tag, index) => {
                    const isSelected = selectedTagIds.includes(tag.id)
                    const { bgClass } = getTagColorClasses(tag.color)
                    const itemIndex = shouldShowCreateOption ? index + 1 : index
                    const isHighlighted = highlightedIndex === itemIndex
                    
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`w-full px-3 py-2 flex items-center gap-2 transition-colors ${
                          isHighlighted
                            ? 'bg-slate-100 dark:bg-slate-700'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${bgClass}`} />
                        <span className="flex-1 text-left text-sm text-slate-700 dark:text-slate-300">
                          {tag.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    )
                  })
                ) : (
                  !shouldShowCreateOption && (
                    <div className="p-3 text-sm text-slate-500 text-center">
                      {searchQuery ? 'No tags found' : 'No tags yet'}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * V11.1: Helper function to determine if Create option should show
 * Exported for property testing
 */
export function shouldShowCreateOption(searchQuery: string, existingTags: { name: string }[]): boolean {
  const query = searchQuery.trim()
  if (!query) return false
  const exactMatch = existingTags.some(tag => tag.name.toLowerCase() === query.toLowerCase())
  return !exactMatch
}

/**
 * V11.1: Helper function to filter tags by search query
 * Exported for property testing
 */
export function filterTagsByQuery<T extends { name: string }>(tags: T[], query: string): T[] {
  if (!query.trim()) return tags
  const normalizedQuery = query.toLowerCase().trim()
  return tags.filter(tag => tag.name.toLowerCase().includes(normalizedQuery))
}
