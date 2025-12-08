'use client'

import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createTag, updateTag } from '@/actions/tag-actions'
import { getCategoryColor, getTagColorClasses, CATEGORY_COLORS } from '@/lib/tag-colors'
import { useToast } from '@/components/ui/Toast'
import type { Tag, TagCategory } from '@/types/database'

interface TagCreateDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (tag: Tag) => void
  /** Tag to edit (null for create mode) */
  editTag?: Tag | null
  /** Default category for create mode */
  defaultCategory?: TagCategory
  /** Default name for create mode (e.g., from search query) */
  defaultName?: string
}

/**
 * TagCreateDialog - Modal for creating and editing tags
 * V11.3: Unified dialog for full tag configuration
 * Requirements: 1.1, 1.2, 2.1, 2.3, 4.2, 4.3
 */
export function TagCreateDialog({
  isOpen,
  onClose,
  onSuccess,
  editTag = null,
  defaultCategory = 'concept',
  defaultName = '',
}: TagCreateDialogProps) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<TagCategory>(defaultCategory)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = editTag !== null

  // Reset form when dialog opens/closes or editTag changes
  useEffect(() => {
    if (isOpen) {
      if (editTag) {
        setName(editTag.name)
        setCategory(editTag.category)
      } else {
        setName(defaultName)
        setCategory(defaultCategory)
      }
      setError(null)
    }
  }, [isOpen, editTag, defaultName, defaultCategory])

  // Get color based on selected category (enforced by system)
  const colorValue = getCategoryColor(category)
  const { bgClass, textClass } = getTagColorClasses(colorValue)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Tag name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditMode && editTag) {
        // Update existing tag
        const result = await updateTag(editTag.id, trimmedName, category)
        if (result.ok && result.tag) {
          showToast(`Tag "${result.tag.name}" updated`, 'success')
          onSuccess(result.tag)
          onClose()
        } else if (!result.ok) {
          setError(result.error)
        }
      } else {
        // Create new tag
        const result = await createTag(trimmedName, category)
        if (result.ok && result.tag) {
          showToast(`Tag "${result.tag.name}" created`, 'success')
          onSuccess(result.tag)
          onClose()
        } else if (!result.ok) {
          setError(result.error)
        }
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEditMode ? 'Edit Tag' : 'Create Tag'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name input */}
          <div>
            <label 
              htmlFor="tag-name" 
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Name
            </label>
            <input
              id="tag-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter tag name..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              maxLength={50}
            />
          </div>

          {/* Category select */}
          <div>
            <label 
              htmlFor="tag-category" 
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Category
            </label>
            <select
              id="tag-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as TagCategory)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="source">Source (Textbook origins)</option>
              <option value="topic">Topic (Medical domains)</option>
              <option value="concept">Concept (Specific concepts)</option>
            </select>
          </div>

          {/* Color preview (read-only, enforced by category) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Color Preview
            </label>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${bgClass} ${textClass}`}>
                {name.trim() || 'Tag Preview'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Color is determined by category ({CATEGORY_COLORS[category]})
              </span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Tag'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Helper function to get default category for TagCreateDialog
 * Exported for property testing
 */
export function getDefaultCategory(context: 'admin' | 'selector', columnCategory?: TagCategory): TagCategory {
  if (context === 'admin' && columnCategory) {
    return columnCategory
  }
  // TagSelector always defaults to 'concept'
  return 'concept'
}
