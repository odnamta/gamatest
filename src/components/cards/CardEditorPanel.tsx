'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TagSelector } from '@/components/tags/TagSelector'
import { MCQOptionsEditor } from '@/components/mcq/MCQOptionsEditor'
import { updateCard } from '@/actions/card-actions'
import { getCardTags, assignTagsToCard } from '@/actions/tag-actions'
import { useToast } from '@/components/ui/Toast'
import type { Card } from '@/types/database'

interface CardEditorPanelProps {
  isOpen: boolean
  onClose: () => void
  card: Card | null
  cardIds: string[]
  currentIndex: number
  onNavigate: (direction: 'prev' | 'next') => void
  onSaveSuccess: () => void
  deckId: string
  /** Callback to fetch card data by ID */
  getCardById: (id: string) => Card | undefined
}

/**
 * V11.4: CardEditorPanel - Slide-over drawer for editing cards inline
 * Supports Save & Next navigation for rapid card review.
 * Requirements: 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3
 */
export function CardEditorPanel({
  isOpen,
  onClose,
  card,
  cardIds,
  currentIndex,
  onNavigate,
  onSaveSuccess,
  deckId,
  getCardById,
}: CardEditorPanelProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [stem, setStem] = useState('')
  const [options, setOptions] = useState<string[]>(['', '', '', '', ''])
  const [correctIndex, setCorrectIndex] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  const isLastCard = currentIndex >= cardIds.length - 1
  const isFirstCard = currentIndex <= 0

  // Load card data when card changes
  useEffect(() => {
    if (card) {
      setStem(card.stem || '')
      setOptions(Array.isArray(card.options) ? card.options : ['', '', '', '', ''])
      setCorrectIndex(card.correct_index ?? 0)
      setExplanation(card.explanation || '')
      
      // Load tags
      getCardTags(card.id).then(tags => {
        setSelectedTagIds(tags.map(t => t.id))
      }).catch(() => { /* tag load failure is non-critical */ })
    }
  }, [card])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Enter or Ctrl+Enter: Save & Next
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSaveAndNext()
      }
      // Cmd+S or Ctrl+S: Save
      else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      // Escape: Close panel
      else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, card, stem, options, correctIndex, explanation, selectedTagIds])

  const handleSave = async () => {
    if (!card || isSubmitting) return
    
    setIsSubmitting(true)
    try {
      const result = await updateCard({
        cardId: card.id,
        type: 'mcq',
        stem,
        options: options.filter(o => o.trim()),
        correctIndex,
        explanation,
      })

      if (result.ok) {
        await assignTagsToCard(card.id, selectedTagIds)
        showToast('Card saved', 'success')
        onSaveSuccess()
      } else {
        showToast(result.error || 'Could not save card', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveAndNext = async () => {
    if (!card || isSubmitting) return
    
    setIsSubmitting(true)
    try {
      const result = await updateCard({
        cardId: card.id,
        type: 'mcq',
        stem,
        options: options.filter(o => o.trim()),
        correctIndex,
        explanation,
      })

      if (result.ok) {
        await assignTagsToCard(card.id, selectedTagIds)
        showToast('Card saved', 'success')
        onSaveSuccess()
        
        if (!isLastCard) {
          onNavigate('next')
        } else {
          showToast('No more cards in this filter', 'info')
        }
      } else {
        showToast(result.error || 'Could not save card', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // V12: Unified options change handler for MCQOptionsEditor
  const handleOptionsChange = (newOptions: string[], newCorrectIndex: number) => {
    setOptions(newOptions)
    setCorrectIndex(newCorrectIndex)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col overflow-hidden animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('prev')}
              disabled={isFirstCard || isSubmitting}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Previous card"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Card {currentIndex + 1} of {cardIds.length}
            </span>
            <button
              onClick={() => onNavigate('next')}
              disabled={isLastCard || isSubmitting}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Next card"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {card ? (
            <>
              {/* Stem */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Question Stem
                </label>
                <textarea
                  value={stem}
                  onChange={(e) => setStem(e.target.value)}
                  placeholder="Enter the question..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              {/* V12: Options using MCQOptionsEditor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Answer Options
                </label>
                <MCQOptionsEditor
                  options={options}
                  correctIndex={correctIndex}
                  onChange={handleOptionsChange}
                />
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Explanation (optional)
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Explain why the correct answer is correct..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tags (optional)
                </label>
                <TagSelector
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={isSubmitting || !card}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan (⌘S)'
              )}
            </Button>
            <Button
              onClick={handleSaveAndNext}
              disabled={isSubmitting || !card}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : isLastCard ? (
                'Simpan (Kartu Terakhir)'
              ) : (
                'Simpan & Lanjut (⌘↵)'
              )}
            </Button>
          </div>
          {isLastCard && (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-2">
              No more cards in this filter
            </p>
          )}
        </div>
      </div>
    </>
  )
}
