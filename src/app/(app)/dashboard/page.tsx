import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { CreateDeckForm } from '@/components/decks/CreateDeckForm'
import { DeckCard } from '@/components/decks/DeckCard'
import { StudyHeatmap } from '@/components/dashboard/StudyHeatmap'
import { calculateDueCount } from '@/lib/due-count'
import { getStudyLogs, getUserStats } from '@/actions/stats-actions'
import { Flame } from 'lucide-react'
import type { DeckWithDueCount } from '@/types/database'

/**
 * Dashboard Page - React Server Component
 * Displays user's decks with due card counts.
 * Requirements: 2.2, 6.1, 6.2, 6.4
 */
export default async function DashboardPage() {
  const user = await getUser()
  
  if (!user) {
    return null // Layout handles redirect
  }

  const supabase = await createSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch study logs for heatmap (Requirement 2.2)
  const { logs: studyLogs } = await getStudyLogs(60)

  // Fetch user stats for streak display (Requirement 1.7)
  const { stats: userStats } = await getUserStats()

  // Fetch user's decks with due counts (Requirement 6.1, 6.2)
  // RLS ensures only user's own decks are returned (Requirement 2.2)
  const { data: decks, error } = await supabase
    .from('decks')
    .select(`
      id,
      user_id,
      title,
      created_at,
      cards!left(id, next_review)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-red-400">Error loading decks: {error.message}</p>
      </div>
    )
  }

  // Calculate due counts for each deck using the tested utility function
  const decksWithDueCounts: DeckWithDueCount[] = (decks || []).map((deck) => {
    const cards = (deck.cards || []) as { next_review: string }[]
    const dueCount = calculateDueCount(cards, now)
    
    return {
      id: deck.id,
      user_id: deck.user_id,
      title: deck.title,
      created_at: deck.created_at,
      due_count: dueCount,
    }
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Your Decks</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Create and manage your flashcard decks for OBGYN exam preparation.
        </p>
      </div>

      {/* Current Streak Display (Requirement 1.7) */}
      {userStats && userStats.current_streak > 0 && (
        <div className="mb-6 flex items-center gap-2 p-4 bg-orange-100 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/30 rounded-lg">
          <Flame className="w-6 h-6 text-orange-500 dark:text-orange-400" />
          <span className="text-orange-600 dark:text-orange-400 font-medium">Current Streak:</span>
          <span className="text-orange-700 dark:text-orange-300 font-bold text-lg">
            {userStats.current_streak} day{userStats.current_streak !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Study Heatmap (Requirement 2.2) */}
      <div className="mb-8 p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
        <StudyHeatmap studyLogs={studyLogs} />
      </div>

      {/* Create Deck Form */}
      <div className="mb-8 p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
        <CreateDeckForm />
      </div>

      {/* Deck List */}
      {decksWithDueCounts.length === 0 ? (
        // Empty state (Requirement 6.4)
        <div className="text-center py-12 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg">
          <p className="text-slate-600 dark:text-slate-400 mb-2">No decks yet</p>
          <p className="text-slate-500 dark:text-slate-500 text-sm">
            Create your first deck above to start studying!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {decksWithDueCounts.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </div>
      )}
    </div>
  )
}
