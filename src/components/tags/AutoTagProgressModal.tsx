'use client'

import { useEffect, useCallback } from 'react'
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

/**
 * V9.3: AutoTagProgressModal
 * Modal overlay showing auto-tagging progress with progress bar.
 * Non-dismissible during processing to prevent accidental interruption.
 * 
 * Requirements: V9.3 5.1-5.5
 * 
 * Property 11: Progress display accuracy - shows correct chunk/total
 */

interface AutoTagProgressModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Whether tagging is currently in progress */
  isProcessing: boolean
  /** Current chunk being processed (1-indexed) */
  currentChunk: number
  /** Total number of chunks */
  totalChunks: number
  /** Number of cards successfully tagged */
  taggedCount: number
  /** Number of cards skipped */
  skippedCount: number
  /** Error message if any */
  error?: string | null
  /** Called when user clicks Cancel */
  onCancel: () => void
  /** Called when user clicks Close (only enabled when not processing) */
  onClose: () => void
}

export function AutoTagProgressModal({
  isOpen,
  isProcessing,
  currentChunk,
  totalChunks,
  taggedCount,
  skippedCount,
  error,
  onCancel,
  onClose,
}: AutoTagProgressModalProps) {
  // Calculate progress percentage
  const progressPercent = totalChunks > 0 ? Math.round((currentChunk / totalChunks) * 100) : 0
  const isComplete = !isProcessing && currentChunk > 0

  // Handle Escape key - only close if not processing
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose()
      }
    },
    [isProcessing, onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - non-clickable during processing */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isProcessing ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isProcessing ? 'Auto-Tagging Cards' : isComplete ? 'Auto-Tagging Complete' : 'Auto-Tag'}
          </h2>
          {!isProcessing && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress section */}
        <div className="space-y-4">
          {/* Status icon and text */}
          <div className="flex items-center gap-3">
            {isProcessing ? (
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            ) : error ? (
              <AlertCircle className="w-6 h-6 text-amber-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-500" />
            )}
            <div>
              {isProcessing ? (
                <p className="text-slate-700 dark:text-slate-300">
                  Processing batch {currentChunk} of {totalChunks}...
                </p>
              ) : error ? (
                <p className="text-amber-600 dark:text-amber-400">{error}</p>
              ) : (
                <p className="text-green-600 dark:text-green-400">All batches processed!</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                error ? 'bg-amber-500' : isComplete ? 'bg-green-500' : 'bg-purple-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              Tagged: <span className="font-medium text-green-600 dark:text-green-400">{taggedCount}</span>
            </span>
            <span>
              Skipped: <span className="font-medium text-amber-600 dark:text-amber-400">{skippedCount}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          {isProcessing ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              Batal
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
