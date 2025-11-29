'use client'

import Link from 'next/link'
import { Pencil, Trash2, Copy } from 'lucide-react'
import { TagBadge } from '@/components/tags/TagBadge'
import type { Card, Tag } from '@/types/database'

interface CardListItemProps {
  card: Card
  deckId: string
  tags?: Tag[]
  onDelete: (cardId: string, preview: string, type: string) => void
  onDuplicate: (cardId: string) => void
  isSelected?: boolean
  onToggleSelect?: (cardId: string) => void
}

/**
 * CardListItem - Displays a single card with Edit/Delete actions
 * Requirements: FR-1
 */
export function CardListItem({ card, deckId, tags = [], onDelete, onDuplicate, isSelected, onToggleSelect }: CardListItemProps) {
  const isMCQ = card.card_type === 'mcq'
  const preview = isMCQ ? card.stem : card.front
  const typeLabel = isMCQ ? 'MCQ' : 'Flashcard'

  const handleDeleteClick = () => {
    onDelete(card.id, preview || '', typeLabel)
  }

  return (
    <div className={`p-4 bg-white dark:bg-slate-800 border rounded-xl shadow-sm hover:shadow-md transition-shadow ${
      isSelected 
        ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' 
        : 'border-slate-200 dark:border-slate-700'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        {/* Checkbox for bulk selection */}
        {onToggleSelect && (
          <div className="flex items-center sm:pt-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(card.id)}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )}
        {/* Card content */}
        <div className="flex-1 min-w-0">
          <p className="text-slate-900 dark:text-slate-100 line-clamp-2 text-sm">
            {preview}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Card type badge */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
              isMCQ 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            }`}>
              {typeLabel}
            </span>
            {card.image_url && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                Has image
              </span>
            )}
            {/* Tag badges */}
            {tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))}
          </div>
        </div>

        {/* Action buttons - 44px min height for mobile tap targets */}
        <div className="flex gap-2 sm:flex-shrink-0">
          <Link
            href={`/decks/${deckId}/cards/${card.id}/edit`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </Link>
          <button
            onClick={() => onDuplicate(card.id)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Duplicate card"
          >
            <Copy className="w-4 h-4" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>
          <button
            onClick={handleDeleteClick}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>
    </div>
  )
}
