'use client'

import { X, BookOpen, FolderTree, Lightbulb } from 'lucide-react'
import { getTagColorClasses, getCategoryColorClasses } from '@/lib/tag-colors'
import type { Tag, TagCategory } from '@/types/database'

interface TagBadgeProps {
  tag: Tag
  onRemove?: () => void
  size?: 'sm' | 'md'
  /** V11.3: Show category icon indicator */
  showCategoryIcon?: boolean
}

/**
 * V11.3: Get the icon component for a category
 */
function getCategoryIcon(category: TagCategory) {
  switch (category) {
    case 'source':
      return BookOpen
    case 'topic':
      return FolderTree
    case 'concept':
      return Lightbulb
  }
}

/**
 * TagBadge - Single tag display with optional remove button
 * V9: Uses category-based colors when category is available
 * V11.3: Added optional category icon indicator
 * Requirements: V5 Feature Set 1 - Req 1.7, V9-6.2, V11.3-6.1
 */
export function TagBadge({ tag, onRemove, size = 'sm', showCategoryIcon = false }: TagBadgeProps) {
  // V9: Use category-based colors if category exists, otherwise fall back to color field
  const { bgClass, textClass } = tag.category 
    ? getCategoryColorClasses(tag.category)
    : getTagColorClasses(tag.color)
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-2.5 py-1 text-sm'

  // V11.3: Get category icon if enabled
  const CategoryIcon = showCategoryIcon && tag.category ? getCategoryIcon(tag.category) : null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${bgClass} ${textClass} ${sizeClasses} font-medium`}
    >
      {CategoryIcon && <CategoryIcon className="w-3 h-3 opacity-70" />}
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hover:opacity-70 transition-opacity"
          aria-label={`Remove ${tag.name} tag`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  )
}

/**
 * V11.3: Helper to check if a tag has a category indicator
 * Exported for property testing
 */
export function hasCategoryIndicator(tag: Tag, showCategoryIcon: boolean): boolean {
  return showCategoryIcon && !!tag.category
}
