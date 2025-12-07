'use client'

import { BookOpen } from 'lucide-react'

/**
 * V11.1: SourceBadge Component
 * 
 * Displays a blue badge showing the book source title.
 * This is a VIRTUAL badge - it does NOT create or represent a real tag.
 * The badge is derived from book_sources via card_templates.book_source_id.
 * 
 * Requirements: 3.2, 3.3, 3.4
 */

interface SourceBadgeProps {
  title: string
}

export function SourceBadge({ title }: SourceBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
      <BookOpen className="w-3 h-3" />
      {title}
    </span>
  )
}
