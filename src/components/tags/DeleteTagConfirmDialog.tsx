'use client'

import { Loader2, AlertTriangle } from 'lucide-react'
import type { Tag } from '@/types/database'

interface DeleteTagConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  tag: Tag | null
  isDeleting: boolean
}

/**
 * DeleteTagConfirmDialog - Confirmation dialog for tag deletion
 * V11.3: Shows warning about card associations being removed
 * Requirements: 3.1
 */
export function DeleteTagConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  tag,
  isDeleting,
}: DeleteTagConfirmDialogProps) {
  if (!isOpen || !tag) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Warning icon */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-center text-slate-900 dark:text-white mb-2">
          Delete Tag
        </h2>

        {/* Message */}
        <p className="text-center text-slate-600 dark:text-slate-400 mb-2">
          Are you sure you want to delete <span className="font-medium text-slate-900 dark:text-white">&quot;{tag.name}&quot;</span>?
        </p>

        {/* Warning */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-6">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            This will remove the tag from all cards that currently use it. This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isDeleting ? 'Deleting...' : 'Delete Tag'}
          </button>
        </div>
      </div>
    </div>
  )
}
