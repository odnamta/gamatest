'use client'

import { useActionState, useRef, useState, useEffect } from 'react'
import { createCardAction } from '@/actions/card-actions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { TagSelector } from '@/components/tags/TagSelector'
import type { ActionResultV2 } from '@/types/actions'

interface CreateCardFormProps {
  deckId: string
}

const initialState: ActionResultV2 = { ok: true }

/**
 * Client Component for creating new flashcards.
 * Includes Textarea for front/back content and optional image URL.
 * Requirements: 3.1, 3.2
 */
export function CreateCardForm({ deckId }: CreateCardFormProps) {
  const [state, formAction, isPending] = useActionState(createCardAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

  // Reset form on successful submission
  // Track state transitions during render for React state resets
  const [prevState, setPrevState] = useState(state)
  if (prevState !== state) {
    setPrevState(state)
    if (state.ok) {
      setSelectedTagIds([])
    }
  }

  // Reset the DOM form element via ref in an effect (refs can't be accessed during render)
  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset()
    }
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {/* Hidden deck ID */}
      <input type="hidden" name="deckId" value={deckId} />

      {/* Front content */}
      <Textarea
        label="Front (Question)"
        name="front"
        placeholder="Enter the question or prompt..."
      />

      {/* Back content */}
      <Textarea
        label="Back (Answer)"
        name="back"
        placeholder="Enter the answer..."
      />

      {/* Markdown helper text (Requirement 5.3) */}
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
          {isPending ? 'Adding Card...' : 'Add Card'}
        </Button>
      </div>
    </form>
  )
}
