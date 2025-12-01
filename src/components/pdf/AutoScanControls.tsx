/**
 * V7.0: Auto-Scan Controls Component
 * Floating control bar for the auto-scan loop.
 */

'use client'

import { Play, Pause, Square, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface AutoScanControlsProps {
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: { cardsCreated: number; pagesProcessed: number }
  skippedCount: number
  onStart: () => void
  onPause: () => void
  onStop: () => void
  onViewSkipped?: () => void
  disabled?: boolean
  canStart?: boolean  // V7.1: true only when pdfDocument && deckId && sourceId are valid
}

export function AutoScanControls({
  isScanning,
  currentPage,
  totalPages,
  stats,
  skippedCount,
  onStart,
  onPause,
  onStop,
  onViewSkipped,
  disabled = false,
  canStart = true,  // V7.1: Default to true for backwards compatibility
}: AutoScanControlsProps) {
  const progress = totalPages > 0 ? Math.min((currentPage / totalPages) * 100, 100) : 0
  const isComplete = currentPage > totalPages && !isScanning

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-3 shadow-lg z-10">
      {/* Progress bar */}
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isComplete
              ? 'bg-green-500'
              : isScanning
              ? 'bg-blue-500'
              : 'bg-slate-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls row - stack on mobile */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Control buttons */}
        <div className="flex items-center gap-2">
          {!isScanning ? (
            <Button
              onClick={onStart}
              disabled={disabled || totalPages === 0 || !canStart}
              variant="primary"
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">Start Auto-Scan</span>
              <span className="sm:hidden">Start</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={onPause}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                <span className="hidden sm:inline">Pause</span>
              </Button>
              <Button
                onClick={onStop}
                variant="ghost"
                className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Square className="w-4 h-4" />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            </>
          )}
        </div>

        {/* Status text */}
        <div className="flex-1 text-center sm:text-left">
          {isScanning ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-medium">Scanning page {currentPage}</span> of {totalPages}...
            </p>
          ) : isComplete ? (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
              Scan complete!
            </p>
          ) : currentPage > 1 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Paused at page {currentPage} of {totalPages}
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ready to scan {totalPages} pages
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {stats.cardsCreated}
            </span>{' '}
            cards
          </span>
          
          {skippedCount > 0 && (
            <button
              onClick={onViewSkipped}
              className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">{skippedCount}</span> skipped
            </button>
          )}
        </div>
      </div>

      {/* Mode indicator when scanning */}
      {isScanning && (
        <div className="mt-2 flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            Auto-Scan Active
          </span>
        </div>
      )}
    </div>
  )
}
