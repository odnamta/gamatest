import { redirect } from 'next/navigation'
import { getUser } from '@/lib/supabase/server'
import { getGlobalDueCards } from '@/actions/global-study-actions'
import { getUserStats } from '@/actions/stats-actions'
import { GlobalStudySession } from '@/components/study/GlobalStudySession'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Global Study Page - React Server Component
 * Fetches due cards across all decks and renders GlobalStudySession.
 * Requirements: 2.1, 2.2, 2.3
 * 
 * Feature: v3-ux-overhaul
 */
export default async function GlobalStudyPage() {
  const user = await getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Fetch global due cards
  const { cards, totalDue, isNewCardsFallback, error } = await getGlobalDueCards()
  
  // Fetch user stats for streak
  const { stats } = await getUserStats()
  const currentStreak = stats?.current_streak ?? 0

  // Handle error state
  if (error) {
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

  // Handle empty state - redirect to dashboard
  if (cards.length === 0) {
    redirect('/dashboard')
  }

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
            : `${totalDue} cards due across all decks`
          }
        </p>
      </div>

      {/* Study session */}
      <GlobalStudySession
        initialCards={cards as any}
        totalDueRemaining={totalDue}
        currentStreak={currentStreak}
      />
    </div>
  )
}
