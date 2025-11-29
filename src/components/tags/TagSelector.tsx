'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Plus, Check } from 'lucide-react'
import { TagBadge } from './TagBadge'
import { TAG_COLORS, getTagColorClasses } from '@/lib/tag-colors'
import { getUserTags, createTag } from '@/actions/tag-actions'
import { useToast } from '@/components/ui/Toast'
import type { Tag } from '@/types/database'

interface TagSelectorProps {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
}

/**
 * TagSelector - Multi-select dropdown with inline tag creation
 * Requirements: V5 Feature Set 1 - Req 1.3
 */
export function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
  const { showToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('blue')
  const [isCreating, setIsCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load tags on mount
  useEffect(() => {
    async function loadTags() {
      const userTags = await getUserTags()
      setTags(userTags)
      setIsLoading(false)
    }
    loadTags()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowCreateModal(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onChange([...selectedTagIds, tagId])
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    
    setIsCreating(true)
    const result = await createTag(newTagName.trim(), newTagColor)
    setIsCreating(false)

    if (result.ok && result.tag) {
      setTags((prev) => [...prev, result.tag!].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...selectedTagIds, result.tag.id])
      setNewTagName('')
      setShowCreateModal(false)
      showToast(`Tag "${result.tag.name}" created`, 'success')
    } else if (!result.ok) {
      showToast(result.error, 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagName.trim()) {
      e.preventDefault()
      handleCreateTag()
    }
  }

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id))

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected tags display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer flex items-center gap-2 flex-wrap"
      >
        {selectedTags.length > 0 ? (
          selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              onRemove={() => toggleTag(tag.id)}
            />
          ))
        ) : (
          <span className="text-slate-400 text-sm">Select tags...</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 ml-auto flex-shrink-0" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-slate-500">Loading tags...</div>
          ) : (
            <>
              {tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                const { bgClass, textClass } = getTagColorClasses(tag.color)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className={`w-3 h-3 rounded-full ${bgClass}`} />
                    <span className="flex-1 text-left text-sm text-slate-700 dark:text-slate-300">
                      {tag.name}
                    </span>
                    {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                )
              })}
              
              {/* Create new tag button */}
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-t border-slate-100 dark:border-slate-700"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-600">Create new tag</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Create tag modal */}
      {showCreateModal && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
          <div className="space-y-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tag name"
              autoFocus
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {/* Color picker */}
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setNewTagColor(color.value)}
                  className={`w-6 h-6 rounded-full ${color.bgClass} ${
                    newTagColor === color.value ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                  }`}
                  title={color.name}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isCreating}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
