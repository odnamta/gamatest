'use client'

import { Send, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface PublishAllConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  draftCount: number
  isPublishing: boolean
}

/**
 * V11.4: Publish All Confirmation Dialog
 * Shows confirmation before publishing all draft cards in a deck.
 * Requirements: 4.2
 */
export function PublishAllConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  draftCount,
  isPublishing,
}: PublishAllConfirmDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title" aria-describedby="publish-dialog-description">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Send className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Title */}
        <h2 id="publish-dialog-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100 text-center mb-2">
          Terbitkan Semua Kartu Draft?
        </h2>

        {/* Description */}
        <p id="publish-dialog-description" className="text-slate-600 dark:text-slate-400 text-center mb-6">
          Ini akan menerbitkan semua <span className="font-semibold text-blue-600 dark:text-blue-400">{draftCount}</span> kartu draft di deck ini.
          Kartu yang diterbitkan akan terlihat di sesi belajar.
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isPublishing}
            className="flex-1"
          >
            Batal
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPublishing}
            className="flex-1"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menerbitkan...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Terbitkan Semua
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
