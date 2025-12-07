'use client'

/**
 * V11: QAFeedbackBanner Component
 * 
 * Displays import QA feedback: generated vs expected counts and missing questions.
 * Validates: Requirements 6.1, 6.2, 6.3, 7.4
 */

import { useState } from 'react'
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

interface QAFeedbackBannerProps {
  generatedCount: number
  expectedCount: number | null
  missingNumbers: number[]
}

/**
 * Determines the QA status based on generated vs expected counts
 */
export function getQAStatus(
  generatedCount: number,
  expectedCount: number | null
): 'success' | 'warning' | 'neutral' {
  if (expectedCount === null) return 'neutral'
  if (generatedCount >= expectedCount) return 'success'
  return 'warning'
}

export function QAFeedbackBanner({
  generatedCount,
  expectedCount,
  missingNumbers,
}: QAFeedbackBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  const status = getQAStatus(generatedCount, expectedCount)
  const hasMissingNumbers = missingNumbers.length > 0

  // Don't show banner if no expected count and no missing numbers
  if (expectedCount === null && !hasMissingNumbers) {
    return null
  }

  const statusStyles = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    neutral: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
  }

  const iconStyles = {
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  }

  const textStyles = {
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-amber-700 dark:text-amber-300',
    neutral: 'text-slate-700 dark:text-slate-300',
  }

  return (
    <div className={`rounded-lg border p-4 ${statusStyles[status]}`}>
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {status === 'success' ? (
            <CheckCircle className={`w-5 h-5 ${iconStyles[status]}`} />
          ) : (
            <AlertTriangle className={`w-5 h-5 ${iconStyles[status]}`} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Main message */}
          <div className={`font-medium ${textStyles[status]}`}>
            {expectedCount !== null ? (
              <>
                Generated {generatedCount} / Expected {expectedCount} cards
                {status === 'success' && ' ✓'}
              </>
            ) : (
              <>Generated {generatedCount} cards</>
            )}
          </div>

          {/* Warning message */}
          {status === 'warning' && (
            <p className={`text-sm mt-1 ${textStyles[status]}`}>
              {expectedCount! - generatedCount} questions may be missing. 
              Review the source material to verify.
            </p>
          )}

          {/* Missing numbers section */}
          {hasMissingNumbers && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-1 text-sm font-medium ${textStyles[status]} hover:underline`}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {missingNumbers.length} missing question number{missingNumbers.length !== 1 ? 's' : ''} detected
              </button>

              {isExpanded && (
                <div className="mt-2 p-2 bg-white/50 dark:bg-slate-900/50 rounded">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Question numbers found in source but not in generated cards:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {missingNumbers.map(num => (
                      <span
                        key={num}
                        className="px-2 py-0.5 text-xs font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded"
                      >
                        {num}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
