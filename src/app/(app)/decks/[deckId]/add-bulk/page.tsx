import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import type { Deck } from '@/types/database'

interface BulkImportPageProps {
  params: Promise<{ deckId: string }>
}

/**
 * Bulk Import Page - React Server Component
 * Skeleton UI for future bulk card import functionality.
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */
export default async function BulkImportPage({ params }: BulkImportPageProps) {
  const { deckId } = await params
  const user = await getUser()
  
  // Requirement 7.5: Redirect unauthorized users to dashboard
  if (!user) {
    redirect('/dashboard')
  }

  const supabase = await createSupabaseServerClient()

  // Requirement 7.1: Verify user owns deck before rendering
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .single()

  // If deck not found or user doesn't own it (RLS), redirect to dashboard
  if (deckError || !deck) {
    redirect('/dashboard')
  }

  const deckData = deck as Deck

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header with navigation */}
      <div className="mb-6">
        <Link 
          href={`/decks/${deckId}`}
          className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
        >
          ← Back to {deckData.title}
        </Link>
      </div>

      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Bulk Import Cards
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Paste your notes below to generate flashcards automatically.
        </p>
      </div>

      {/* Bulk import form */}
      <div className="p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
        {/* Requirement 7.2: Large textarea for pasting notes */}
        <Textarea
          label="Your Notes"
          name="notes"
          placeholder="Paste your study notes here...

Example:
- Key concept 1: Definition or explanation
- Key concept 2: Another important point
- Question? Answer to the question

The AI will analyze your notes and generate flashcards automatically."
          className="min-h-[300px]"
        />

        {/* Helper text */}
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Tip: Structure your notes with clear concepts and definitions for better flashcard generation.
        </p>

        {/* Requirement 7.3: Disabled "Generate (Coming Soon)" button */}
        <div className="mt-6">
          <Button
            disabled
            size="lg"
            className="w-full sm:w-auto"
          >
            Generate Cards (Coming Soon)
          </Button>
        </div>

        {/* Coming soon notice */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Coming Soon:</strong> AI-powered flashcard generation will automatically create 
            question-answer pairs from your notes. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  )
}
