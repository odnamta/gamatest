'use client'

import { useEffect, useRef } from 'react'
import { FileText, MessageSquare, Sparkles } from 'lucide-react'

interface SelectionTooltipProps {
  position: { x: number; y: number }
  selectedText: string
  onToStem: () => void
  onToExplanation: () => void
  onToAIDraft: () => void
  onToAIBatch?: () => void
  onClose: () => void
}

/**
 * SelectionTooltip - Floating tooltip for PDF text selection actions
 * Requirements: V5 Feature Set 2 - Req 2.7, 2.11
 */
export function SelectionTooltip({
  position,
  selectedText,
  onToStem,
  onToExplanation,
  onToAIDraft,
  onToAIBatch,
  onClose,
}: SelectionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Calculate position to keep tooltip in viewport
  const tooltipStyle = {
    left: `${Math.max(10, Math.min(position.x - 100, window.innerWidth - 220))}px`,
    top: `${Math.max(10, position.y - 50)}px`,
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1 flex gap-1"
      style={tooltipStyle}
    >
      <button
        onClick={() => {
          onToStem()
          onClose()
        }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
        title="Copy to question stem"
      >
        <FileText className="w-4 h-4" />
        <span className="hidden sm:inline">To Stem</span>
      </button>
      
      <button
        onClick={() => {
          onToExplanation()
          onClose()
        }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
        title="Copy to explanation"
      >
        <MessageSquare className="w-4 h-4" />
        <span className="hidden sm:inline">To Explanation</span>
      </button>
      
      <button
        onClick={() => {
          onToAIDraft()
          onClose()
        }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
        title="Generate 1 MCQ with AI"
      >
        <Sparkles className="w-4 h-4" />
        <span className="hidden sm:inline">AI Draft</span>
      </button>
      
      {onToAIBatch && (
        <button
          onClick={() => {
            onToAIBatch()
            onClose()
          }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
          title="Generate up to 5 MCQs with AI"
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">AI Batch</span>
        </button>
      )}
    </div>
  )
}
