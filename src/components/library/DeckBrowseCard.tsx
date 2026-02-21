'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { subscribeToDeck } from '@/actions/library-actions'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { BrowseDeckItem } from '@/types/database'

interface DeckBrowseCardProps {
  deck: BrowseDeckItem
  onSubscribeSuccess?: () => void
}

export function DeckBrowseCard({ deck, onSubscribeSuccess }: DeckBrowseCardProps) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleSubscribe = () => {
    startTransition(async () => {
      const result = await subscribeToDeck(deck.id)
      if (result.ok) {
        showToast(`Added "${deck.title}" to your library!`, 'success')
        if (onSubscribeSuccess) {
          onSubscribeSuccess()
        }
      } else {
        showToast(result.error || 'Failed to subscribe', 'error')
      }
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm dark:shadow-none">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
            {deck.title}
          </h3>
          {deck.isAuthor && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">
              Created by you
            </span>
          )}
        </div>
        
        {deck.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
            {deck.description}
          </p>
        )}
        
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-700">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
          </span>
          
          {deck.isSubscribed ? (
            <Link href="/library/my">
              <Button variant="ghost" size="sm">
                Go to My Library
              </Button>
            </Link>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubscribe}
              disabled={isPending}
            >
              {isPending ? 'Adding...' : 'Add to My Studies'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
