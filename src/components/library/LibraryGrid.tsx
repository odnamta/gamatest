'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Library, Search, ArrowUpDown } from 'lucide-react'
import { DeckBrowseCard } from './DeckBrowseCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { BrowseDeckItem } from '@/types/database'

interface LibraryGridProps {
  decks: BrowseDeckItem[]
}

type SortKey = 'newest' | 'oldest' | 'cards' | 'title'

export function LibraryGrid({ decks }: LibraryGridProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('newest')

  const handleSubscribeSuccess = () => {
    router.refresh()
  }

  const filtered = decks.filter((d) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      d.title.toLowerCase().includes(q) ||
      (d.description?.toLowerCase().includes(q) ?? false)
    )
  })

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'cards':
        return b.card_count - a.card_count
      case 'title':
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })

  return (
    <div>
      {/* Search + Sort toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            aria-label="Search decks"
            placeholder="Search by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label="Sort decks"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="cards">Most cards</option>
            <option value="title">A-Z</option>
          </select>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-4">
        <span>{sorted.length} deck{sorted.length !== 1 ? 's' : ''}{searchQuery ? ' found' : ' available'}</span>
        {decks.filter((d) => d.isSubscribed).length > 0 && (
          <span>{decks.filter((d) => d.isSubscribed).length} in your library</span>
        )}
      </div>

      {sorted.length === 0 ? (
        searchQuery ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No decks match &ldquo;{searchQuery}&rdquo;</p>
          </div>
        ) : (
          <EmptyState
            icon={<Library className="h-12 w-12" />}
            title="Belum ada deck"
            description="Belum ada materi belajar yang tersedia."
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((deck) => (
            <DeckBrowseCard
              key={deck.id}
              deck={deck}
              onSubscribeSuccess={handleSubscribeSuccess}
            />
          ))}
        </div>
      )}
    </div>
  )
}
