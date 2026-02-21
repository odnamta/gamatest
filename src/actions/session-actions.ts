'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import type { CardStatus, SessionCard, ImportSessionMeta } from '@/lib/import-session'

// ============================================
// V11.3: Session Management Server Actions
// ============================================

export interface SessionCardsResult {
  ok: boolean
  cards?: SessionCard[]
  sessionMeta?: ImportSessionMeta
  error?: { message: string; code: string }
}

export interface PublishCardsResult {
  ok: boolean
  publishedCount?: number
  error?: { message: string; code: string }
}

export interface ArchiveCardsResult {
  ok: boolean
  archivedCount?: number
  error?: { message: string; code: string }
}

export interface DuplicateCardResult {
  ok: boolean
  newCardId?: string
  error?: { message: string; code: string }
}

/**
 * V11.3: Fetches all cards for a given import session.
 * Verifies author authorization before returning data.
 * 
 * @param sessionId - The import_session_id to fetch cards for
 * @returns SessionCardsResult with cards and session metadata
 */
export async function getSessionCards(sessionId: string): Promise<SessionCardsResult> {
  // V20.6: Validate sessionId format
  if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return { ok: false, error: { message: 'Invalid session ID', code: 'VALIDATION_ERROR' } }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch cards with this session ID
  const { data: cardTemplates, error: cardsError } = await supabase
    .from('card_templates')
    .select(`
      id,
      stem,
      options,
      correct_index,
      explanation,
      question_number,
      status,
      created_at,
      updated_at,
      book_source_id,
      chapter_id,
      deck_template_id,
      deck_templates!inner(author_id, title),
      book_sources(id, title),
      chapters(id, title),
      card_template_tags(
        tags(id, name, color)
      )
    `)
    .eq('import_session_id', sessionId)
    .order('question_number', { ascending: true, nullsFirst: false })

  if (cardsError) {
    return { ok: false, error: { message: cardsError.message, code: 'DB_ERROR' } }
  }

  if (!cardTemplates || cardTemplates.length === 0) {
    return { ok: false, error: { message: 'Session not found', code: 'NOT_FOUND' } }
  }

  // Verify author authorization (check first card's deck author)
  const firstCard = cardTemplates[0] as unknown as {
    deck_templates: { author_id: string; title: string }
  }
  if (firstCard.deck_templates.author_id !== user.id) {
    return { ok: false, error: { message: 'Not authorized to view this session', code: 'UNAUTHORIZED' } }
  }

  // Transform to SessionCard format
  const cards: SessionCard[] = cardTemplates.map((ct) => {
    const card = ct as unknown as {
      id: string
      stem: string
      options: string[]
      correct_index: number
      explanation: string | null
      question_number: number | null
      status: CardStatus
      created_at: string
      updated_at: string
      card_template_tags: Array<{ tags: { id: string; name: string; color: string } | null }> | null
    }
    
    const tags = (card.card_template_tags || [])
      .filter(ctt => ctt.tags !== null)
      .map(ctt => ctt.tags!)

    return {
      id: card.id,
      stem: card.stem,
      options: card.options,
      correctIndex: card.correct_index,
      explanation: card.explanation,
      questionNumber: card.question_number,
      status: card.status || 'published',
      tags,
      createdAt: card.created_at,
      updatedAt: card.updated_at || card.created_at,
    }
  })

  // Build session metadata
  const firstCardFull = cardTemplates[0] as unknown as {
    book_source_id: string | null
    chapter_id: string | null
    created_at: string
    book_sources: { id: string; title: string } | null
    chapters: { id: string; title: string } | null
  }

  const statusCounts = cards.reduce(
    (acc, card) => {
      acc[card.status] = (acc[card.status] || 0) + 1
      return acc
    },
    {} as Record<CardStatus, number>
  )

  const sessionMeta: ImportSessionMeta = {
    id: sessionId,
    bookSourceId: firstCardFull.book_source_id,
    bookTitle: firstCardFull.book_sources?.title || null,
    chapterId: firstCardFull.chapter_id,
    chapterTitle: firstCardFull.chapters?.title || null,
    draftCount: statusCounts.draft || 0,
    publishedCount: statusCounts.published || 0,
    archivedCount: statusCounts.archived || 0,
    createdAt: firstCardFull.created_at,
  }

  return { ok: true, cards, sessionMeta }
}

