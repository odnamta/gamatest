'use client'

import { X } from 'lucide-react'
import { getTagColorClasses } from '@/lib/tag-colors'
import type { Tag } from '@/types/database'

interface TagBadgeProps {
  tag: Tag
  onRemove?: () => void
  size?: 'sm' | 'md'
}

/**
 * TagBadge - Single tag display with optional remove button
 * Requirements: V5 Feature Set 1 - Req 1.7
 */
export function TagBadge({ tag, onRemove, size = 'sm' }: TagBadgeProps) {
  const { bgClass, textClass } = getTagColorClasses(tag.color)
  
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs' 
    : 'px-2.5 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${bgClass} ${textClass} ${sizeClasses} font-medium`}
    >
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
