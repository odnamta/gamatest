'use client'

/**
 * V11: BookSourceSelector Component
 * 
 * Dropdown selector for book sources with inline creation capability.
 */

import { useState, useEffect } from 'react'
import { Book, Plus, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getBookSources, createBookSource } from '@/actions/book-source-actions'
import type { BookSource } from '@/types/database'

interface BookSourceSelectorProps {
  selectedId: string | null
  onChange: (id: string | null) => void
  onCreateNew?: () => void
}

export function BookSourceSelector({
  selectedId,
  onChange,
}: BookSourceSelectorProps) {
  const [bookSources, setBookSources] = useState<BookSource[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newEdition, setNewEdition] = useState('')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load book sources on mount
  useEffect(() => {
    async function loadBookSources() {
      setIsLoading(true)
      const result = await getBookSources()
      if (result.ok && result.data) {
        setBookSources(result.data)
      }
      setIsLoading(false)
    }
    loadBookSources()
  }, [])

  const selectedBook = bookSources.find(b => b.id === selectedId)

  const handleSelect = (id: string | null) => {
    onChange(id)
    setIsOpen(false)
  }

  const handleCreateNew = async () => {
    if (!newTitle.trim()) {
      setError('Title is required')
      return
    }

    setIsCreating(true)
    setError(null)

    const result = await createBookSource({
      title: newTitle.trim(),
      edition: newEdition.trim() || null,
      specialty: newSpecialty.trim() || null,
    })

    if (result.ok && result.data) {
      setBookSources(prev => [result.data!, ...prev])
      onChange(result.data.id)
      setShowCreateDialog(false)
      setNewTitle('')
      setNewEdition('')
      setNewSpecialty('')
    } else if (!result.ok) {
      setError(result.error || 'Failed to create book source')
    }

    setIsCreating(false)
  }

  if (isLoading) {
    return (
      <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
    )
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        <Book className="inline-block w-4 h-4 mr-1" />
        Book / Source
      </label>

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
      >
        <span className={selectedBook ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}>
          {selectedBook ? `${selectedBook.title}${selectedBook.edition ? ` (${selectedBook.edition})` : ''}` : 'Select a book...'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
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
            Create New Book
          </button>

          {/* Divider */}
          {bookSources.length > 0 && (
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

          {/* Book source options */}
          {bookSources.map(book => (
            <button
              key={book.id}
              type="button"
              onClick={() => handleSelect(book.id)}
              className={`w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                book.id === selectedId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <div className="text-slate-900 dark:text-slate-100">{book.title}</div>
              {(book.edition || book.specialty) && (
                <div className="text-xs text-slate-500">
                  {[book.edition, book.specialty].filter(Boolean).join(' • ')}
                </div>
              )}
            </button>
          ))}

          {bookSources.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-500">
              No books yet. Create one to get started.
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-xl p-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Create New Book Source
            </h3>

            {error && (
              <div className="mb-4 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g., Safety Training Manual"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Edition
                </label>
                <input
                  type="text"
                  value={newEdition}
                  onChange={e => setNewEdition(e.target.value)}
                  placeholder="e.g., 26th Edition"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Specialty
                </label>
                <input
                  type="text"
                  value={newSpecialty}
                  onChange={e => setNewSpecialty(e.target.value)}
                  placeholder="e.g., Safety Training"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
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
                Cancel
              </Button>
              <Button onClick={handleCreateNew} loading={isCreating}>
                Create
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
