'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, StickyNote, Check, AlertCircle } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { saveCardNotes } from '@/actions/notebook-actions'

export interface NotesSectionProps {
  cardTemplateId: string
  initialNotes: string | null
  onSave?: (notes: string) => void
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * NotesSection - Collapsible personal notes for cards
 * V10.6: Digital Notebook
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 * - 2.1: Collapsible section below explanation
 * - 2.2: Auto-save after 1000ms of inactivity
 * - 2.3: "Saving..." indicator
 * - 2.4: "Saved" confirmation
 * - 2.5: Error handling with content preservation
 */
export function NotesSection({
  cardTemplateId,
  initialNotes,
  onSave,
}: NotesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(!!initialNotes)
  const [notes, setNotes] = useState(initialNotes || '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedNotes, setLastSavedNotes] = useState(initialNotes || '')

  // Auto-hide "Saved" status after 2 seconds
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveStatus])

  // Debounced save function (1000ms)
  const debouncedSave = useDebouncedCallback(
    async (notesValue: string) => {
      // Don't save if content hasn't changed
      if (notesValue === lastSavedNotes) {
        return
      }

      setSaveStatus('saving')
      
      const result = await saveCardNotes(cardTemplateId, notesValue)
      
      if (result.ok) {
        setSaveStatus('saved')
        setLastSavedNotes(notesValue)
        onSave?.(notesValue)
      } else {
        setSaveStatus('error')
        // Content is preserved in state - user can retry
      }
    },
    1000
  )

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value)
    debouncedSave(value)
  }, [debouncedSave])

  const getStatusIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Menyimpan...
          </span>
        )
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="w-3 h-3" />
            Tersimpan
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-3 h-3" />
            Gagal menyimpan
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header - Collapsible toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-expanded={isExpanded}
        aria-controls="notes-content"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <StickyNote className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            My Notes
          </span>
          {notes && !isExpanded && (
            <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
              (has notes)
            </span>
          )}
        </div>
        {isExpanded && getStatusIndicator()}
      </button>

      {/* Content - Notes textarea */}
      {isExpanded && (
        <div id="notes-content" className="p-4 bg-white dark:bg-slate-900">
          <textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Add your notes, mnemonics, or insights..."
            className="w-full min-h-[100px] p-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500"
            aria-label="Personal notes"
          />
          {saveStatus === 'error' && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              Your notes are preserved. Please try again later.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
