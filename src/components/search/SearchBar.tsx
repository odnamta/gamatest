'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { searchCards, type SearchResult } from '@/actions/notebook-actions'
import { SearchResults } from './SearchResults'

export interface SearchBarProps {
  onResultClick?: (cardId: string) => void
}

/**
 * SearchBar - Global search input with dropdown results
 * V10.6: Digital Notebook
 * 
 * Requirements: 3.4, 3.6, 3.7
 * - 3.4: Show card title and snippet with match
 * - 3.6: Hide dropdown when query is empty
 * - 3.7: Show loading indicator during search
 */
export function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Debounced search (300ms)
  const debouncedSearch = useDebouncedCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await searchCards(searchQuery)

    if (result.success) {
      setResults(result.results)
      setIsOpen(true)
    } else {
      setError(result.error || 'Search failed')
      setResults([])
    }

    setIsLoading(false)
  }, 300)

  const handleInputChange = (value: string) => {
    setQuery(value)
    if (!value.trim()) {
      setResults([])
      setIsOpen(false)
      setIsLoading(false)
    } else {
      setIsLoading(true)
      debouncedSearch(value)
    }
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    setError(null)
    inputRef.current?.focus()
  }

  const handleResultClick = (cardId: string) => {
    setIsOpen(false)
    onResultClick?.(cardId)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          placeholder="Search cards..."
          className="w-full pl-10 pr-10 py-2 text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
          aria-label="Search cards"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        {/* Loading or clear button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          ) : query ? (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
              aria-label="Clear search"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <SearchResults
          results={results}
          query={query}
          error={error}
          onResultClick={handleResultClick}
        />
      )}
    </div>
  )
}
