'use client'

import { X, BookOpen, FolderTree, Lightbulb, Filter } from 'lucide-react'
import { TagBadge } from './TagBadge'
import { getCategoryColorClasses } from '@/lib/tag-colors'
import type { Tag, TagCategory } from '@/types/database'

// V11.1: Source type for source filtering
interface BookSourceFilter {
  id: string
  title: string
}

interface FilterBarProps {
  tags: Tag[]
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  onClear: () => void
  // V9.2: Untagged filter props
  showUntaggedOnly?: boolean
  onShowUntaggedOnlyChange?: (value: boolean) => void
  untaggedCount?: number
  // V11.1: Source filtering props
  availableSources?: BookSourceFilter[]
  selectedSourceIds?: string[]
  onSourcesChange?: (sourceIds: string[]) => void
}

/**
 * V9: Group tags by category for display
 */
function groupTagsByCategory(tags: Tag[]): Record<TagCategory, Tag[]> {
  return {
    source: tags.filter(t => t.category === 'source'),
    topic: tags.filter(t => t.category === 'topic'),
    concept: tags.filter(t => t.category === 'concept'),
  }
}

/**
 * V9: Category configuration for display
 */
const CATEGORY_CONFIG: Array<{
  key: TagCategory
  label: string
  icon: typeof BookOpen
}> = [
  { key: 'source', label: 'By Source', icon: BookOpen },
  { key: 'topic', label: 'By Topic', icon: FolderTree },
  { key: 'concept', label: 'By Concept', icon: Lightbulb },
]

/**
 * FilterBar - Horizontal tag filter pills with clear button
 * V9: Groups tags by category with section headers
 * V9.2: Added untagged filter toggle
 * Requirements: V5 Feature Set 1 - Req 1.8, 1.10, V9-6.1, V9-6.2, V9-6.4, V9.2-1.1
 */
