'use client'

import { useState, useTransition } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { syncAuthorProgress } from '@/actions/deck-actions'
import { useToast } from '@/components/ui/Toast'

interface SyncProgressButtonProps {
  deckId: string
}

/**
 * V10.6.1: Sync Progress Button
 * Allows authors to sync their progress for a deck.
 * Creates user_card_progress rows for all cards they don't have progress for.
 * Fixes the "0 Cards Due" issue for authors.
 */
export function SyncProgressButton({ deckId }: SyncProgressButtonProps) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleSync = () => {
    startTransition(async () => {
      const result = await syncAuthorProgress(deckId)
      if (result.ok) {
        const data = result.data as { synced: number } | undefined
        const synced = data?.synced ?? 0
        showToast(`Progress synced! ${synced} cards ready for review.`, 'success')
      } else {
        showToast(result.error || 'Sync failed', 'error')
      }
    })
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={handleSync}
      disabled={isPending}
    >
      <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
      {isPending ? 'Syncing...' : 'Sync Progress'}
    </Button>
  )
}
