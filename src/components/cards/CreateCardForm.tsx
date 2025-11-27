'use client'

import { useActionState, useRef, useEffect } from 'react'
import { createCardAction } from '@/actions/card-actions'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import type { ActionResult } from '@/types/actions'

interface CreateCardFormProps {
  deckId: string
}

const initialState: ActionResult = { success: true }

/**
 * Client Component for creating new flashcards.
 * Includes Textarea for front/back content and optional image URL.
 * Requirements: 3.1, 3.2
 */
export function CreateCardForm({ deckId }: CreateCardFormProps) {
  const [state, formAction, isPending] = useActionState(createCardAction, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Reset form on successful submission
  useEffect(() => {
    if (state.success && formRef.current) {
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
        error={!state.success ? state.fieldErrors?.front?.[0] : undefined}
      />

      {/* Back content */}
      <Textarea
        label="Back (Answer)"
        name="back"
        placeholder="Enter the answer..."
        error={!state.success ? state.fieldErrors?.back?.[0] : undefined}
      />

      {/* Markdown helper text (Requirement 5.3) */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Supports markdown: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">**bold**</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">*italic*</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">`code`</code>
      </p>

      {/* Optional image URL */}
      <Input
        label="Image URL (optional)"
        name="imageUrl"
        type="url"
        placeholder="https://example.com/image.jpg"
        error={!state.success ? state.fieldErrors?.imageUrl?.[0] : undefined}
      />

      {/* Error message */}
      {!state.success && state.error && !state.fieldErrors && (
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