export function FilterBar({ 
  tags, 
  selectedTagIds, 
  onTagsChange, 
  onClear,
  showUntaggedOnly,
  onShowUntaggedOnlyChange,
  untaggedCount,
  // V11.1: Source filtering
  availableSources = [],
  selectedSourceIds = [],
  onSourcesChange,
}: FilterBarProps) {
  // V9.2: Show untagged toggle even when no tags selected
  const hasUntaggedToggle = onShowUntaggedOnlyChange !== undefined
  // V11.1: Check if any filters are active
  const hasActiveFilters = selectedTagIds.length > 0 || selectedSourceIds.length > 0
  
  if (!hasActiveFilters && !hasUntaggedToggle) {
    return null
  }
  
  // V9.2: Show only untagged toggle when no filters selected
  if (!hasActiveFilters && hasUntaggedToggle) {
    return (
      <UntaggedToggle
        showUntaggedOnly={showUntaggedOnly ?? false}
        onShowUntaggedOnlyChange={onShowUntaggedOnlyChange}
        untaggedCount={untaggedCount}
      />
    )
  }

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))
  const groupedTags = groupTagsByCategory(selectedTags)

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter((id) => id !== tagId))
  }

  // V11.1: Clear all filters including sources
  const handleClearAll = () => {
    onClear()
    if (onSourcesChange) {
      onSourcesChange([])
    }
  }

  // V9: Check if we have tags in multiple categories (show grouped view)
  // V11.1: Also show grouped view if source filters are active
  const categoriesWithTags = CATEGORY_CONFIG.filter(c => groupedTags[c.key].length > 0)
  const showGroupedView = categoriesWithTags.length > 1 || selectedTags.some(t => t.category !== 'concept') || selectedSourceIds.length > 0

  if (!showGroupedView) {
    // Simple flat view for backward compatibility when only concept tags
    return (
      <div className="space-y-3 mb-4">
        {/* V9.2: Untagged toggle */}
        {hasUntaggedToggle && (
          <UntaggedToggle
            showUntaggedOnly={showUntaggedOnly ?? false}
            onShowUntaggedOnlyChange={onShowUntaggedOnlyChange}
            untaggedCount={untaggedCount}
          />
        )}
        <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-600 dark:text-slate-400">Filtering by:</span>
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              size="md"
              onRemove={() => removeTag(tag.id)}
            />
          ))}
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        </div>
      </div>
    )
  }

  // V9: Grouped view with category headers
  return (
    <div className="space-y-3 mb-4">
      {/* V9.2: Untagged toggle */}
      {hasUntaggedToggle && (
        <UntaggedToggle
          showUntaggedOnly={showUntaggedOnly ?? false}
          onShowUntaggedOnlyChange={onShowUntaggedOnlyChange}
          untaggedCount={untaggedCount}
        />
      )}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Active Filters
          </span>
          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        </div>

        {/* V11.1: Source filter section */}
        {selectedSourceIds.length > 0 && onSourcesChange && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              By Source:
            </span>
            {selectedSourceIds.map((sourceId) => {
              const source = availableSources.find(s => s.id === sourceId)
              if (!source) return null
              return (
                <button
                  key={sourceId}
                  onClick={() => onSourcesChange(selectedSourceIds.filter(id => id !== sourceId))}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                >
                  {source.title}
                  <X className="w-3 h-3" />
                </button>
              )
            })}
          </div>
        )}

        {/* V9: Category sections - only show non-empty categories */}
        {CATEGORY_CONFIG.map(({ key, label, icon: Icon }) => {
          const categoryTags = groupedTags[key]
          if (categoryTags.length === 0) return null

          const { textClass } = getCategoryColorClasses(key)

          return (
            <div key={key} className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium ${textClass} flex items-center gap-1`}>
                <Icon className="w-3 h-3" />
                {label}:
              </span>
              {categoryTags.map((tag) => (
                <TagBadge
                  key={tag.id}
                  tag={tag}
                  size="sm"
                  onRemove={() => removeTag(tag.id)}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * V9.2: Untagged Toggle Component
 * Requirements: 1.1 - Show Untagged Only toggle in FilterBar
 */
interface UntaggedToggleProps {
  showUntaggedOnly: boolean
  onShowUntaggedOnlyChange?: (value: boolean) => void
  untaggedCount?: number
}

function UntaggedToggle({ 
  showUntaggedOnly, 
  onShowUntaggedOnlyChange,
  untaggedCount 
}: UntaggedToggleProps) {
  if (!onShowUntaggedOnlyChange) return null
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <button
        onClick={() => onShowUntaggedOnlyChange(!showUntaggedOnly)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          showUntaggedOnly
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
        }`}
      >
        <Filter className="w-4 h-4" />
        Show Untagged Only
        {untaggedCount !== undefined && untaggedCount > 0 && (
          <span className={`px-1.5 py-0.5 text-xs rounded-full ${
            showUntaggedOnly
              ? 'bg-amber-200 dark:bg-amber-800'
              : 'bg-slate-200 dark:bg-slate-600'
          }`}>
            {untaggedCount}
          </span>
        )}
      </button>
      {showUntaggedOnly && (
        <span className="text-sm text-amber-700 dark:text-amber-400">
          Showing {untaggedCount ?? 0} untagged card{untaggedCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

/**
 * V9: Enhanced FilterBar with category-grouped tag selection
 * Used in deck/library views for advanced filtering
 */
export interface CategoryFilterBarProps {
  allTags: Tag[]
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
}

export function CategoryFilterBar({ allTags, selectedTagIds, onTagsChange }: CategoryFilterBarProps) {
  const groupedTags = groupTagsByCategory(allTags)

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId))
    } else {
      onTagsChange([...selectedTagIds, tagId])
    }
  }

  // V9: Only show categories that have tags
  const categoriesWithTags = CATEGORY_CONFIG.filter(c => groupedTags[c.key].length > 0)

  if (categoriesWithTags.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {categoriesWithTags.map(({ key, label, icon: Icon }) => {
        const categoryTags = groupedTags[key]
        const { bgClass, textClass } = getCategoryColorClasses(key)

        return (
          <div key={key}>
            <h4 className={`text-sm font-medium mb-2 flex items-center gap-1.5 ${textClass}`}>
              <Icon className="w-4 h-4" />
              {label}
            </h4>
            <div className="flex flex-wrap gap-2">
              {categoryTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`px-2.5 py-1 text-sm rounded-full transition-all ${
                      isSelected
                        ? `${bgClass} ${textClass} ring-2 ring-offset-1 ring-current`
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
