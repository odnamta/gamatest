'use client'

import { X } from 'lucide-react'
import { TagBadge } from './TagBadge'
import type { Tag } from '@/types/database'

interface FilterBarProps {
  tags: Tag[]
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  onClear: () => void
}

/**
 * FilterBar - Horizontal tag filter pills with clear button
 * Requirements: V5 Feature Set 1 - Req 1.8, 1.10
 */
export function FilterBar({ tags, selectedTagIds, onTagsChange, onClear }: FilterBarProps) {
  if (selectedTagIds.length === 0) {
    return null
  }

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter((id) => id !== tagId))
  }

  return (
    <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg mb-4">
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
  )
}
