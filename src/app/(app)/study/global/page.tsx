export const metadata = { title: 'Global Study' }

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getGlobalDueCards } from '@/actions/global-study-actions'
import { getUserStats } from '@/actions/stats-actions'
import { GlobalStudySession } from '@/components/study/GlobalStudySession'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { parseTagIdsFromUrl } from '@/lib/url-utils'

interface GlobalStudyPageProps {
  searchParams: Promise<{ batch?: string; tags?: string }>
}

/**
 * Global Study Page - React Server Component
 * Fetches due cards across all decks and renders GlobalStudySession.
 * Accepts optional `batch` query parameter for pagination.
 * V11.7: Accepts optional `tags` query parameter for tag filtering.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * **Feature: v11.7-companion-dashboard-tag-filtered-study**
 * **Validates: Requirements 2.2, 2.3**
 */
export default async function GlobalStudyPage({ searchParams }: GlobalStudyPageProps) {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Parse batch number from query params (default to 0)
  const params = await searchParams
  const batchNumber = params.batch ? parseInt(params.batch, 10) : 0
  const validBatchNumber = isNaN(batchNumber) || batchNumber < 0 ? 0 : batchNumber

  // V11.7: Parse tag IDs from query params
  const tagIds = parseTagIdsFromUrl(params)

  // Fetch global due cards with batch pagination and optional tag filter
  const dueCardsResult = await getGlobalDueCards(
    validBatchNumber,
    tagIds.length > 0 ? tagIds : undefined
  )

  // Fetch user stats for streak
  const statsResult = await getUserStats()
  const stats = statsResult.ok ? statsResult.data?.stats : null
  const currentStreak = stats?.current_streak ?? 0

  // Handle error state
  if (!dueCardsResult.ok) {
    const error = dueCardsResult.error
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center py-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">Error loading cards: {error}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const { cards, totalDue, hasMoreBatches, isNewCardsFallback } = dueCardsResult.data!

  // Handle empty state - redirect to dashboard with message
  if (cards.length === 0) {
    redirect('/dashboard?message=no-cards')
  }

  // Calculate remaining due cards after this batch
  // For batch 0: totalDue - cards.length
  // For batch N: totalDue - (N * 50 + cards.length)
  const cardsInPreviousBatches = validBatchNumber * 50
  const totalDueRemaining = Math.max(0, totalDue - cardsInPreviousBatches)

  // Handler for continue studying - navigate to next batch
  // V11.7: Preserve tag filter in next batch URL
  const nextBatchUrl = hasMoreBatches
    ? `/study/global?batch=${validBatchNumber + 1}${tagIds.length > 0 ? `&tags=${tagIds.join(',')}` : ''}`
    : undefined

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Session info */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          {isNewCardsFallback ? 'New Cards' : "Today's Study Session"}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {isNewCardsFallback 
            ? `Starting with ${cards.length} new cards`
            : validBatchNumber > 0
              ? `Batch ${validBatchNumber + 1} • ${cards.length} cards in this batch • ${totalDue} total due`
              : `${totalDue} cards due across all decks`
          }
        </p>
      </div>

      {/* Study session */}
      <GlobalStudySession
        initialCards={cards}
        totalDueRemaining={totalDueRemaining}
        currentStreak={currentStreak}
        nextBatchUrl={nextBatchUrl}
      />
    </div>
  )
}
