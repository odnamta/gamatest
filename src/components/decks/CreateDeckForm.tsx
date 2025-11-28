'use client'

import { useActionState } from 'react'
import { createDeckAction } from '@/actions/deck-actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { ActionResult } from '@/types/actions'

const initialState: ActionResult = { success: true }

export function CreateDeckForm() {
  const [state, formAction, isPending] = useActionState(createDeckAction, initialState)

  return (
    <form action={formAction} className="flex gap-3 items-center">
      <div className="flex-1">
        <Input
          name="title"
          placeholder="Enter new deck title..."
          error={!state.success ? state.fieldErrors?.title?.[0] : undefined}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Deck'}
      </Button>
    </form>
  )
}
