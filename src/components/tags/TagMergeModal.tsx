'use client'

import { useState } from 'react'
import { X, Merge, Loader2, AlertTriangle } from 'lucide-react'
import { TagBadge } from './TagBadge'
import type { Tag } from '@/types/database'

/**
 * V9.2: TagMergeModal Props
 * Requirements: 3.3
 */
interface TagMergeModalProps {
  isOpen: boolean
  onClose: () => void
  sourceTags: Tag[]
  onMerge: (targetTagId: string) => Promise<void>
}

/**
 * V9.2: TagMergeModal - Modal for selecting target tag and confirming merge
 * Requirements: 3.3, 3.4, 3.7
 */
export function TagMergeModal({ isOpen, onClose, sourceTags, onMerge }: TagMergeModalProps) {
  const [targetTagId, setTargetTagId] = useState<string>('')
  const [isMerging, setIsMerging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  // Filter out the target from source tags for display
  const tagsToMerge = sourceTags.filter(t => t.id !== targetTagId)
  const targetTag = sourceTags.find(t => t.id === targetTagId)

  const handleMerge = async () => {
    if (!targetTagId) {
      setError('Please select a target tag')
      return
    }

    setIsMerging(true)
    setError(null)

    try {
      await onMerge(targetTagId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed')
    } finally {
      setIsMerging(false)
    }
  }

  const handleClose = () => {
    if (!isMerging) {
      setTargetTagId('')
      setError(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Merge className="w-5 h-5" />
            Merge Tags
          </h2>
          <button
            onClick={handleClose}
            disabled={isMerging}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected tags */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Tags to merge ({sourceTags.length} selected)
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            {sourceTags.map(tag => (
              <TagBadge 
                key={tag.id} 
                tag={tag} 
                size="md"
              />
            ))}
          </div>
        </div>

        {/* Target selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Merge into (select target)
          </label>
          <select
            value={targetTagId}
            onChange={(e) => {
              setTargetTagId(e.target.value)
              setError(null)
            }}
            disabled={isMerging}
            className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Select target tag...</option>
            {sourceTags.map(tag => (
              <option key={tag.id} value={tag.id}>
                {tag.name} ({tag.category})
              </option>
            ))}
          </select>
        </div>

        {/* Preview */}
        {targetTag && tagsToMerge.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium mb-1">This will:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-700 dark:text-amber-400">
                  <li>
                    Move all cards from {tagsToMerge.length === 1 ? (
                      <span className="font-medium">&quot;{tagsToMerge[0].name}&quot;</span>
                    ) : (
                      <span className="font-medium">{tagsToMerge.length} tags</span>
                    )} to <span className="font-medium">&quot;{targetTag.name}&quot;</span>
                  </li>
                  <li>
                    Delete {tagsToMerge.length === 1 ? (
                      <span className="font-medium">&quot;{tagsToMerge[0].name}&quot;</span>
                    ) : (
                      <span className="font-medium">{tagsToMerge.length} source tags</span>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isMerging}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={!targetTagId || isMerging}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isMerging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Merge className="w-4 h-4" />
                Merge Tags
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
