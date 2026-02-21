'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { createDeckAction } from '@/actions/deck-actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ActionResultV2 } from '@/types/actions'

/**
 * V9.1: Common subject areas for subject dropdown
 */
const COMMON_SUBJECTS = [
  'General',
  'Internal Medicine',
  'Pediatrics',
  'Surgery',
  'Family Medicine',
  'Emergency Medicine',
  'Psychiatry',
  'Neurology',
  'Cardiology',
  'Dermatology',
]

const initialState: ActionResultV2 = { ok: true }

/**
 * V9.1: Enhanced CreateDeckForm with subject field
 * Requirements: V9.1 3.1
 */
export function CreateDeckForm() {
  const [state, formAction, isPending] = useActionState(createDeckAction, initialState)
  const [showSubject, setShowSubject] = useState(false)

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex gap-3 items-center">
        <div className="flex-1">
          <Input
            name="title"
            placeholder="Enter new deck title..."
            error={!state.ok ? state.error : undefined}
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Deck'}
        </Button>
      </div>
      
      {/* V9.1: Subject field toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSubject(!showSubject)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showSubject ? '− Hide subject' : '+ Add subject (for AI)'}
        </button>
      </div>

      {/* V9.1: Subject dropdown */}
      {showSubject && (
        <div className="flex gap-3 items-center">
          <label className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
            Subject:
          </label>
          <select
            name="subject"
            defaultValue="General"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {COMMON_SUBJECTS.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Hidden default subject when not shown */}
      {!showSubject && (
        <input type="hidden" name="subject" value="General" />
      )}
    </form>
  )
}
