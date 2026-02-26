'use client'

/**
 * V11: ChapterSelector Component
 * 
 * Dropdown selector for chapters within a book source.
 * Disabled when no book is selected.
 */

import { useState, useEffect } from 'react'
import { BookOpen, Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getChaptersByBook, createChapter } from '@/actions/chapter-actions'
import type { BookChapter } from '@/types/database'

interface ChapterSelectorProps {
  bookSourceId: string | null
  selectedId: string | null
  onChange: (id: string | null) => void
  onExpectedCountChange?: (count: number | null) => void
}

export function ChapterSelector({
  bookSourceId,
  selectedId,
  onChange,
  onExpectedCountChange,
}: ChapterSelectorProps) {
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newChapterNumber, setNewChapterNumber] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newExpectedCount, setNewExpectedCount] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load chapters when book changes
  useEffect(() => {
    async function loadChapters() {
      if (!bookSourceId) {
        setChapters([])
        onChange(null)
        return
      }

      setIsLoading(true)
      const result = await getChaptersByBook(bookSourceId)
      if (result.ok && result.data) {
        // Already sorted by chapter_number from server
        setChapters(result.data)
      } else {
        setChapters([])
      }
      setIsLoading(false)
    }
    loadChapters()
  }, [bookSourceId, onChange])

  // Clear selection when book changes
  useEffect(() => {
    if (!bookSourceId) {
      onChange(null)
    }
  }, [bookSourceId, onChange])

  const selectedChapter = chapters.find(c => c.id === selectedId)

  // Update expected count when chapter changes
  useEffect(() => {
    if (onExpectedCountChange) {
      onExpectedCountChange(selectedChapter?.expected_question_count ?? null)
    }
  }, [selectedChapter, onExpectedCountChange])

  const handleSelect = (id: string | null) => {
    onChange(id)
    setIsOpen(false)
  }

  const handleCreateNew = async () => {
    if (!bookSourceId) return
    
    const chapterNum = parseInt(newChapterNumber, 10)
    if (isNaN(chapterNum) || chapterNum <= 0) {
      setError('Chapter number must be a positive integer')
      return
    }

    if (!newTitle.trim()) {
      setError('Title is required')
      return
    }

    setIsCreating(true)
    setError(null)

    const expectedCount = newExpectedCount ? parseInt(newExpectedCount, 10) : null

    const result = await createChapter({
      book_source_id: bookSourceId,
      chapter_number: chapterNum,
      title: newTitle.trim(),
      expected_question_count: expectedCount && expectedCount > 0 ? expectedCount : null,
    })

    if (result.ok && result.data) {
      // Insert in sorted position
      setChapters(prev => {
        const updated = [...prev, result.data!]
        return updated.sort((a, b) => a.chapter_number - b.chapter_number)
      })
      onChange(result.data.id)
      setShowCreateDialog(false)
      setNewChapterNumber('')
      setNewTitle('')
      setNewExpectedCount('')
    } else if (!result.ok) {
      setError(result.error || 'Failed to create chapter')
    }

    setIsCreating(false)
  }

  const isDisabled = !bookSourceId

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        <BookOpen className="inline-block w-4 h-4 mr-1" />
        Chapter
      </label>

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className={`w-full flex items-center justify-between px-3 py-2 text-left border rounded-lg transition-colors ${
          isDisabled
            ? 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 cursor-not-allowed'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
        }`}
      >
        <span className={selectedChapter ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
          {isDisabled
            ? 'Select a book first'
            : isLoading
            ? 'Memuat...'
            : selectedChapter
            ? `Ch. ${selectedChapter.chapter_number}: ${selectedChapter.title}`
            : 'Select a chapter...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && !isDisabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {/* Create new option */}
          <button
            type="button"
            onClick={() => {
              setShowCreateDialog(true)
              setIsOpen(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create New Chapter
          </button>

          {/* Divider */}
          {chapters.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700" />
          )}

          {/* Clear selection */}
          {selectedId && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="w-full px-3 py-2 text-left text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Clear selection
            </button>
          )}

          {/* Chapter options (already sorted by chapter_number) */}
          {chapters.map(chapter => (
            <button
              key={chapter.id}
              type="button"
              onClick={() => handleSelect(chapter.id)}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                chapter.id === selectedId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="text-slate-900 dark:text-slate-100">
                Ch. {chapter.chapter_number}: {chapter.title}
              </div>
              {chapter.expected_question_count && (
                <div className="text-xs text-slate-500">
                  Expected: {chapter.expected_question_count} questions
                </div>
              )}
            </button>
          ))}

          {chapters.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">
              No chapters yet. Create one to get started.
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl p-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Create New Chapter
            </h3>

            {error && (
              <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chapter Number *
                </label>
                <input
                  type="number"
                  min="1"
                  value={newChapterNumber}
                  onChange={e => setNewChapterNumber(e.target.value)}
                  placeholder="e.g., 1"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g., Maternal Physiology"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expected Question Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={newExpectedCount}
                  onChange={e => setNewExpectedCount(e.target.value)}
                  placeholder="e.g., 25"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Used for QA to detect missing questions
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowCreateDialog(false)
                  setError(null)
                }}
              >
                Batal
              </Button>
              <Button onClick={handleCreateNew} loading={isCreating}>
                Buat
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
