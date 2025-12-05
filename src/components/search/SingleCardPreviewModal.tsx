'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { getCardWithProgress, type CardWithProgress } from '@/actions/notebook-actions'
import { FlagIcon } from '@/components/study/FlagIcon'
import { NotesSection } from '@/components/study/NotesSection'
import { MarkdownContent } from '@/components/study/MarkdownContent'

export interface SingleCardPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  cardTemplateId: string | null
}

/**
 * SingleCardPreviewModal - Modal for viewing a single card from search
 * V10.6: Digital Notebook
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * - 4.1: Display full card content
 * - 4.2: Allow flagging
 * - 4.3: Allow notes
 * - 4.4: Return focus on close
 */
export function SingleCardPreviewModal({
  isOpen,
  onClose,
  cardTemplateId,
}: SingleCardPreviewModalProps) {
  const [card, setCard] = useState<CardWithProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch card data when modal opens
  useEffect(() => {
    if (!isOpen || !cardTemplateId) {
      setCard(null)
      return
    }

    async function fetchCard() {
      setIsLoading(true)
      setError(null)

      const result = await getCardWithProgress(cardTemplateId!)

      if (result.success && result.card) {
        setCard(result.card)
      } else {
        setError(result.error || 'Failed to load card')
      }

      setIsLoading(false)
    }

    fetchCard()
  }, [isOpen, cardTemplateId])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div 
        className="relative z-10 w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 id="preview-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Card Preview
          </h2>
          <div className="flex items-center gap-2">
            {card && (
              <FlagIcon
                cardTemplateId={card.id}
                isFlagged={card.is_flagged}
                size="md"
              />
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close preview"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {card && !isLoading && (
            <div className="space-y-6">
              {/* Deck info */}
              <p className="text-sm text-blue-600 dark:text-blue-400">
                {card.deckTitle}
              </p>

              {/* Question/Stem */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Question
                </h3>
                <div className="text-slate-900 dark:text-slate-100">
                  <MarkdownContent content={card.stem} />
                </div>
              </div>

              {/* Options (MCQ) */}
              {card.options && card.options.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Options
                  </h3>
                  <div className="space-y-2">
                    {card.options.map((option, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          index === card.correct_index
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className={`font-medium ${
                            index === card.correct_index
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-slate-500'
                          }`}>
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <span className={
                            index === card.correct_index
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-slate-700 dark:text-slate-300'
                          }>
                            <MarkdownContent content={option} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {card.explanation && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
                    Explanation
                  </h3>
                  <div className="text-blue-700 dark:text-blue-200 text-sm">
                    <MarkdownContent content={card.explanation} />
                  </div>
                </div>
              )}

              {/* Notes section */}
              <NotesSection
                cardTemplateId={card.id}
                initialNotes={card.notes}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