/**
 * V11.3: Publishes selected cards by updating their status to 'published'.
 * Preserves import_session_id for session history.
 * 
 * @param cardIds - Array of card IDs to publish
 * @returns PublishCardsResult with count of published cards
 */
export async function publishCards(cardIds: string[]): Promise<PublishCardsResult> {
  if (!cardIds || cardIds.length === 0) {
    return { ok: false, error: { message: 'No cards selected', code: 'VALIDATION_ERROR' } }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }

  const supabase = await createSupabaseServerClient()

  // Verify author owns all cards
  const { data: cards, error: fetchError } = await supabase
    .from('card_templates')
    .select('id, deck_templates!inner(author_id)')
    .in('id', cardIds)

  if (fetchError || !cards) {
    return { ok: false, error: { message: 'Failed to verify card ownership', code: 'DB_ERROR' } }
  }

  // Check all cards belong to user
  const unauthorized = cards.some((card) => {
    const c = card as unknown as { deck_templates: { author_id: string } }
    return c.deck_templates.author_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: { message: 'Not authorized to publish these cards', code: 'UNAUTHORIZED' } }
  }

  // Update status to published (preserves import_session_id)
  const { error: updateError, data } = await supabase
    .from('card_templates')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .in('id', cardIds)
    .select('id')

  if (updateError) {
    return { ok: false, error: { message: updateError.message, code: 'DB_ERROR' } }
  }

  return { ok: true, publishedCount: data?.length || cardIds.length }
}

/**
 * V11.3: Archives selected cards by updating their status to 'archived'.
 * Archived cards are hidden from study but retained for historical purposes.
 * 
 * @param cardIds - Array of card IDs to archive
 * @returns ArchiveCardsResult with count of archived cards
 */
export async function archiveCards(cardIds: string[]): Promise<ArchiveCardsResult> {
  if (!cardIds || cardIds.length === 0) {
    return { ok: false, error: { message: 'No cards selected', code: 'VALIDATION_ERROR' } }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }

  const supabase = await createSupabaseServerClient()

  // Verify author owns all cards
  const { data: cards, error: fetchError } = await supabase
    .from('card_templates')
    .select('id, deck_templates!inner(author_id)')
    .in('id', cardIds)

  if (fetchError || !cards) {
    return { ok: false, error: { message: 'Failed to verify card ownership', code: 'DB_ERROR' } }
  }

  const unauthorized = cards.some((card) => {
    const c = card as unknown as { deck_templates: { author_id: string } }
    return c.deck_templates.author_id !== user.id
  })

  if (unauthorized) {
    return { ok: false, error: { message: 'Not authorized to archive these cards', code: 'UNAUTHORIZED' } }
  }

  // Update status to archived
  const { error: updateError, data } = await supabase
    .from('card_templates')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .in('id', cardIds)
    .select('id')

  if (updateError) {
    return { ok: false, error: { message: updateError.message, code: 'DB_ERROR' } }
  }

  return { ok: true, archivedCount: data?.length || cardIds.length }
}


/**
 * V11.3: Duplicates a card within the same import session.
 * The new card has status='draft' and preserves the import_session_id.
 * 
 * @param cardId - ID of the card to duplicate
 * @returns DuplicateCardResult with the new card's ID
 */
