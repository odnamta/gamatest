'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { BookOpen, FolderTree, Lightbulb, Merge, Loader2, Pencil } from 'lucide-react'
import { TagBadge } from './TagBadge'
import { TagMergeModal } from './TagMergeModal'
import { getCategoryColorClasses } from '@/lib/tag-colors'
import { 
  getTagsByCategory, 
  updateTagCategory, 
  mergeMultipleTags,
  renameTag,
  type RenameTagResult 
} from '@/actions/admin-tag-actions'
import { AutoFormatButton } from './AutoFormatButton'
import { useToast } from '@/components/ui/Toast'
import type { Tag, TagCategory } from '@/types/database'

/**
 * V9.5: EditableTagItem - Inline editing for tag names
 * Requirements: 1.1, 1.2, 1.3, 1.5
 */
interface EditableTagItemProps {
  tag: Tag
  isSelected: boolean
  isUpdating: boolean
  onToggleSelect: () => void
  onCategoryChange: (category: TagCategory) => void
  onRenameSuccess: () => void
  onMergeRequest: (sourceTagId: string, targetTagId: string, targetTagName: string) => void
}

function EditableTagItem({
  tag,
  isSelected,
  isUpdating,
  onToggleSelect,
  onCategoryChange,
  onRenameSuccess,
  onMergeRequest,
}: EditableTagItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(tag.name)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    setEditValue(tag.name)
    setError(null)
  }, [tag.name])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setEditValue(tag.name)
    setError(null)
  }, [tag.name])

  const handleSave = useCallback(async () => {
    const trimmedValue = editValue.trim()
    
    // Validate: reject empty names
    if (!trimmedValue) {
      setError('Tag name cannot be empty')
      return
    }

    // No change, just exit edit mode
    if (trimmedValue === tag.name) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const result: RenameTagResult = await renameTag(tag.id, trimmedValue)

      if (result.ok) {
        setIsEditing(false)
        onRenameSuccess()
      } else if ('conflict' in result && result.conflict) {
        // Conflict detected - offer to merge
        setIsEditing(false)
        onMergeRequest(tag.id, result.existingTagId, result.existingTagName)
      } else if ('error' in result) {
        setError(result.error)
      }
    } catch {
      setError('Failed to rename tag')
    } finally {
      setIsSaving(false)
    }
  }, [editValue, tag.id, tag.name, onRenameSuccess, onMergeRequest])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }, [handleSave, handleCancel])

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
          : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
      }`}
    >
      {/* Selection checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        className="w-4 h-4 rounded border-slate-300"
      />

      {/* Tag name - editable or display */}
      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            disabled={isSaving}
            className={`flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              error 
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
            }`}
          />
          {isSaving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
      ) : (
        <>
          <TagBadge tag={tag} size="md" />
          <button
            onClick={handleStartEdit}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Edit tag name"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </>
      )}

      {/* Error message */}
      {error && !isEditing && (
        <span className="text-xs text-red-500">{error}</span>
      )}

      {/* Category selector */}
      <select
        value={tag.category}
        onChange={(e) => onCategoryChange(e.target.value as TagCategory)}
        disabled={isUpdating || isEditing}
        className="ml-auto text-xs bg-transparent border border-slate-200 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="source">Source</option>
        <option value="topic">Topic</option>
        <option value="concept">Concept</option>
      </select>

      {isUpdating && !isEditing && (
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      )}
    </div>
  )
}

interface TagsByCategory {
  source: Tag[]
  topic: Tag[]
  concept: Tag[]
}

/**
 * TagManager - Admin UI for managing tag categories and merging tags
 * V9: Three-column layout with category management and merge functionality
 * V9.2: Enhanced with multi-select and merge modal
 * V9.5: Added inline editing and auto-format
 * Requirements: V9-3.1, V9-3.2, V9-3.3, V9.2-3.1, V9.2-3.2, V9.2-3.3, V9.5-1.1, V9.5-3.1
 */
export function TagManager() {
  const { showToast } = useToast()
  const [tags, setTags] = useState<TagsByCategory>({ source: [], topic: [], concept: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [updatingTagId, setUpdatingTagId] = useState<string | null>(null)
  // V9.5: Merge from rename conflict
  const [pendingMerge, setPendingMerge] = useState<{
    sourceTagId: string
    targetTagId: string
    targetTagName: string
  } | null>(null)

  // Load tags on mount
  useEffect(() => {
    loadTags()
  }, [])

  // V9.2: Get all tags as flat array
  const allTags = useMemo(() => {
    return [...tags.source, ...tags.topic, ...tags.concept]
  }, [tags])

  // V9.2: Get selected tag objects
  const selectedTagObjects = useMemo(() => {
    return allTags.filter(t => selectedTags.includes(t.id))
  }, [allTags, selectedTags])

  // V9.2: Check if merge button should be enabled (>= 2 tags selected)
  const canMerge = selectedTags.length >= 2

  async function loadTags() {
    setIsLoading(true)
    const result = await getTagsByCategory()
    setTags(result)
    setIsLoading(false)
  }

  async function handleCategoryChange(tagId: string, newCategory: TagCategory) {
    setUpdatingTagId(tagId)
    const result = await updateTagCategory(tagId, newCategory)
    setUpdatingTagId(null)

    if (result.ok) {
      showToast('Tag category updated', 'success')
      loadTags()
    } else {
      showToast(result.error, 'error')
    }
  }

  // V9.2: Toggle tag selection (no limit on number of selections)
  function toggleTagSelection(tagId: string) {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId)
      }
      return [...prev, tagId]
    })
  }

  // V9.2: Handle merge with modal
  async function handleMerge(targetTagId: string) {
    const sourceTagIds = selectedTags.filter(id => id !== targetTagId)
    
    if (sourceTagIds.length === 0) {
      showToast('No source tags to merge', 'error')
      return
    }

    const result = await mergeMultipleTags(sourceTagIds, targetTagId)

    if (result.ok) {
      showToast(
        `Merged ${result.deletedTags} tag${result.deletedTags !== 1 ? 's' : ''}, ${result.affectedCards} card${result.affectedCards !== 1 ? 's' : ''} affected`,
        'success'
      )
      setSelectedTags([])
      loadTags()
    } else {
      throw new Error(result.error)
    }
  }

  // V9.5: Handle merge from rename conflict
  async function handleConflictMerge(targetTagId: string) {
    if (!pendingMerge) return

    const result = await mergeMultipleTags([pendingMerge.sourceTagId], targetTagId)

    if (result.ok) {
      showToast(
        `Merged tag, ${result.affectedCards} card${result.affectedCards !== 1 ? 's' : ''} affected`,
        'success'
      )
      setPendingMerge(null)
      loadTags()
    } else {
      showToast(result.error, 'error')
    }
  }

  // V9.5: Handle rename conflict - show merge modal
  function handleMergeRequest(sourceTagId: string, targetTagId: string, targetTagName: string) {
    setPendingMerge({ sourceTagId, targetTagId, targetTagName })
    // Find the source tag to show in modal
    const sourceTag = allTags.find(t => t.id === sourceTagId)
    const targetTag = allTags.find(t => t.id === targetTagId)
    if (sourceTag && targetTag) {
      setSelectedTags([sourceTagId, targetTagId])
      setShowMergeModal(true)
    }
  }



  const categoryConfig: Array<{
    key: TagCategory
    title: string
    icon: typeof BookOpen
    description: string
  }> = [
    {
      key: 'source',
      title: 'Sources',
      icon: BookOpen,
      description: 'Textbook origins',
    },
    {
      key: 'topic',
      title: 'Topics',
      icon: FolderTree,
      description: 'Medical domains',
    },
    {
      key: 'concept',
      title: 'Concepts',
      icon: Lightbulb,
      description: 'Specific concepts',
    },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* V9.5: Toolbar with auto-format and merge */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        {/* V9.5: Auto-format button */}
        <AutoFormatButton onComplete={loadTags} />

        {selectedTags.length > 0 && (
          <>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} selected
            </span>
            {/* V9.2: Merge button enabled when >= 2 tags selected */}
            <button
              onClick={() => setShowMergeModal(true)}
              disabled={!canMerge}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Merge className="w-4 h-4" />
              Merge Selected
            </button>
            <button
              onClick={() => setSelectedTags([])}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Clear selection
            </button>
          </>
        )}
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categoryConfig.map(({ key, title, icon: Icon, description }) => {
          const categoryTags = tags[key]
          const { bgClass, textClass } = getCategoryColorClasses(key)

          return (
            <div
              key={key}
              className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              {/* Header */}
              <div className={`px-4 py-3 ${bgClass}`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${textClass}`} />
                  <h3 className={`font-medium ${textClass}`}>{title}</h3>
                  <span className={`ml-auto text-sm ${textClass}`}>
                    {categoryTags.length}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${textClass} opacity-75`}>{description}</p>
              </div>

              {/* Tag list */}
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {categoryTags.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No {title.toLowerCase()} yet
                  </p>
                ) : (
                  categoryTags.map(tag => (
                    <EditableTagItem
                      key={tag.id}
                      tag={tag}
                      isSelected={selectedTags.includes(tag.id)}
                      isUpdating={updatingTagId === tag.id}
                      onToggleSelect={() => toggleTagSelection(tag.id)}
                      onCategoryChange={(category) => handleCategoryChange(tag.id, category)}
                      onRenameSuccess={loadTags}
                      onMergeRequest={handleMergeRequest}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Instructions */}
      <div className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
        <p>• Click the pencil icon to rename a tag inline</p>
        <p>• Select a tag&apos;s category from the dropdown to move it between columns</p>
        <p>• Check two or more tags and click &quot;Merge Selected&quot; to combine them</p>
        <p>• Click &quot;Auto-Format Tags&quot; to convert all tags to Title Case</p>
      </div>

      {/* V9.2: Merge Modal */}
      <TagMergeModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        sourceTags={selectedTagObjects}
        onMerge={handleMerge}
      />
    </div>
  )
}
