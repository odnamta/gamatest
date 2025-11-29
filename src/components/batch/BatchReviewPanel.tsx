'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { BatchDraftCard } from './BatchDraftCard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { bulkCreateMCQ } from '@/actions/batch-mcq-actions'
import { mergeAndDeduplicateTags } from '@/lib/tag-merge'
import type { MCQBatchDraftUI } from '@/lib/batch-mcq-schema'

interface BatchReviewPanelProps {
  isOpen: boolean
  onClose: () => void
  drafts: MCQBatchDraftUI[]
  onDraftsChange: (drafts: MCQBatchDraftUI[]) => void
  sessionTagIds: string[]
  sessionTagNames: string[]
  deckId: string
  onSaveSuccess: (count: number) => void
}

/**
 * BatchReviewPanel - Modal for reviewing and saving batch MCQ drafts
 * 
 * Requirements: R1.3 - Batch Review Panel, R1.4 - Atomic Bulk Save
 */
export function BatchReviewPanel({
  isOpen,
  onClose,
  drafts,
  onDraftsChange,
  sessionTagIds,
  sessionTagNames,
  deckId,
  onSaveSuccess,
}: BatchReviewPanelProps) {
  const { showToast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSaving, onClose])

  // Prevent body scroll when panel is open
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

  const handleDraftChange = useCallback(
    (index: number, updated: MCQBatchDraftUI) => {
      const newDrafts = [...drafts]
      newDrafts[index] = updated
      onDraftsChange(newDrafts)
    },
    [drafts, onDraftsChange]
  )

  const selectedCount = drafts.filter((d) => d.include).length
  const totalCount = drafts.length

  const handleSave = async () => {
    const selectedDrafts = drafts.filter((d) => d.include)
    if (selectedDrafts.length === 0) return

    setIsSaving(true)

    try {
      // Prepare cards with merged tags
      const cards = selectedDrafts.map((draft) => ({
        stem: draft.stem,
        options: draft.options,
        correctIndex: draft.correctIndex,
        explanation: draft.explanation || undefined,
        tagNames: mergeAndDeduplicateTags(sessionTagNames, draft.aiTags),
      }))

      const result = await bulkCreateMCQ({ deckId, cards })

      if (result.ok) {
        showToast(`Saved ${result.createdCount} MCQs!`, 'success')
        onSaveSuccess(result.createdCount)
        onClose()
      } else {
        showToast(result.error.message || 'Failed to save cards', 'error')
      }
    } catch (error) {
      console.error('Save error:', error)
      showToast('An error occurred while saving', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!isSaving) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleDiscard}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:mx-4 bg-white dark:bg-slate-900 sm:rounded-lg shadow-xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Review AI Drafts
          </h2>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isSaving}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {drafts.length === 0 ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">
              No drafts to review
            </p>
          ) : (
            drafts.map((draft, index) => (
              <BatchDraftCard
                key={draft.id}
                draft={draft}
                index={index}
                sessionTagNames={sessionTagNames}
                onChange={(updated) => handleDraftChange(index, updated)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {selectedCount} of {totalCount} selected
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleDiscard}
              disabled={isSaving}
            >
              Discard All
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={selectedCount === 0 || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                `Save Selected (${selectedCount})`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
