'use client'

import { Trash2, FolderInput, Download, X, Tag, Sparkles, Loader2 } from 'lucide-react'

/**
 * V9.1: Enhanced BulkActionsBar Props with onAddTag
 * V9.2: Added onAutoTag for AI retro-tagging
 * Requirements: C.2, C.3, V9.1 2.1, V9.2 2.1
 */
interface BulkActionsBarProps {
  selectedCount: number
  onDelete: () => void
  onMove: () => void
  onExport: () => void
  onAddTag?: () => void  // V9.1: Optional handler for bulk tagging
  onAutoTag?: () => void  // V9.2: Optional handler for AI auto-tagging
  isAutoTagging?: boolean  // V9.2: Loading state for auto-tagging
  onClearSelection: () => void
}

/**
 * BulkActionsBar - Sticky bar for bulk card operations
 * V9.1: Added "Add Tag" button for bulk tagging
 * V9.2: Added "Auto-Tag" button for AI retro-tagging
 * Requirements: C.2, C.3, V9.1 2.1, V9.2 2.1
 */
export function BulkActionsBar({
  selectedCount,
  onDelete,
  onMove,
  onExport,
  onAddTag,
  onAutoTag,
  isAutoTagging,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  // V11.1: Floating bar at bottom of viewport for better UX
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 shadow-lg p-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-4xl w-[calc(100%-2rem)]">
      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
        {selectedCount} card{selectedCount !== 1 ? 's' : ''} selected
      </span>
      <div className="flex flex-wrap gap-2">
        {/* V9.2: Auto-Tag button with AI */}
        {onAutoTag && (
          <button
            onClick={onAutoTag}
            disabled={isAutoTagging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAutoTagging ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {isAutoTagging ? 'Auto-Tagging...' : 'Auto-Tag Selected'}
          </button>
        )}
        {/* V9.1: Add Tag button */}
        {onAddTag && (
          <button
            onClick={onAddTag}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Tag className="w-4 h-4" />
            Add Tag
          </button>
        )}
        <button
          onClick={onMove}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <FolderInput className="w-4 h-4" />
          Move to...
        </button>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
        <button
          onClick={onClearSelection}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
