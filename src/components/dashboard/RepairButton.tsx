'use client'

import { useState, useEffect, useTransition } from 'react'
import { Wrench, CheckCircle, AlertCircle, Merge } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  checkHealthStatus,
  healAuthorProgress,
  findDuplicateDeckGroups,
  mergeDuplicateDecks,
  type DuplicateDecksResult,
} from '@/actions/heal-actions'

/**
 * V8.1: RepairButton Component
 * V8.2: Added Smart Deck Merge functionality
 * 
 * Shows repair buttons for:
 * 1. Cards without progress records
 * 2. Duplicate decks that can be merged
 */
export function RepairButton() {
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'checking' | 'healthy' | 'needs-repair' | 'repaired' | 'error'>('checking')
  const [missingCount, setMissingCount] = useState(0)
  const [healedCount, setHealedCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  // V8.2: Duplicate deck state
  const [duplicateStatus, setDuplicateStatus] = useState<'checking' | 'none' | 'found' | 'merged' | 'error'>('checking')
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateDecksResult | null>(null)
  const [mergeResult, setMergeResult] = useState<{ mergedCount: number; movedCards: number; deletedDuplicates: number } | null>(null)

  // Check health status on mount
  useEffect(() => {
    // Check for missing progress records
    checkHealthStatus().then(result => {
      if (result.ok && result.data?.needsRepair) {
        setStatus('needs-repair')
        setMissingCount(result.data.missingCount)
      } else {
        setStatus('healthy')
      }
    }).catch(() => {
      setStatus('healthy') // Don't show button on error
    })

    // V8.2: Check for duplicate decks
    findDuplicateDeckGroups().then(result => {
      if (result.ok && result.data?.hasDuplicates) {
        setDuplicateStatus('found')
        setDuplicateInfo(result.data)
      } else {
        setDuplicateStatus('none')
      }
    }).catch(() => {
      setDuplicateStatus('none')
    })
  }, [])

  const handleRepair = () => {
    startTransition(async () => {
      const result = await healAuthorProgress()
      if (result.ok) {
        setStatus('repaired')
        setHealedCount(result.data?.healedCount ?? 0)
      } else {
        setStatus('error')
        setErrorMessage(result.error || 'Unknown error')
      }
    })
  }

  // V8.2: Handle merge duplicates
  const handleMerge = () => {
    startTransition(async () => {
      const result = await mergeDuplicateDecks()
      if (result.ok) {
        setDuplicateStatus('merged')
        setMergeResult(result.data ?? { mergedCount: 0, movedCards: 0, deletedDuplicates: 0 })
      } else {
        setDuplicateStatus('error')
        setErrorMessage(result.error || 'Merge failed')
      }
    })
  }

  // Don't render anything while checking or if both are healthy/none
  const showMissingCards = status === 'needs-repair' || status === 'repaired' || status === 'error'
  const showDuplicates = duplicateStatus === 'found' || duplicateStatus === 'merged' || duplicateStatus === 'error'
  
  if (!showMissingCards && !showDuplicates) {
    return null
  }

  // Show success message after repair
  if (status === 'repaired') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
        <CheckCircle className="w-4 h-4" />
        <span>Repair Complete: {healedCount} missing cards added to your study queue.</span>
      </div>
    )
  }

  // Show error message
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
        <AlertCircle className="w-4 h-4" />
        <span>Repair failed: {errorMessage}</span>
      </div>
    )
  }

  // Render all applicable repair options
  return (
    <div className="space-y-3">
      {/* Missing cards repair button */}
      {status === 'needs-repair' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {missingCount} card{missingCount !== 1 ? 's' : ''} missing from your study queue.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRepair}
            disabled={isPending}
            className="flex-shrink-0"
          >
            <Wrench className="w-4 h-4 mr-1" />
            {isPending ? 'Repairing...' : 'Run Repair'}
          </Button>
        </div>
      )}

      {/* V8.2: Duplicate decks merge button */}
      {duplicateStatus === 'found' && duplicateInfo && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Merge className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {duplicateInfo.duplicateCount} duplicate deck{duplicateInfo.duplicateCount !== 1 ? 's' : ''} found. Merge to combine cards.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleMerge}
            disabled={isPending}
            className="flex-shrink-0"
          >
            <Merge className="w-4 h-4 mr-1" />
            {isPending ? 'Merging...' : 'Merge Duplicates'}
          </Button>
        </div>
      )}

      {/* V8.2: Merge success message */}
      {duplicateStatus === 'merged' && mergeResult && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>
            Merge Complete: {mergeResult.movedCards} cards moved, {mergeResult.deletedDuplicates} duplicates removed.
          </span>
        </div>
      )}
    </div>
  )
}
