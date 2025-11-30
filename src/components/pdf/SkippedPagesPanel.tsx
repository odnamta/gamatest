/**
 * V7.0: Skipped Pages Panel
 * Collapsible panel showing pages that failed during auto-scan.
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Download, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface SkippedPage {
  pageNumber: number
  reason: string
}

interface SkippedPagesPanelProps {
  skippedPages: SkippedPage[]
  onExport: () => void
}

export function SkippedPagesPanel({
  skippedPages,
  onExport,
}: SkippedPagesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (skippedPages.length === 0) {
    return null
  }

  return (
    <div className="mt-4 border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            {skippedPages.length} page{skippedPages.length !== 1 ? 's' : ''} skipped
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="p-3 bg-white dark:bg-slate-800 border-t border-amber-200 dark:border-amber-800">
          {/* Page list */}
          <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
            {skippedPages.map((page, index) => (
              <div
                key={`${page.pageNumber}-${index}`}
                className="flex items-start gap-2 text-sm"
              >
                <span className="font-medium text-slate-700 dark:text-slate-300 min-w-[60px]">
                  Page {page.pageNumber}
                </span>
                <span className="text-slate-500 dark:text-slate-400 truncate">
                  {page.reason}
                </span>
              </div>
            ))}
          </div>

          {/* Export button */}
          <Button
            onClick={onExport}
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export Log
          </Button>
        </div>
      )}
    </div>
  )
}
