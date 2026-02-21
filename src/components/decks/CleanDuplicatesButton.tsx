'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Loader2, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { removeDuplicateCards } from '@/actions/card-actions'

interface CleanDuplicatesButtonProps {
  deckId: string
}

/**
 * V8.3: Clean Duplicates Button
 * Calls removeDuplicateCards server action and displays result.
 * Requirements: 3.4
 */
export function CleanDuplicatesButton({ deckId }: CleanDuplicatesButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { showToast } = useToast()
  const router = useRouter()

  const handleClick = async () => {
    setIsLoading(true)
    
    try {
      const result = await removeDuplicateCards(deckId)
      
      if (result.ok) {
        const deletedCount = result.data?.deletedCount ?? 0
        if (deletedCount === 0) {
          showToast('No duplicate cards found', 'info')
        } else {
          showToast(`Removed ${deletedCount} duplicate card${deletedCount === 1 ? '' : 's'}`, 'success')
          router.refresh()
        }
      } else {
        showToast(result.error || 'Failed to clean duplicates', 'error')
      }
    } catch (err) {
      console.error('Clean duplicates error:', err)
      showToast('An error occurred', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Cleaning...
        </>
      ) : (
        <>
          <Trash2 className="w-4 h-4" />
          Clean Duplicates
        </>
      )}
    </Button>
  )
}
