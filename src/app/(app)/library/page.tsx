export const metadata = { title: 'Library' }

import Link from 'next/link'
import { getBrowseDecksForUser } from '@/actions/library-actions'
import { LibraryGrid } from '@/components/library/LibraryGrid'

export default async function LibraryPage() {
  const result = await getBrowseDecksForUser()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Library
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Discover and subscribe to study decks
          </p>
        </div>
        <Link
          href="/library/my"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          My Library →
        </Link>
      </div>

      {result.ok ? (
        <LibraryGrid decks={result.data?.decks ?? []} />
      ) : (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">
            {result.error || 'Failed to load library'}
          </p>
        </div>
      )}
    </div>
  )
}
