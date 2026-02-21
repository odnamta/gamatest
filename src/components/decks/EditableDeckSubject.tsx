'use client'

import { useState, useRef, useEffect } from 'react'
import { Pencil, Check, X, Loader2, BookOpen } from 'lucide-react'
import { updateDeckSubject } from '@/actions/deck-actions'
import { useToast } from '@/components/ui/Toast'

/**
 * V9.1: Common subject areas for subject dropdown
 */
const COMMON_SUBJECTS = [
  'General',
  'Safety',
  'Operations',
  'Management',
  'Technical',
  'Compliance',
  'Customer Service',
  'Logistics',
  'Finance',
  'Human Resources',
]

interface EditableDeckSubjectProps {
  deckId: string
  initialSubject: string
}

type EditState = 'viewing' | 'editing' | 'saving'

/**
 * V9.1: EditableDeckSubject Component
 * 
 * Allows deck authors to change the subject for AI prompts.
 *
 * Requirements: V9.1 3.2
 * - Displays current subject with edit icon
 * - Dropdown with common subject areas
 * - Optimistic UI feedback before server confirmation
 */
export function EditableDeckSubject({ deckId, initialSubject }: EditableDeckSubjectProps) {
  const [state, setState] = useState<EditState>('viewing')
  const [subject, setSubject] = useState(initialSubject || 'General')
  const [editValue, setEditValue] = useState(initialSubject || 'General')
  const selectRef = useRef<HTMLSelectElement>(null)
  const { showToast } = useToast()

  // Focus select when entering edit mode
  useEffect(() => {
    if (state === 'editing' && selectRef.current) {
      selectRef.current.focus()
    }
  }, [state])

  const handleEdit = () => {
    setEditValue(subject)
    setState('editing')
  }

  const handleCancel = () => {
    setEditValue(subject)
    setState('viewing')
  }


  const handleSave = async () => {
    const trimmed = editValue.trim()
    
    // No change
    if (trimmed === subject) {
      setState('viewing')
      return
    }

    // Optimistic update
    const previousSubject = subject
    setSubject(trimmed)
    setState('saving')

    try {
      const result = await updateDeckSubject(deckId, trimmed)
      
      if (result.ok) {
        setState('viewing')
        showToast('Subject updated', 'success')
      } else {
        // Revert on error
        setSubject(previousSubject)
        setState('viewing')
        showToast(result.error || 'Failed to update subject', 'error')
      }
    } catch {
      // Revert on error
      setSubject(previousSubject)
      setState('viewing')
      showToast('Failed to update subject', 'error')
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
        <BookOpen className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {subject}
        </span>
        <button
          onClick={handleEdit}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Edit subject"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    )
  }

  if (state === 'saving') {
    return (
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {subject}
        </span>
        <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
      </div>
    )
  }

  // Editing state
  return (
    <div className="flex items-center gap-2">
      <BookOpen className="w-4 h-4 text-slate-400" />
      <select
        ref={selectRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="text-sm px-2 py-1 border border-blue-500 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {COMMON_SUBJECTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button
        onClick={handleSave}
        className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
        title="Save"
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        onClick={handleCancel}
        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Cancel (Esc)"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
