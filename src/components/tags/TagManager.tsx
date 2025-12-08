'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { BookOpen, FolderTree, Lightbulb, Merge, Loader2, Pencil, Sparkles, Settings, Plus, Trash2 } from 'lucide-react'
import { TagBadge } from './TagBadge'
import { TagMergeModal } from './TagMergeModal'
import { TagCreateDialog } from './TagCreateDialog'
import { DeleteTagConfirmDialog } from './DeleteTagConfirmDialog'
import { SmartCleanupTab } from './SmartCleanupTab'
import { getCategoryColorClasses } from '@/lib/tag-colors'
import { 
  getTagsByCategory, 
  updateTagCategory, 
  mergeMultipleTags,
  renameTag,
  type RenameTagResult 
} from '@/actions/admin-tag-actions'
import { deleteTag } from '@/actions/tag-actions'
import { AutoFormatButton } from './AutoFormatButton'
import { useToast } from '@/components/ui/Toast'
import type { Tag, TagCategory } from '@/types/database'

/**
 * V9.5: EditableTagItem - Inline editing for tag names
 * V11.3: Added delete control and edit via dialog
 * Requirements: 1.1, 1.2, 1.3, 1.5, V11.3-3.1, V11.3-3.3
 */
interface EditableTagItemProps {
  tag: Tag
  isSelected: boolean
  isUpdating: boolean
  onToggleSelect: () => void
  onCategoryChange: (category: TagCategory) => void
  onRenameSuccess: () => void
  onMergeRequest: (sourceTagId: string, targetTagId: string, targetTagName: string) => void
  onEditClick: (tag: Tag) => void
  onDeleteClick: (tag: Tag) => void
}

function EditableTagItem({
  tag,
  isSelected,
  isUpdating,
  onToggleSelect,
  onCategoryChange,
  onRenameSuccess,
  onMergeRequest,
  onEditClick,
  onDeleteClick,
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
          {/* V11.3: Edit button opens dialog */}
          <button
            onClick={() => onEditClick(tag)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Edit tag"
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

      {/* V11.3: Delete button */}
      <button
        onClick={() => onDeleteClick(tag)}
        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
        title="Delete tag"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

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

// V9.6: Tab type for navigation
type TabType = 'manage' | 'cleanup'

/**
 * TagManager - Admin UI for managing tag categories and merging tags
 * V9: Three-column layout with category management and merge functionality
 * V9.2: Enhanced with multi-select and merge modal
 * V9.5: Added inline editing and auto-format
 * V9.6: Added Smart Cleanup tab for AI-powered tag consolidation
 * V11.3: Added Add Tag button, delete controls, and TagCreateDialog integration
 * Requirements: V9-3.1, V9-3.2, V9-3.3, V9.2-3.1, V9.2-3.2, V9.2-3.3, V9.5-1.1, V9.5-3.1, V9.6-3.1, V11.3-1.1, V11.3-3.1
 */
export function TagManager() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>('manage')
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
  // V11.3: Create/Edit dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createDialogCategory, setCreateDialogCategory] = useState<TagCategory>('concept')
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  // V11.3: Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  // V11.3: Open create dialog for a specific category
  function handleAddTag(category: TagCategory) {
    setCreateDialogCategory(category)
    setEditingTag(null)
    setShowCreateDialog(true)
  }

  // V11.3: Open edit dialog for a tag
  function handleEditTag(tag: Tag) {
    setEditingTag(tag)
    setCreateDialogCategory(tag.category)
    setShowCreateDialog(true)
  }

  // V11.3: Handle tag creation/edit success
  function handleTagSuccess() {
    loadTags()
  }

  // V11.3: Open delete confirmation
  function handleDeleteClick(tag: Tag) {
    setDeletingTag(tag)
    setShowDeleteConfirm(true)
  }

  // V11.3: Confirm tag deletion
  async function handleConfirmDelete() {
    if (!deletingTag) return

    setIsDeleting(true)
    const result = await deleteTag(deletingTag.id)
    setIsDeleting(false)

    if (result.ok) {
      showToast(`Tag "${deletingTag.name}" deleted`, 'success')
      setShowDeleteConfirm(false)
      setDeletingTag(null)
      loadTags()
    } else {
      showToast(result.error, 'error')
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
      {/* V9.6: Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('manage')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'manage'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          Manage Tags
        </button>
        <button
          onClick={() => setActiveTab('cleanup')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'cleanup'
              ? 'border-violet-600 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Smart Cleanup
        </button>
      </div>

      {/* V9.6: Smart Cleanup Tab */}
      {activeTab === 'cleanup' && (
        <SmartCleanupTab onMergeComplete={loadTags} />
      )}

      {/* Manage Tags Tab Content */}
      {activeTab === 'manage' && (
        <>
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
                  <span className={`text-sm ${textClass}`}>
                    {categoryTags.length}
                  </span>
                  {/* V11.3: Add Tag button */}
                  <button
                    onClick={() => handleAddTag(key)}
                    className={`ml-auto p-1 rounded-md hover:bg-white/20 transition-colors ${textClass}`}
                    title={`Add ${title.slice(0, -1)}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-xs mt-1 ${textClass} opacity-75`}>{description}</p>
              </div>

              {/* Tag list */}
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {categoryTags.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-400 mb-3">
                      No {title.toLowerCase()} yet
                    </p>
                    {/* V11.3: Add Tag button in empty state */}
                    <button
                      onClick={() => handleAddTag(key)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add {title.slice(0, -1)}
                    </button>
                  </div>
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
                      onEditClick={handleEditTag}
                      onDeleteClick={handleDeleteClick}
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
        <p>• Click the + button in a column header to add a new tag</p>
        <p>• Click the pencil icon to edit a tag&apos;s name and category</p>
        <p>• Click the trash icon to delete a tag (removes from all cards)</p>
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

      {/* V11.3: Create/Edit Dialog */}
      <TagCreateDialog
        isOpen={showCreateDialog}
        onClose={() => {
          setShowCreateDialog(false)
          setEditingTag(null)
        }}
        onSuccess={handleTagSuccess}
        editTag={editingTag}
        defaultCategory={createDialogCategory}
      />

      {/* V11.3: Delete Confirmation Dialog */}
      <DeleteTagConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false)
          setDeletingTag(null)
        }}
        onConfirm={handleConfirmDelete}
        tag={deletingTag}
        isDeleting={isDeleting}
      />
        </>
      )}
    </div>
  )
}
