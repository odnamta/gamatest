'use client'

import { useState } from 'react'
import { X, Tag, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TagSelector } from '@/components/tags/TagSelector'
import { bulkAddTagToCards } from '@/actions/tag-actions'
import { useToast } from '@/components/ui/Toast'

/**
 * V9.1: BulkTagModal Props
 * Requirements: 2.1, 2.2, 2.5
 */
interface BulkTagModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCardIds: string[]
  onSuccess: (count: number) => void
}

/**
 * V9.1: BulkTagModal Component
 * Modal dialog for applying a tag to multiple cards at once.
 * 
 * Requirements: 2.1, 2.2, 2.5
 */
export function BulkTagModal({
  isOpen,
  onClose,
  selectedCardIds,
  onSuccess,
}: BulkTagModalProps) {
  const { showToast } = useToast()
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  const handleApplyTag = async () => {
    if (selectedTagIds.length === 0) {
      showToast('Please select a tag to apply', 'error')
      return
    }

    // Apply only the first selected tag (single tag application)
    const tagId = selectedTagIds[0]
    
    setIsLoading(true)
    try {
      const result = await bulkAddTagToCards(selectedCardIds, tagId)
      
      if (result.ok) {
        const taggedCount = result.data?.taggedCount ?? 0
        showToast(`Tagged ${taggedCount} cards successfully`, 'success')
        onSuccess(taggedCount)
        setSelectedTagIds([])
        onClose()
      } else {
        showToast(result.error || 'Failed to tag cards', 'error')
      }
    } catch (error) {
      console.error('Bulk tag error:', error)
      showToast('An unexpected error occurred', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setSelectedTagIds([])
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={handleClose}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Add Tag to Cards
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card count info */}
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Apply a tag to <span className="font-medium text-slate-900 dark:text-slate-100">{selectedCardIds.length}</span> selected card{selectedCardIds.length !== 1 ? 's' : ''}.
        </p>

        {/* Tag selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Select Tag
          </label>
          <TagSelector
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
            maxSelections={1}
          />
          {selectedTagIds.length === 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Choose a tag from your existing tags or create a new one first.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button
            onClick={handleApplyTag}
            disabled={isLoading || selectedTagIds.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menerapkan...
              </>
            ) : (
              'Terapkan Tag'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
