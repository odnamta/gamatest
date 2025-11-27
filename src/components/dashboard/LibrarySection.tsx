'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Library, Plus } from 'lucide-react'
import Link from 'next/link'

interface LibrarySectionProps {
  children: React.ReactNode
  defaultExpanded?: boolean
}

/**
 * LibrarySection Component
 * Collapsible container for courses and decks.
 * Requirements: 3.1, 3.2, 3.3, 3.4
 * 
 * Feature: v3-ux-overhaul
 */
export function LibrarySection({
  children,
  defaultExpanded = false,
}: LibrarySectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Library className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-slate-100">
            Library & Content
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          )}
        </div>
      </button>

      {/* Collapsible content - Requirements 3.2, 3.3 */}
      {isExpanded && (
        <div className="p-4 bg-white dark:bg-slate-900/50">
          {children}
        </div>
      )}
    </div>
  )
}
