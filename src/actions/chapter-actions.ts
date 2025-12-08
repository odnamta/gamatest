'use server'

/**
 * V11: Chapter Server Actions
 * 
 * CRUD operations for book chapters and matching groups.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  createChapterSchema,
  updateChapterSchema,
  createMatchingGroupSchema,
  type CreateChapterInput,
  type UpdateChapterInput,
  type CreateMatchingGroupInput,
} from '@/lib/structured-content-schema'
import type { BookChapter, MatchingGroup, CardTemplateV11 } from '@/types/database'

// ============================================
// Result Types
// ============================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// Create Chapter
// ============================================

export async function createChapter(
  input: CreateChapterInput
): Promise<ActionResult<BookChapter>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate input
  const validation = createChapterSchema.safeParse(input)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' }
  }

  const { book_source_id, chapter_number, title, expected_question_count } = validation.data

  // Verify book source ownership
  const { data: bookSource, error: bookError } = await supabase
    .from('book_sources')
    .select('id')
    .eq('id', book_source_id)
    .eq('author_id', user.id)
    .single()

  if (bookError || !bookSource) {
    return { success: false, error: 'Book source not found or not owned by user' }
  }

  // Insert chapter
  const { data, error } = await supabase
    .from('book_chapters')
    .insert({
      book_source_id,
      chapter_number,
      title,
      expected_question_count: expected_question_count ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: `Chapter ${chapter_number} already exists in this book` }
    }
    console.error('[createChapter] Error:', error)
    return { success: false, error: 'Failed to create chapter' }
  }

  return { success: true, data: data as BookChapter }
}

// ============================================
// Get Chapters by Book
// ============================================

/**
 * Get chapters for a book, ordered by chapter_number ascending
 * Validates: Requirements 2.3 - Chapter Ordering
 */
export async function getChaptersByBook(
  bookSourceId: string
): Promise<ActionResult<BookChapter[]>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch chapters ordered by chapter_number
  const { data, error } = await supabase
    .from('book_chapters')
    .select(`
      *,
      book_sources!inner(author_id)
    `)
    .eq('book_source_id', bookSourceId)
    .eq('book_sources.author_id', user.id)
    .order('chapter_number', { ascending: true })

  if (error) {
    console.error('[getChaptersByBook] Error:', error)
    return { success: false, error: 'Failed to fetch chapters' }
  }

  // Strip the joined book_sources data
  const chapters = (data || []).map(({ book_sources: _, ...chapter }) => chapter) as BookChapter[]

  return { success: true, data: chapters }
}

// ============================================
// Get Single Chapter
// ============================================

export async function getChapter(id: string): Promise<ActionResult<BookChapter>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch chapter with ownership check
  const { data, error } = await supabase
    .from('book_chapters')
    .select(`
      *,
      book_sources!inner(author_id)
    `)
    .eq('id', id)
    .eq('book_sources.author_id', user.id)
    .single()

  if (error) {
    console.error('[getChapter] Error:', error)
    return { success: false, error: 'Chapter not found' }
  }

  // Strip the joined book_sources data
  const { book_sources: _, ...chapter } = data
  return { success: true, data: chapter as BookChapter }
}

// ============================================
// Update Chapter
// ============================================

export async function updateChapter(
  input: UpdateChapterInput
): Promise<ActionResult<BookChapter>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate input
  const validation = updateChapterSchema.safeParse(input)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' }
  }

  const { id, ...updates } = validation.data

  // Build update object
  const updateData: Record<string, unknown> = {}
  if (updates.chapter_number !== undefined) updateData.chapter_number = updates.chapter_number
  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.expected_question_count !== undefined) {
    updateData.expected_question_count = updates.expected_question_count
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No fields to update' }
  }

  // First verify ownership
  const { data: existing } = await supabase
    .from('book_chapters')
    .select(`book_sources!inner(author_id)`)
    .eq('id', id)
    .eq('book_sources.author_id', user.id)
    .single()

  if (!existing) {
    return { success: false, error: 'Chapter not found or not owned by user' }
  }

  // Update chapter
  const { data, error } = await supabase
    .from('book_chapters')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: `Chapter ${updates.chapter_number} already exists in this book` }
    }
    console.error('[updateChapter] Error:', error)
    return { success: false, error: 'Failed to update chapter' }
  }

  return { success: true, data: data as BookChapter }
}

// ============================================
// Delete Chapter
// ============================================

export async function deleteChapter(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify ownership before delete
  const { data: existing } = await supabase
    .from('book_chapters')
    .select(`book_sources!inner(author_id)`)
    .eq('id', id)
    .eq('book_sources.author_id', user.id)
    .single()

  if (!existing) {
    return { success: false, error: 'Chapter not found or not owned by user' }
  }

  // Delete chapter (card_templates.chapter_id will be set to NULL)
  const { error } = await supabase
    .from('book_chapters')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[deleteChapter] Error:', error)
    return { success: false, error: 'Failed to delete chapter' }
  }

  return { success: true }
}

// ============================================
// Create Matching Group
// ============================================

export async function createMatchingGroup(
  input: CreateMatchingGroupInput
): Promise<ActionResult<MatchingGroup>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate input
  const validation = createMatchingGroupSchema.safeParse(input)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid input' }
  }

  const { chapter_id, common_options, instruction_text } = validation.data

  // If chapter_id provided, verify ownership
  if (chapter_id) {
    const { data: chapter } = await supabase
      .from('book_chapters')
      .select(`book_sources!inner(author_id)`)
      .eq('id', chapter_id)
      .eq('book_sources.author_id', user.id)
      .single()

    if (!chapter) {
      return { success: false, error: 'Chapter not found or not owned by user' }
    }
  }

  // Insert matching group
  const { data, error } = await supabase
    .from('matching_groups')
    .insert({
      chapter_id: chapter_id ?? null,
      common_options,
      instruction_text: instruction_text ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[createMatchingGroup] Error:', error)
    return { success: false, error: 'Failed to create matching group' }
  }

  return { success: true, data: data as MatchingGroup }
}

// ============================================
// Get Cards by Chapter
// ============================================

/**
 * Get card templates filtered by chapter_id
 * Validates: Requirements 3.4 - Chapter Card Query Correctness
 */
export async function getCardsByChapter(
  chapterId: string
): Promise<ActionResult<CardTemplateV11[]>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch cards with chapter_id match
  const { data, error } = await supabase
    .from('card_templates')
    .select('*')
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('[getCardsByChapter] Error:', error)
    return { success: false, error: 'Failed to fetch cards' }
  }

  return { success: true, data: data as CardTemplateV11[] }
}

// ============================================
// Get Card Count by Chapter
// ============================================

export async function getCardCountByChapter(
  chapterId: string
): Promise<ActionResult<number>> {
  const supabase = await createSupabaseServerClient()
  
  const { count, error } = await supabase
    .from('card_templates')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)

  if (error) {
    console.error('[getCardCountByChapter] Error:', error)
    return { success: false, error: 'Failed to count cards' }
  }

  return { success: true, data: count ?? 0 }
}
