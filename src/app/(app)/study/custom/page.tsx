export const metadata = { title: 'Custom Study' }

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { getCustomSessionCards } from '@/actions/custom-study-actions'
import { getUserStats } from '@/actions/stats-actions'
import { GlobalStudySession } from '@/components/study/GlobalStudySession'
import { decodeSessionParams } from '@/lib/custom-session-params'

interface CustomStudyPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Custom Study Page - React Server Component
 * Fetches cards based on URL params and renders GlobalStudySession.
 * V6.3: Custom Cram Mode
 */
export default async function CustomStudyPage({ searchParams }: CustomStudyPageProps) {
  const params = await searchParams
  
  // Build URLSearchParams from the params object
  const urlParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      urlParams.set(key, value)
    }
  }
  
  // Decode session configuration from URL params
  const config = decodeSessionParams(urlParams)
  
  // Validate that at least one filter is set
  if (config.tagIds.length === 0 && config.deckIds.length === 0) {
    redirect('/dashboard')
  }

  // Fetch cards based on configuration
  const result = await getCustomSessionCards({
    tagIds: config.tagIds,
    deckIds: config.deckIds,
    mode: config.mode,
    limit: config.limit,
    flaggedOnly: config.flaggedOnly,
  })

  // Fetch user stats for streak display
  const statsResult = await getUserStats()
  const currentStreak = statsResult.ok ? (statsResult.data?.stats?.current_streak || 0) : 0

  // Handle errors
  if (!result.ok) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Error Loading Session
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {result.error || 'Failed to load cards for this session.'}
          </p>
        </div>
      </div>
    )
  }

  const cards = result.data?.cards ?? []
  const totalMatching = result.data?.totalMatching ?? 0

  // Handle empty state
  if (cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            No Cards Found
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            {config.flaggedOnly
              ? 'No flagged cards match your selected filters.'
              : config.mode === 'due' 
                ? 'No cards are due for review with your selected filters.'
                : 'No cards match your selected filters.'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {config.flaggedOnly
              ? 'Try flagging some cards first, or disable the flagged-only filter.'
              : 'Try selecting different tags or decks, or switch to "Cram All" mode.'}
          </p>
        </div>
      </div>
    )
  }

  // Build session info for display
  const modeLabel = config.mode === 'due' ? 'Due Cards' : 'Cram Session'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Session info */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Custom Study
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {modeLabel} • {cards.length} of {totalMatching} cards
        </p>
      </div>

      {/* Study session */}
      <GlobalStudySession
        initialCards={cards}
        totalDueRemaining={totalMatching}
        currentStreak={currentStreak}
      />
    </div>
  )
}
