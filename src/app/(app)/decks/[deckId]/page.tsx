import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { CardFormTabs } from '@/components/cards/CardFormTabs'
import { CardList } from '@/components/cards/CardList'
import { Button } from '@/components/ui/Button'
import { resolveDeckId } from '@/lib/legacy-redirect'
import { CleanDuplicatesButton } from '@/components/decks/CleanDuplicatesButton'
import { DeckDraftsPanel } from '@/components/decks/DeckDraftsPanel'
import { EditableDeckTitle } from '@/components/decks/EditableDeckTitle'
import { EditableDeckSubject } from '@/components/decks/EditableDeckSubject'
import { ManageTagsButton } from '@/components/decks/ManageTagsButton'
import { VisibilityToggle } from '@/components/decks/VisibilityToggle'
import { SyncProgressButton } from '@/components/decks/SyncProgressButton'
import type { Card, Tag, DeckVisibility } from '@/types/database'

// Type for card template with nested tags from Supabase join
// V9: Added category field to tags
// V11.1: Added book_source for virtual source badge
// V11.3: Added status for draft/publish workflow
// Note: Supabase returns tags as single object for foreign key join
interface CardTemplateWithNestedTags {
  id: string
  stem: string
  options: unknown
  correct_index: number
  explanation: string | null
  created_at: string
  book_source_id: string | null
  status: string | null
  book_sources: {
    id: string
    title: string
  } | null
  card_template_tags: Array<{
    tags: {
      id: string
      name: string
      color: string
      category?: string
    } | null
  }> | null
}

// Type for raw Supabase response (tags can be array due to join behavior)
// V11.1: Added book_source for virtual source badge
interface CardTemplateRaw {
  id: string
  stem: string
  options: unknown
  correct_index: number
  explanation: string | null
  created_at: string
  book_source_id: string | null
  book_sources: {
    id: string
    title: string
  } | null
  card_template_tags: Array<{
    tags: {
      id: string
      name: string
      color: string
      category?: string
    } | {
      id: string
      name: string
      color: string
      category?: string
    }[] | null
  }> | null
}

// Extended Card type with tags for CardList
// V11.1: Added book_source for virtual source badge
// V11.3: Added status for draft/publish workflow
interface CardWithTags extends Card {
  tags: Tag[]
  book_source?: {
    id: string
    title: string
  } | null
  status?: 'draft' | 'published' | 'archived'
}

interface DeckDetailsPageProps {
  params: Promise<{ deckId: string }>
}

/**
 * V8.1: Deck Details Page - React Server Component
 * Displays deck_template info, card_templates list, and form to add new cards.
 * Supports legacy ID redirect for old bookmarks.
 * Requirements: 3.1, 3.2, 6.3, V8 2.1, V8.1 Fix 1
 */
