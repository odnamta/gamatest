'use client'

import { useActionState, useRef, useEffect, useState } from 'react'
import { createMCQAction } from '@/actions/mcq-actions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { TagSelector } from '@/components/tags/TagSelector'
import { getOptionLabel, adjustCorrectIndexAfterRemoval } from '@/lib/mcq-options'
import type { ActionResultV2 } from '@/types/actions'

interface CreateMCQFormProps {
  deckId: string
  initialStem?: string
  initialOptions?: string[]
  initialExplanation?: string
  onSuccess?: () => void
}

const initialState: ActionResultV2 = { ok: true }

const MIN_OPTIONS = 2
const MAX_OPTIONS = 5  // A-E for standard multiple choice
const DEFAULT_OPTIONS = 4

/**
 * Client Component for creating new MCQ cards.
 * Includes stem textarea, dynamic options with add/remove (A-J), correct answer selector,
 * optional explanation, and optional image URL.
 * 
 * Requirements: 3.1, 3.3, 6.1, 6.2, 6.3, 6.4
 */
export function CreateMCQForm({ 
  deckId, 
  initialStem = '',
  initialOptions,
  initialExplanation = '',
  onSuccess,
}: CreateMCQFormProps) {
  const [state, formAction, isPending] = useActionState(createMCQAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [options, setOptions] = useState<string[]>(
    initialOptions || Array(DEFAULT_OPTIONS).fill('')
  )
  const [correctIndex, setCorrectIndex] = useState<number>(0)
  const [stem, setStem] = useState(initialStem)
  const [explanation, setExplanation] = useState(initialExplanation)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Track initial values for sync
  const [lastInitialStem, setLastInitialStem] = useState(initialStem)
  const [lastInitialExplanation, setLastInitialExplanation] = useState(initialExplanation)

  // Sync with initial props when they change from parent
  if (initialStem !== lastInitialStem) {
    setStem(initialStem)
    setLastInitialStem(initialStem)
  }
  if (initialExplanation !== lastInitialExplanation) {
    setExplanation(initialExplanation)
    setLastInitialExplanation(initialExplanation)
  }

  // Reset form on successful submission
  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset()
      setOptions(Array(DEFAULT_OPTIONS).fill(''))
      setCorrectIndex(0)
      setStem('')
      setExplanation('')
      setSelectedTagIds([])
      onSuccess?.()
    }
  }, [state, onSuccess])

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > MIN_OPTIONS) {
      const newOptions = options.filter((_, i) => i !== index)
      setOptions(newOptions)
      // Adjust correctIndex using utility function
      const adjustedIndex = adjustCorrectIndexAfterRemoval(
        correctIndex,
        index,
        newOptions.length
      )
      setCorrectIndex(adjustedIndex)
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Hidden deck ID */}
      <input type="hidden" name="deckId" value={deckId} />
      {/* Hidden correct index */}
      <input type="hidden" name="correctIndex" value={correctIndex} />

      {/* Stem (Question) */}
      <Textarea
        label="Question Stem"
        name="stem"
        value={stem}
        onChange={(e) => setStem(e.target.value)}
        placeholder="Enter the question or scenario..."
      />

      {/* Markdown helper text */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Supports markdown: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">**bold**</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">*italic*</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">`code`</code>
      </p>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Tags (optional)
        </label>
        <TagSelector
          selectedTagIds={selectedTagIds}
          onChange={setSelectedTagIds}
        />
        {/* Hidden inputs for tag IDs */}
        {selectedTagIds.map((tagId, index) => (
          <input key={tagId} type="hidden" name={`tagId_${index}`} value={tagId} />
        ))}
      </div>

      {/* Options section - Dynamic with letter labels */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Answer Options
        </label>
        

        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* Radio button for correct answer selection */}
            <input
              type="radio"
              name="correctAnswerRadio"
              checked={correctIndex === index}
              onChange={() => setCorrectIndex(index)}
              className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
              aria-label={`Mark option ${getOptionLabel(index)} as correct`}
            />
            
            {/* Letter label */}
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 w-6">
              {getOptionLabel(index)}.
            </span>
            
            {/* Option input */}
            <input
              type="text"
              name={`option_${index}`}
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={`Option ${getOptionLabel(index)}`}
              className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            
            {/* Remove button (only show if more than MIN_OPTIONS) */}
            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                aria-label={`Remove option ${getOptionLabel(index)}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {/* Add option button */}
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            + Add Option
          </button>
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Select the radio button next to the correct answer. Min {MIN_OPTIONS}, max {MAX_OPTIONS} options (A-{getOptionLabel(MAX_OPTIONS - 1)}).
        </p>
      </div>

      {/* Explanation (optional) */}
      <Textarea
        label="Explanation (optional)"
        name="explanation"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
        placeholder="Explain why the correct answer is correct..."
      />

      {/* Optional image URL */}
      <Input
        label="Image URL (optional)"
        name="imageUrl"
        type="url"
        placeholder="https://example.com/image.jpg"
      />

      {/* Error message */}
      {!state.ok && (
        <p className="text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      {/* Submit button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Adding MCQ...' : 'Add MCQ'}
        </Button>
      </div>
    </form>
  )
}
