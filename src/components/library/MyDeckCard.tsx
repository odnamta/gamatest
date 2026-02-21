'use client'

import Link from 'next/link'
import { useTransition, useState, useRef, useEffect } from 'react'
import { MoreVertical, Loader2 } from 'lucide-react'
import { unsubscribeFromDeck } from '@/actions/library-actions'
import { deleteDeckAction } from '@/actions/deck-actions'
import { Button } from '@/components/ui/Button'
import type { MyDeckItem } from '@/types/database'

interface MyDeckCardProps {
  deck: MyDeckItem
  onUnsubscribeSuccess?: () => void
  onDeleteSuccess?: () => void
}

/**
 * V10.6.2: MyDeckCard with separate Unsubscribe/Delete actions
 * - Authors see dropdown with both "Unsubscribe" and "Delete Deck"
 * - Non-authors only see "Unsubscribe"
 * - Optimistic UI: card hides immediately on action
 * - useTransition for non-blocking UI
 */
export function MyDeckCard({ deck, onUnsubscribeSuccess, onDeleteSuccess }: MyDeckCardProps) {
  const [isPending, startTransition] = useTransition()
  const [isVisible, setIsVisible] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [showUnsubscribeConfirm, setShowUnsubscribeConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  const handleUnsubscribe = () => {
    setIsVisible(false) // Optimistic hide
    setShowUnsubscribeConfirm(false)
    setShowMenu(false)
    startTransition(async () => {
      const result = await unsubscribeFromDeck(deck.id)
      if (result.ok) {
        onUnsubscribeSuccess?.()
      } else {
        setIsVisible(true) // Restore on error
      }
    })
  }

  const handleDelete = () => {
    setIsVisible(false) // Optimistic hide
    setShowDeleteConfirm(false)
    setShowMenu(false)
    startTransition(async () => {
      const result = await deleteDeckAction(deck.id)
      // V11.5.1: Updated to use ActionResultV2 pattern
      if (result.ok) {
        onDeleteSuccess?.()
      } else {
        setIsVisible(true) // Restore on error
      }
    })
  }

  // Optimistic hide
  if (!isVisible) return null

  const totalDue = deck.due_count + deck.new_count

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-sm dark:shadow-none">
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
            {deck.title}
          </h3>
          {deck.isAuthor && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400">
              Your deck
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
          </span>
          {totalDue > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
              {totalDue} due
            </span>
          )}
          {deck.new_count > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400">
              {deck.new_count} new
            </span>
          )}
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-700">
          {/* Unsubscribe Confirmation */}
          {showUnsubscribeConfirm && (
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm text-slate-600 dark:text-slate-400">Unsubscribe?</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnsubscribeConfirm(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnsubscribe}
                disabled={isPending}
                className="text-red-600 dark:text-red-400"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes'}
              </Button>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="flex flex-col gap-2 w-full">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                Delete this deck for ALL users?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This action cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Forever'}
                </Button>
              </div>
            </div>
          )}

          {/* Normal State */}
          {!showUnsubscribeConfirm && !showDeleteConfirm && (
            <>
              {/* Actions Menu */}
              <div className="relative" ref={menuRef}>
                {deck.isAuthor ? (
                  <>
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
                      aria-label="Deck actions"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {showMenu && (
                      <div className="absolute left-0 bottom-full mb-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                        <button
                          onClick={() => {
                            setShowMenu(false)
                            setShowUnsubscribeConfirm(true)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t-lg"
                        >
                          Unsubscribe
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false)
                            setShowDeleteConfirm(true)
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-b-lg"
                        >
                          Delete Deck
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setShowUnsubscribeConfirm(true)}
                    className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    Unsubscribe
                  </button>
                )}
              </div>

              <Link href="/study/global">
                <Button variant="primary" size="sm">
                  {totalDue > 0 ? 'Continue Study' : 'Start Today'}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
