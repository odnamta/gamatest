import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { StudySession } from './StudySession'
import type { Card, Deck, UserStats } from '@/types/database'

interface StudyPageProps {
  params: Promise<{ deckId: string }>
}

/**
 * Study Page - React Server Component
 * Fetches due cards for deck and renders study session.
 * Requirements: 5.1, 5.5
 */
export default async function StudyPage({ params }: StudyPageProps) {
  const { deckId } = await params
  const user = await getUser()
  
  if (!user) {
    return null // Layout handles redirect
  }

  const supabase = await createSupabaseServerClient()

  // Fetch deck details (RLS ensures user owns the deck)
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .single()

  if (deckError || !deck) {
    notFound()
  }

  // Fetch due cards (next_review <= now) - Requirement 5.1
  const now = new Date().toISOString()
  const { data: dueCards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .lte('next_review', now)
    .order('next_review', { ascending: true })

  // Fetch user stats for session summary - Requirements: 3.1, 3.4, 3.5
  const { data: userStats } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const deckData = deck as Deck
  const cardList = (dueCards || []) as Card[]
  const userStatsData = userStats as UserStats | null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with navigation */}
      <div className="mb-6">
        <Link 
          href={`/decks/${deckId}`}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          ← Back to Deck
        </Link>
      </div>

      {/* Deck title */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Studying: {deckData.title}
        </h1>
        {cardsError ? (
          <p className="text-red-600 dark:text-red-400">Error loading cards: {cardsError.message}</p>
        ) : (
          <p className="text-slate-600 dark:text-slate-400">
            {cardList.length} {cardList.length === 1 ? 'card' : 'cards'} due for review
          </p>
        )}
      </div>

      {/* Study session or completion message */}
      {cardList.length === 0 ? (
        // Completion state - Requirement 5.5
        <div className="text-center py-12 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
            Study Session Complete!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            You&apos;ve reviewed all due cards in this deck.
          </p>
          <Link 
            href={`/decks/${deckId}`}
            className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Deck
          </Link>
        </div>
      ) : (
        <StudySession initialCards={cardList} deckId={deckId} userStats={userStatsData} />
      )}
    </div>
  )
}