export async function duplicateCard(cardId: string): Promise<DuplicateCardResult> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch original card with tags
  const { data: original, error: fetchError } = await supabase
    .from('card_templates')
    .select(`
      *,
      deck_templates!inner(author_id),
      card_template_tags(tag_id)
    `)
    .eq('id', cardId)
    .single()

  if (fetchError || !original) {
    return { ok: false, error: { message: 'Card not found', code: 'NOT_FOUND' } }
  }

  // Verify author authorization
  const card = original as unknown as {
    deck_templates: { author_id: string }
    deck_template_id: string
    stem: string
    options: string[]
    correct_index: number
    explanation: string | null
    book_source_id: string | null
    chapter_id: string | null
    question_number: number | null
    import_session_id: string | null
    matching_group_id: string | null
    card_template_tags: Array<{ tag_id: string }> | null
  }

  if (card.deck_templates.author_id !== user.id) {
    return { ok: false, error: { message: 'Not authorized to duplicate this card', code: 'UNAUTHORIZED' } }
  }

  // Create duplicate with draft status
  const { data: newCard, error: insertError } = await supabase
    .from('card_templates')
    .insert({
      deck_template_id: card.deck_template_id,
      author_id: user.id,
      stem: card.stem,
      options: card.options,
      correct_index: card.correct_index,
      explanation: card.explanation,
      book_source_id: card.book_source_id,
      chapter_id: card.chapter_id,
      question_number: null, // Don't copy question number
      import_session_id: card.import_session_id, // Preserve session ID
      matching_group_id: card.matching_group_id,
      status: 'draft', // Always draft for duplicates
    })
    .select('id')
    .single()

  if (insertError || !newCard) {
    return { ok: false, error: { message: 'Failed to create duplicate', code: 'DB_ERROR' } }
  }

  // Copy tags to new card
  const tagIds = (card.card_template_tags || []).map(t => t.tag_id)
  if (tagIds.length > 0) {
    const tagRows = tagIds.map(tagId => ({
      card_template_id: newCard.id,
      tag_id: tagId,
    }))
    await supabase.from('card_template_tags').insert(tagRows)
  }

  return { ok: true, newCardId: newCard.id }
}

/**
 * V11.3: Gets session statistics for a given session ID.
 * Used by the session panel on the BulkImport page.
 * 
 * @param sessionId - The import_session_id to get stats for
 * @returns Session statistics including counts by status
 */
export async function getSessionStats(sessionId: string): Promise<{
  ok: boolean
  stats?: {
    draftCount: number
    publishedCount: number
    archivedCount: number
    totalCount: number
    questionNumbers: number[]
  }
  error?: { message: string; code: string }
}> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch cards with this session ID
  const { data: cards, error } = await supabase
    .from('card_templates')
    .select('status, question_number, deck_templates!inner(author_id)')
    .eq('import_session_id', sessionId)

  if (error) {
    return { ok: false, error: { message: error.message, code: 'DB_ERROR' } }
  }

  if (!cards || cards.length === 0) {
    return { ok: true, stats: { draftCount: 0, publishedCount: 0, archivedCount: 0, totalCount: 0, questionNumbers: [] } }
  }

  // Verify author authorization
  const firstCard = cards[0] as unknown as { deck_templates: { author_id: string } }
  if (firstCard.deck_templates.author_id !== user.id) {
    return { ok: false, error: { message: 'Not authorized', code: 'UNAUTHORIZED' } }
  }

  // Calculate stats
  let draftCount = 0
  let publishedCount = 0
  let archivedCount = 0
  const questionNumbers: number[] = []

  for (const card of cards) {
    const c = card as unknown as { status: string; question_number: number | null }
    if (c.status === 'draft') draftCount++
    else if (c.status === 'published') publishedCount++
    else if (c.status === 'archived') archivedCount++
    
    if (c.question_number !== null) {
      questionNumbers.push(c.question_number)
    }
  }

  return {
    ok: true,
    stats: {
      draftCount,
      publishedCount,
      archivedCount,
      totalCount: cards.length,
      questionNumbers: questionNumbers.sort((a, b) => a - b),
    },
  }
}
