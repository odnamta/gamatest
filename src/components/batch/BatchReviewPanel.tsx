'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { BatchDraftCard } from './BatchDraftCard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { bulkCreateMCQV2 } from '@/actions/batch-mcq-actions'
import { formatQAMetrics, type QAMetrics } from '@/lib/content-staging-metrics'
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
  /** V6.2: Current session total for toast message */
  sessionTotal?: number
  /** V11.3: Import session ID for draft/publish workflow */
  importSessionId?: string
  /** V11.5.1: QA metrics from autoscan for summary display */
  qaMetrics?: QAMetrics
}

/**
 * BatchReviewPanel - Modal for reviewing and saving batch MCQ drafts
 * 
 * Requirements: R1.3 - Batch Review Panel, R1.4 - Atomic Bulk Save
 * V6.2: Auto-close on save success, show session total in toast
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
  sessionTotal = 0,
  importSessionId,
  qaMetrics,
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

  // V6.2: Count only included cards
  const selectedCount = drafts.filter((d) => d.include).length
  const totalCount = drafts.length

  const handleSave = async () => {
    // V6.2: Only include cards where include === true
    const selectedDrafts = drafts.filter((d) => d.include)
    if (selectedDrafts.length === 0) return

    setIsSaving(true)

    try {
      // Prepare cards with AI tags only (session tags passed separately for atomic merge)
      const cards = selectedDrafts.map((draft) => ({
        stem: draft.stem,
        options: draft.options,
        correctIndex: draft.correctIndex,
        explanation: draft.explanation || undefined,
        tagNames: draft.aiTags, // V6.1: AI tags only, session tags merged server-side
      }))

      // V7.2.1: Deep logging - BatchReviewPanel caller
      // V11.3: Include importSessionId for draft/publish workflow
      console.log('[BatchReviewPanel] Saving via bulkCreateMCQV2', {
        deckTemplateId: deckId,
        sessionTags: sessionTagNames,
        cardsCount: cards.length,
        importSessionId,
      })
      
      // V7.2: Use bulkCreateMCQV2 for V2 schema consistency with Auto-Scan
      // V11.3: Pass importSessionId for draft/publish workflow
      const result = await bulkCreateMCQV2({ 
        deckTemplateId: deckId, 
        sessionTags: sessionTagNames,
        cards,
        importSessionId,
      })

      if (result.ok) {
        // V6.2: Calculate new session total and show in toast
        const newSessionTotal = sessionTotal + result.createdCount
        // V11.6: Include skipped count in toast if duplicates were detected
        const skippedMsg = result.skippedCount && result.skippedCount > 0
          ? ` · ${result.skippedCount} duplicate${result.skippedCount !== 1 ? 's' : ''} skipped`
          : ''
        showToast(
          `Saved ${result.createdCount} card${result.createdCount !== 1 ? 's' : ''} · Session total: ${newSessionTotal}${skippedMsg}`,
          'success'
        )
        onSaveSuccess(result.createdCount)
        // V6.2: Auto-close modal on success
        onClose()
      } else {
        // V6.1: Enhanced error feedback with error code
        const errorCode = result.error.code || 'UNKNOWN'
        showToast(`Save failed. Please check your connection. (Error: ${errorCode})`, 'error')
      }
    } catch (error) {
      console.error('Save error:', error)
      showToast('Save failed. Please check your connection. (Error: NETWORK)', 'error')
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
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Review AI Drafts
            </h2>
            {/* V11.5.1: QA Metrics Summary */}
            {qaMetrics && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-1">
                <span>{formatQAMetrics(qaMetrics)}</span>
                {qaMetrics.missingNumbers.length > 0 && (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline-block ml-1 flex-shrink-0" />
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isSaving}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50 flex-shrink-0"
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
            {/* V6.2: Disable save when N = 0 */}
            <Button
              type="button"
              onClick={handleSave}
              disabled={selectedCount === 0 || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving {selectedCount} Card{selectedCount !== 1 ? 's' : ''}...
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
