'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { deleteDeckAction } from '@/actions/deck-actions'
import { Button } from '@/components/ui/Button'
import type { DeckWithDueCount } from '@/types/database'

interface DeckCardProps {
  deck: DeckWithDueCount
}

export function DeckCard({ deck }: DeckCardProps) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this deck? All cards will be removed.')) {
      startTransition(() => {
        deleteDeckAction(deck.id)
      })
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm dark:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <Link 
          href={`/decks/${deck.id}`}
          className="flex-1 min-w-0"
        >
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 truncate">
            {deck.title}
          </h3>
          <div className="mt-2 flex items-center gap-2">
            {deck.due_count > 0 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                {deck.due_count} due
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                All caught up
              </span>
            )}
          </div>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? '...' : 'Delete'}
        </Button>
      </div>
    </div>
  )
}
