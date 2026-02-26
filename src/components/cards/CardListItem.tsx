'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, Copy } from 'lucide-react'
import { TagBadge } from '@/components/tags/TagBadge'
import { SourceBadge } from './SourceBadge'
import { sortTagsByCategory } from '@/lib/tag-sort'
import type { Card, Tag } from '@/types/database'

// V11.1: Extended card type with book_source for virtual source badge
// V11.3: Added status for draft/publish workflow
interface CardWithSource extends Card {
  book_source?: {
    id: string
    title: string
  } | null
  status?: 'draft' | 'published' | 'archived'
}

interface CardListItemProps {
  card: CardWithSource
  deckId: string
  tags?: Tag[]
  onDelete?: (cardId: string, preview: string, type: string) => void
  onDuplicate?: (cardId: string) => void
  isSelected?: boolean
  onToggleSelect?: (cardId: string) => void
  isAuthor?: boolean
  /** V11.4: Optional callback to open editor panel instead of navigating */
  onEdit?: (cardId: string) => void
}

/**
 * CardListItem - Displays a single card with Edit/Delete actions
 * Requirements: FR-1
 */
export const CardListItem = memo(function CardListItem({ card, deckId, tags = [], onDelete, onDuplicate, isSelected, onToggleSelect, isAuthor = true, onEdit }: CardListItemProps) {
  const isMCQ = card.card_type === 'mcq'
  const preview = isMCQ ? card.stem : card.front
  const typeLabel = isMCQ ? 'MCQ' : 'Flashcard'

  // V8.6: Check if card has NeedsReview tag (case-insensitive)
  const needsReview = tags.some(tag => tag.name.toLowerCase() === 'needsreview')

  const handleDeleteClick = () => {
    onDelete?.(card.id, preview || '', typeLabel)
  }

  // V11.3: Check if card is draft or archived
  const isDraft = card.status === 'draft'
  const isArchived = card.status === 'archived'

  // V8.6: Determine border/background classes based on state
  // V11.3: Added draft/archived styling
  const getBorderClasses = () => {
    if (isSelected) {
      return 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
    }
    if (isDraft) {
      return 'border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10'
    }
    if (isArchived) {
      return 'border-slate-300 dark:border-slate-600 bg-slate-100/50 dark:bg-slate-800/50 opacity-60'
    }
    if (needsReview) {
      return 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
    }
    return 'border-slate-200 dark:border-slate-700'
  }

  return (
    <div className={`p-4 bg-white dark:bg-slate-800 border rounded-xl shadow-sm hover:shadow-md transition-shadow ${getBorderClasses()}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Checkbox for bulk selection */}
        {onToggleSelect && (
          <div className="flex items-center sm:pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(card.id)}
              aria-label={`Select card: ${preview?.slice(0, 50) || 'Untitled'}`}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}
        {/* Card content */}
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-slate-100 line-clamp-2 text-sm" title={preview || undefined}>
            {preview}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {/* V11.3: Draft/Archived status badge */}
            {isDraft && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                Draft
              </span>
            )}
            {isArchived && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600">
                Archived
              </span>
            )}
            {/* Card type badge - V9.4: Distinct from pill-shaped tags with border + lighter bg */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
              isMCQ 
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
            }`}>
              {typeLabel}
            </span>
            {card.image_url && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                Has image
              </span>
            )}
            {/* V11.1: Virtual Source badge from book_sources (NOT a real tag) */}
            {card.book_source && (
              <SourceBadge title={card.book_source.title} />
            )}
            {/* Tag badges - V9.4: Sorted by category (Source → Topic → Concept) */}
            {sortTagsByCategory(tags).map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))}
          </div>
        </div>

        {/* Action buttons - 44px min height for mobile tap targets */}
        {isAuthor && (
          <div className="flex gap-2 sm:flex-shrink-0">
            {/* V11.4: Use onEdit callback if provided, otherwise navigate to edit page */}
            {onEdit ? (
              <button
                onClick={() => onEdit(card.id)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors active:scale-95"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            ) : (
              <Link
                href={`/decks/${deckId}/cards/${card.id}/edit`}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            )}
            <button
              onClick={() => onDuplicate?.(card.id)}
              aria-label="Duplicate card"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Duplicate card"
            >
              <Copy className="w-4 h-4" />
              <span className="hidden sm:inline">Duplikat</span>
            </button>
            <button
              onClick={handleDeleteClick}
              aria-label="Delete card"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Hapus</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
})
