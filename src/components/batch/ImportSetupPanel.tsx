'use client'

/**
 * V11: ImportSetupPanel Component
 * V11.1: Added sticky context persistence via localStorage
 * 
 * Combines BookSourceSelector and ChapterSelector with expected question count input.
 * Exports ImportSessionContext to parent for use in Auto-Scan.
 */

import { useState, useCallback, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { BookSourceSelector } from './BookSourceSelector'
import { ChapterSelector } from './ChapterSelector'
import { getImportContext, updateImportContext } from '@/lib/import-context-storage'
import type { ImportSessionContext } from '@/types/database'

interface ImportSetupPanelProps {
  onContextChange: (context: ImportSessionContext) => void
  initialContext?: Partial<ImportSessionContext>
  /** V11.1: Deck ID for sticky context persistence */
  deckId?: string
}

export function ImportSetupPanel({
  onContextChange,
  initialContext,
  deckId,
}: ImportSetupPanelProps) {
  // V11.1: Load initial state from localStorage if deckId provided
  const [bookSourceId, setBookSourceId] = useState<string | null>(
    initialContext?.bookSourceId ?? null
  )
  const [chapterId, setChapterId] = useState<string | null>(
    initialContext?.chapterId ?? null
  )
  const [expectedQuestionCount, setExpectedQuestionCount] = useState<number | null>(
    initialContext?.expectedQuestionCount ?? null
  )
  const [chapterExpectedCount, setChapterExpectedCount] = useState<number | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // V11.1: Load sticky context from localStorage on mount
  useEffect(() => {
    if (deckId && !isInitialized) {
      const storedContext = getImportContext(deckId)
      if (storedContext.bookSourceId) {
        setBookSourceId(storedContext.bookSourceId)
      }
      if (storedContext.chapterId) {
        setChapterId(storedContext.chapterId)
      }
      setIsInitialized(true)
    }
  }, [deckId, isInitialized])

  // V11.1: Persist bookSourceId changes to localStorage
  useEffect(() => {
    if (deckId && isInitialized) {
      updateImportContext(deckId, { bookSourceId })
    }
  }, [deckId, bookSourceId, isInitialized])

  // V11.1: Persist chapterId changes to localStorage
  useEffect(() => {
    if (deckId && isInitialized) {
      updateImportContext(deckId, { chapterId })
    }
  }, [deckId, chapterId, isInitialized])

  // Notify parent of context changes
  useEffect(() => {
    onContextChange({
      bookSourceId,
      chapterId,
      expectedQuestionCount: expectedQuestionCount ?? chapterExpectedCount,
      detectedQuestionNumbers: [], // Will be populated during scan
    })
  }, [bookSourceId, chapterId, expectedQuestionCount, chapterExpectedCount, onContextChange])

  const handleBookChange = useCallback((id: string | null) => {
    setBookSourceId(id)
    // Clear chapter when book changes
    if (!id) {
      setChapterId(null)
      setChapterExpectedCount(null)
    }
  }, [])

  const handleChapterChange = useCallback((id: string | null) => {
    setChapterId(id)
  }, [])

  const handleChapterExpectedCountChange = useCallback((count: number | null) => {
    setChapterExpectedCount(count)
  }, [])

  const handleExpectedCountChange = (value: string) => {
    const num = parseInt(value, 10)
    setExpectedQuestionCount(isNaN(num) || num <= 0 ? null : num)
  }

  // Determine effective expected count (manual override or from chapter)
  const effectiveExpectedCount = expectedQuestionCount ?? chapterExpectedCount

  return (
    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg rounded-xl border border-white/20 shadow-sm p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Import Setup
        </h3>
        <span className="text-xs text-slate-500">(optional)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Book Source Selector */}
        <BookSourceSelector
          selectedId={bookSourceId}
          onChange={handleBookChange}
        />

        {/* Chapter Selector */}
        <ChapterSelector
          bookSourceId={bookSourceId}
          selectedId={chapterId}
          onChange={handleChapterChange}
          onExpectedCountChange={handleChapterExpectedCountChange}
        />
      </div>

      {/* Expected Question Count */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Expected Question Count
          {chapterExpectedCount && !expectedQuestionCount && (
            <span className="ml-2 text-xs text-slate-500">
              (from chapter: {chapterExpectedCount})
            </span>
          )}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            value={expectedQuestionCount ?? ''}
            onChange={e => handleExpectedCountChange(e.target.value)}
            placeholder={chapterExpectedCount ? `${chapterExpectedCount}` : 'e.g., 25'}
            className="w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-500">
            {effectiveExpectedCount
              ? `Will compare against ${effectiveExpectedCount} expected`
              : 'For QA validation'}
          </span>
        </div>
      </div>

      {/* Context Summary */}
      {(bookSourceId || chapterId || effectiveExpectedCount) && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Import Context:</strong>{' '}
            {bookSourceId ? 'Book selected' : 'No book'}{' '}
            {chapterId ? '→ Chapter selected' : ''}{' '}
            {effectiveExpectedCount ? `→ Expecting ${effectiveExpectedCount} questions` : ''}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Cards will be linked to this source for tracking and QA.
          </p>
        </div>
      )}

      {/* V11.6: Autoscan behavior hint */}
      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <strong>Re-run behavior:</strong> Re-running autoscan on the same chunk will skip exact duplicate questions automatically.
        </p>
      </div>
    </div>
  )
}
