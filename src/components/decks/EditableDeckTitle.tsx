'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { updateDeckTitle } from '@/actions/deck-actions'
import { useToast } from '@/components/ui/Toast'

interface EditableDeckTitleProps {
  deckId: string
  initialTitle: string
}

type EditState = 'viewing' | 'editing' | 'saving'

/**
 * V8.6: EditableDeckTitle Component
 * 
 * Allows deck authors to rename their decks inline with optimistic updates.
 * 
 * Requirements: 3.1, 3.4, 3.5
 * - Displays editable title with pencil icon
 * - Optimistic UI feedback before server confirmation
 * - Reverts to previous title on error
 */
export function EditableDeckTitle({ deckId, initialTitle }: EditableDeckTitleProps) {
  const [state, setState] = useState<EditState>('viewing')
  const [title, setTitle] = useState(initialTitle)
  const [editValue, setEditValue] = useState(initialTitle)
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  // Focus input when entering edit mode
  useEffect(() => {
    if (state === 'editing' && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [state])

  const handleEdit = () => {
    setEditValue(title)
    setState('editing')
  }

  const handleCancel = () => {
    setEditValue(title)
    setState('viewing')
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    
    // Validate
    if (!trimmed) {
      showToast('Title cannot be empty', 'error')
      return
    }
    if (trimmed.length > 100) {
      showToast('Title must be at most 100 characters', 'error')
      return
    }
    
    // No change
    if (trimmed === title) {
      setState('viewing')
      return
    }

    // Optimistic update
    const previousTitle = title
    setTitle(trimmed)
    setState('saving')

    try {
      const result = await updateDeckTitle(deckId, trimmed)
      
      if (result.ok) {
        setState('viewing')
        showToast('Title updated', 'success')
      } else {
        // Revert on error
        setTitle(previousTitle)
        setState('viewing')
        showToast(result.error || 'Failed to update title', 'error')
      }
    } catch {
      // Revert on error
      setTitle(previousTitle)
      setState('viewing')
      showToast('Failed to update title', 'error')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (state === 'viewing') {
    return (
      <div className="flex items-center gap-2 group">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <button
          onClick={handleEdit}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit title"
        >
          <Pencil className="w-4 h-4" />
        </button>
      </div>
    )
  }

  if (state === 'saving') {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    )
  }

  // Editing state
  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="text-2xl font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b-2 border-blue-500 focus:outline-none px-0 py-0"
        maxLength={100}
      />
      <button
        onClick={handleSave}
        className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
        title="Save"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={handleCancel}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Cancel (Esc)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
