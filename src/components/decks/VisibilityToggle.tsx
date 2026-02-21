'use client'

import { useState, useTransition } from 'react'
import { Globe, Lock } from 'lucide-react'
import { updateDeckVisibilityAction } from '@/actions/deck-actions'
import { useToast } from '@/components/ui/Toast'
import type { DeckVisibility } from '@/types/database'

interface VisibilityToggleProps {
  deckId: string
  currentVisibility: DeckVisibility
  isAuthor: boolean
  onVisibilityChange?: (newVisibility: DeckVisibility) => void
}

/**
 * VisibilityToggle Component
 * Allows deck authors to toggle between private and public visibility.
 * 
 * V10.4: Deck Visibility Controls
 * V10.6.1: Added toast notifications and optimistic UI with revert
 * Requirements: 5.1, 5.4
 */
export function VisibilityToggle({
  deckId,
  currentVisibility,
  isAuthor,
  onVisibilityChange,
}: VisibilityToggleProps) {
  const [visibility, setVisibility] = useState<DeckVisibility>(currentVisibility)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useToast()

  // Don't render if user is not the author
  if (!isAuthor) {
    return null
  }

  const isPublic = visibility === 'public'

  const handleToggle = () => {
    const newVisibility: DeckVisibility = isPublic ? 'private' : 'public'
    const previousVisibility = visibility
    
    // V10.6.1: Optimistic update
    setVisibility(newVisibility)
    setError(null)

    startTransition(async () => {
      const result = await updateDeckVisibilityAction(deckId, newVisibility)
      
      if (result.ok) {
        onVisibilityChange?.(newVisibility)
        showToast(`Deck is now ${newVisibility}`, 'success')
      } else {
        // V10.6.1: Revert on failure
        setVisibility(previousVisibility)
        const errorMsg = result.error || 'Failed to update visibility'
        setError(errorMsg)
        showToast(errorMsg, 'error')
      }
    })
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Visibility
      </label>
      
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`
          w-full flex items-center justify-between p-3 rounded-lg border transition-all
          ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-400 dark:hover:border-slate-500'}
          ${isPublic 
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {isPublic ? (
            <Globe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Lock className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          )}
          <div className="text-left">
            <p className={`font-medium ${
              isPublic 
                ? 'text-emerald-700 dark:text-emerald-300' 
                : 'text-slate-700 dark:text-slate-300'
            }`}>
              {isPublic ? 'Public' : 'Private'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPublic 
                ? 'Anyone can discover this deck in the library' 
                : 'Only you can see this deck'
              }
            </p>
          </div>
        </div>
        
        {/* Toggle indicator */}
        <div className={`
          w-10 h-6 rounded-full p-1 transition-colors
          ${isPublic 
            ? 'bg-emerald-500 dark:bg-emerald-600' 
            : 'bg-slate-300 dark:bg-slate-600'
          }
        `}>
          <div className={`
            w-4 h-4 rounded-full bg-white shadow-sm transition-transform
            ${isPublic ? 'translate-x-4' : 'translate-x-0'}
          `} />
        </div>
      </button>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      
      {isPending && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Updating...</p>
      )}
    </div>
  )
}
