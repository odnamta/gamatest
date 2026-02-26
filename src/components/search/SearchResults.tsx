'use client'

import { useRouter } from 'next/navigation'
import { FileText, AlertCircle, Layers, ClipboardList } from 'lucide-react'
import type { SearchResult } from '@/actions/notebook-actions'

export interface SearchResultsProps {
  results: SearchResult[]
  query: string
  error: string | null
  onResultClick: (cardId: string) => void
}

const TYPE_CONFIG = {
  card: { icon: FileText, label: 'Card', color: 'text-slate-400' },
  deck: { icon: Layers, label: 'Deck', color: 'text-blue-400' },
  assessment: { icon: ClipboardList, label: 'Assessment', color: 'text-amber-400' },
} as const

/**
 * SearchResults - Dropdown showing search results
 * V10.6: Digital Notebook
 * 
 * Requirements: 3.4, 3.5, 3.6
 * - 3.4: Show card stem and snippet
 * - 3.5: Click opens preview modal
 * - 3.6: Handle empty state
 */
export function SearchResults({
  results,
  query,
  error,
  onResultClick,
}: SearchResultsProps) {
  const router = useRouter()
  if (error) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Pencarian tidak tersedia</span>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          Tidak ada hasil untuk &quot;{query}&quot;
        </p>
      </div>
    )
  }

  return (
    <div 
      className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
      role="listbox"
      aria-live="polite"
    >
      {results.map((result) => {
        const cfg = TYPE_CONFIG[result.type || 'card']
        const Icon = cfg.icon
        return (
          <button
            key={`${result.type}-${result.id}`}
            onClick={() => {
              if (result.href) {
                router.push(result.href)
              } else {
                onResultClick(result.id)
              }
            }}
            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
            role="option"
          >
            <div className="flex items-start gap-3">
              <Icon className={`w-4 h-4 ${cfg.color} mt-0.5 flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={result.stem}>
                    {result.stem}
                  </p>
                  {result.type !== 'card' && (
                    <span className="flex-shrink-0 text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                      {cfg.label}
                    </span>
                  )}
                </div>
                {result.snippet && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {result.snippet}
                  </p>
                )}
                {result.deckTitle && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {result.deckTitle}
                  </p>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
