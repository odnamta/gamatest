export const metadata = { title: 'My Library' }

import Link from 'next/link'
import { getUserSubscribedDecks } from '@/actions/library-actions'
import { MyLibraryGrid } from '@/components/library/MyLibraryGrid'

export default async function MyLibraryPage() {
  const result = await getUserSubscribedDecks()

  // Calculate total due across all decks
  const decks = result.ok ? (result.data?.decks ?? []) : []
  const totalDue = result.ok
    ? decks.reduce((sum, deck) => sum + deck.due_count + deck.new_count, 0)
    : 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Library
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {result.ok && decks.length > 0
              ? `${decks.length} ${decks.length === 1 ? 'deck' : 'decks'} • ${totalDue} cards due`
              : 'Your subscribed study decks'}
          </p>
        </div>
        <Link
          href="/library"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          ← Browse Library
        </Link>
      </div>

      {result.ok ? (
        <MyLibraryGrid decks={decks} />
      ) : (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">
            {result.error || 'Failed to load your library'}
          </p>
        </div>
      )}
    </div>
  )
}
