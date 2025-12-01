/**
 * V7.0: Auto-Scan Resume Banner
 * Non-blocking banner for crash recovery.
 */

'use client'

import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface AutoScanResumeBannerProps {
  savedPage: number
  totalPages: number
  onResume: () => void
  onReset: () => void
}

export function AutoScanResumeBanner({
  savedPage,
  totalPages,
  onResume,
  onReset,
}: AutoScanResumeBannerProps) {
  return (
    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Last scan stopped at{' '}
            <span className="font-medium">page {savedPage}</span> of {totalPages}.
            {' '}Please re-select your PDF to resume.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={onResume}
            variant="primary"
            className="flex-1 sm:flex-none text-sm"
          >
            Resume
          </Button>
          <Button
            onClick={onReset}
            variant="ghost"
            className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400"
          >
            <X className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  )
}
