'use client'

import { useState, useTransition } from 'react'
import { Bookmark } from 'lucide-react'
import { toggleCardFlag } from '@/actions/notebook-actions'

export interface FlagIconProps {
  cardTemplateId: string
  isFlagged: boolean
  onToggle?: (newState: boolean) => void
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

const buttonSizeClasses = {
  sm: 'p-1',
  md: 'p-1.5',
  lg: 'p-2',
}

/**
 * FlagIcon - Toggle button for flagging/bookmarking cards
 * V10.6: Digital Notebook
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5
 * - 1.2: Filled bookmark when flagged
 * - 1.3: Outline bookmark when not flagged
 * - 1.4: Immediate visual feedback
 * - 1.5: Error rollback
 */
export function FlagIcon({
  cardTemplateId,
  isFlagged: initialFlagged,
  onToggle,
  size = 'md',
}: FlagIconProps) {
  const [isFlagged, setIsFlagged] = useState(initialFlagged)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleClick = () => {
    // Optimistic update
    const previousState = isFlagged
    setIsFlagged(!isFlagged)
    setError(null)

    startTransition(async () => {
      const result = await toggleCardFlag(cardTemplateId)
      
      if (!result.success) {
        // Rollback on error
        setIsFlagged(previousState)
        setError(result.error || 'Failed to update flag')
        return
      }

      // Update with server state (should match optimistic)
      setIsFlagged(result.isFlagged)
      onToggle?.(result.isFlagged)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`
        ${buttonSizeClasses[size]}
        rounded-lg transition-all duration-200
        ${isFlagged 
          ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300' 
          : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
        }
        ${isPending ? 'opacity-50 cursor-wait' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}
        focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800
      `}
      aria-label={isFlagged ? 'Remove flag' : 'Flag card'}
      aria-pressed={isFlagged}
      title={error || (isFlagged ? 'Flagged for review' : 'Flag for later')}
    >
      <Bookmark
        className={`${sizeClasses[size]} ${isFlagged ? 'fill-current' : ''}`}
      />
    </button>
  )
}