export default async function DeckDetailsPage({ params }: DeckDetailsPageProps) {
  const { deckId } = await params
  const user = await getUser()
  
  if (!user) {
    return null // Layout handles redirect
  }

  const supabase = await createSupabaseServerClient()

  // V8.1: Resolve deck ID (supports legacy redirect)
  const resolved = await resolveDeckId(deckId, supabase)
  
  if (!resolved) {
    notFound()
  }
  
  // V8.1: Redirect if this was a legacy ID
  if (resolved.isLegacy) {
    redirect(`/decks/${resolved.id}`)
  }

  // Fetch full deck_template data
  const { data: deckTemplate, error: deckError } = await supabase
    .from('deck_templates')
    .select('*')
    .eq('id', resolved.id)
    .single()

  if (deckError || !deckTemplate) {
    notFound()
  }

  // V8.0: Verify user has access via user_decks subscription or is author
  const { data: userDeck } = await supabase
    .from('user_decks')
    .select('id')
    .eq('user_id', user.id)
    .eq('deck_template_id', deckId)
    .eq('is_active', true)
    .single()

  const isAuthor = deckTemplate.author_id === user.id
  if (!userDeck && !isAuthor) {
    notFound()
  }

  // V8.0: Fetch card_templates for this deck_template
  // V8.5: Join with card_template_tags and tags to fetch associated tags
  // V11.1: Join with book_sources for virtual source badge
  // V11.3: Include status for draft/publish workflow
  const { data: cardTemplates, error: cardsError } = await supabase
    .from('card_templates')
    .select(`
      id,
      stem,
      options,
      correct_index,
      explanation,
      created_at,
      book_source_id,
      status,
      book_sources (
        id,
        title
      ),
      card_template_tags (
        tags (
          id,
          name,
          color,
          category
        )
      )
    `)
    .eq('deck_template_id', deckId)
    .order('created_at', { ascending: false })

  // Map card_templates to Card format for CardList compatibility
  // V8.5: Include tags array extracted from nested join
  // V9: Added category field to tag mapping
  const cardList: CardWithTags[] = ((cardTemplates || []) as unknown as CardTemplateWithNestedTags[]).map(ct => {
    // Extract tags from nested structure, filtering out nulls
    // Handle both single object and array responses from Supabase
    const tags: Tag[] = (ct.card_template_tags || [])
      .flatMap(ctt => {
        const tagData = ctt.tags
        if (!tagData) return []
        // Handle both single object and array
        const tagArray = Array.isArray(tagData) ? tagData : [tagData]
        return tagArray
      })
      .filter((tag): tag is { id: string; name: string; color: string; category?: string } => tag !== null && typeof tag === 'object')
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        category: (tag.category || 'concept') as 'source' | 'topic' | 'concept',
        user_id: '', // Not needed for display
        created_at: '', // Not needed for display
      }))

    return {
      id: ct.id,
      deck_id: deckId,
      card_type: 'mcq' as const,
      front: '',
      back: '',
      stem: ct.stem,
      options: ct.options as string[],
      correct_index: ct.correct_index,
      explanation: ct.explanation,
      image_url: null,
      interval: 1,
      ease_factor: 2.5,
      next_review: new Date().toISOString(),
      created_at: ct.created_at,
      tags,
      // V11.1: Include book_source for virtual source badge
      book_source: ct.book_sources || null,
      // V11.3: Include status for draft/publish workflow
      status: (ct.status || 'published') as 'draft' | 'published' | 'archived',
    }
  })

  // V8.5: Extract all unique tags from cards for filter functionality
  const allTagsMap = new Map<string, Tag>()
  cardList.forEach(card => {
    card.tags.forEach(tag => {
      if (!allTagsMap.has(tag.id)) {
        allTagsMap.set(tag.id, tag)
      }
    })
  })
  const allTags = Array.from(allTagsMap.values())

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
        {/* V8.6: Editable title for authors, static for non-authors */}
        {isAuthor ? (
          <div className="mb-2">
            <EditableDeckTitle deckId={deckId} initialTitle={deckTemplate.title} />
          </div>
        ) : (
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">{deckTemplate.title}</h1>
        )}
        <p className="text-slate-600 dark:text-slate-400 mb-2">
          {cardList.length} {cardList.length === 1 ? 'card' : 'cards'} in this deck
        </p>
        {/* V9.1: Editable subject for authors - controls AI specialty */}
        {isAuthor && (
          <EditableDeckSubject 
            deckId={deckId} 
            initialSubject={deckTemplate.subject || 'Obstetrics & Gynecology'} 
          />
        )}
        {/* V10.4: Visibility toggle for authors */}
        {isAuthor && (
          <div className="mt-4">
            <VisibilityToggle
              deckId={deckId}
              currentVisibility={(deckTemplate.visibility || 'private') as DeckVisibility}
              isAuthor={isAuthor}
            />
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link href={`/study/${deckId}`}>
          <Button size="lg">
            Study Flashcards
          </Button>
        </Link>
        <Link href={`/study/mcq/${deckId}`}>
          <Button size="lg">
            Study MCQs
          </Button>
        </Link>
        {/* Author-only actions */}
        {isAuthor && (
          <>
            {/* Requirement 7.4: Link to bulk import page */}
            <Link href={`/decks/${deckId}/add-bulk`}>
              <Button size="lg" variant="secondary">
                Bulk Import
              </Button>
            </Link>
            {/* V8.3: Clean Duplicates button */}
            <CleanDuplicatesButton deckId={deckId} />
            {/* V10.6.1: Sync Progress button for authors */}
            <SyncProgressButton deckId={deckId} />
            {/* V9.4: Manage Tags button for authors */}
            <ManageTagsButton isAuthor={isAuthor} />
          </>
        )}
      </div>

      {/* V11.6: Drafts Panel for authors - shows pending imports */}
      {isAuthor && (
        <div className="mb-8">
          <DeckDraftsPanel deckId={deckId} isAuthor={isAuthor} />
        </div>
      )}

      {/* Add new card form with tabs for flashcard/MCQ - Author only */}
      {isAuthor && (
        <div className="mb-8 p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm dark:shadow-none">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Add New Card</h2>
          <CardFormTabs deckId={deckId} />
        </div>
      )}

      {/* Card list */}
      <div>
        <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Cards</h2>
        {cardsError ? (
          <p className="text-red-600 dark:text-red-400">Error loading cards: {cardsError.message}</p>
        ) : (
          <CardList cards={cardList} deckId={deckId} deckTitle={deckTemplate.title} allTags={allTags} isAuthor={isAuthor} deckSubject={deckTemplate.subject || 'Obstetrics & Gynecology'} />
        )}
      </div>
    </div>
  )
}
