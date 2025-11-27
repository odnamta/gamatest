import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { CreateCardForm } from '@/components/cards/CreateCardForm'
import { Button } from '@/components/ui/Button'
import type { Card, Deck } from '@/types/database'

interface DeckDetailsPageProps {
  params: Promise<{ deckId: string }>
}

/**
 * Deck Details Page - React Server Component
 * Displays deck info, card list, and form to add new cards.
 * Requirements: 3.1, 3.2, 6.3
 */
export default async function DeckDetailsPage({ params }: DeckDetailsPageProps) {
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

  // Fetch all cards in the deck
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false })

  const deckData = deck as Deck
  const cardList = (cards || []) as Card[]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with navigation */}
      <div className="mb-6">
        <Link 
          href="/dashboard"
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Deck info */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{deckData.title}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {cardList.length} {cardList.length === 1 ? 'card' : 'cards'} in this deck
        </p>
      </div>

      {/* Action buttons */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href={`/study/${deckId}`}>
          <Button size="lg">
            Study Now
          </Button>
        </Link>
        {/* Requirement 7.4: Link to bulk import page */}
        <Link href={`/decks/${deckId}/add-bulk`}>
          <Button size="lg" variant="secondary">
            Bulk Import
          </Button>
        </Link>
      </div>

      {/* Add new card form */}
      <div className="mb-8 p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Add New Card</h2>
        <CreateCardForm deckId={deckId} />
      </div>

      {/* Card list */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Cards</h2>
        {cardsError ? (
          <p className="text-red-600 dark:text-red-400">Error loading cards: {cardsError.message}</p>
        ) : cardList.length === 0 ? (
          <div className="text-center py-8 bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg">
            <p className="text-slate-600 dark:text-slate-400">No cards yet</p>
            <p className="text-slate-500 text-sm mt-1">
              Add your first card using the form above!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cardList.map((card) => (
              <div
                key={card.id}
                className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none"
              >
                <p className="text-slate-900 dark:text-slate-100 line-clamp-2">{card.front}</p>
                {card.image_url && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    Has image
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
