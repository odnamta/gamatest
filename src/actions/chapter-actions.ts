'use server'

/**
 * V11: Chapter Server Actions
 *
 * CRUD operations for book chapters and matching groups.
 */

import { withOrgUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import {
  createChapterSchema,
  updateChapterSchema,
  createMatchingGroupSchema,
  type CreateChapterInput,
  type UpdateChapterInput,
  type CreateMatchingGroupInput,
} from '@/lib/structured-content-schema'
import type { BookChapter, MatchingGroup, CardTemplateV11 } from '@/types/database'
import type { ActionResultV2 } from '@/types/actions'
import { logger } from '@/lib/logger'

// ============================================
// Create Chapter
// ============================================

export async function createChapter(
  input: CreateChapterInput
): Promise<ActionResultV2<BookChapter>> {
  return withOrgUser(async ({ user, supabase }) => {
    try {
      // Validate input
      const validation = createChapterSchema.safeParse(input)
      if (!validation.success) {
        return { ok: false, error: validation.error.issues[0]?.message || 'Invalid input' }
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
        return { ok: false, error: 'Book source not found or not owned by user' }
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
          return { ok: false, error: `Chapter ${chapter_number} already exists in this book` }
        }
        logger.error('createChapter', error)
        return { ok: false, error: 'Failed to create chapter' }
      }

      return { ok: true, data: data as BookChapter }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Terjadi kesalahan' }
    }
  }, undefined, RATE_LIMITS.sensitive)
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
): Promise<ActionResultV2<BookChapter[]>> {
  return withOrgUser(async ({ user, supabase }) => {
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
      logger.error('getChaptersByBook', error)
      return { ok: false, error: 'Failed to fetch chapters' }
    }

    // Strip the joined book_sources data
    const chapters = (data || []).map(({ book_sources: _, ...chapter }) => chapter) as BookChapter[]

    return { ok: true, data: chapters }
  }, undefined, RATE_LIMITS.standard)
}

// ============================================
// Get Single Chapter
// ============================================

export async function getChapter(id: string): Promise<ActionResultV2<BookChapter>> {
  return withOrgUser(async ({ user, supabase }) => {
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
      logger.error('getChapter', error)
      return { ok: false, error: 'Chapter not found' }
    }

    // Strip the joined book_sources data
    const { book_sources: _, ...chapter } = data
    return { ok: true, data: chapter as BookChapter }
  }, undefined, RATE_LIMITS.standard)
}

// ============================================
// Update Chapter
// ============================================

export async function updateChapter(
  input: UpdateChapterInput
): Promise<ActionResultV2<BookChapter>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Validate input
    const validation = updateChapterSchema.safeParse(input)
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message || 'Invalid input' }
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
      return { ok: false, error: 'No fields to update' }
    }

    // First verify ownership
    const { data: existing } = await supabase
      .from('book_chapters')
      .select(`book_sources!inner(author_id)`)
      .eq('id', id)
      .eq('book_sources.author_id', user.id)
      .single()

    if (!existing) {
      return { ok: false, error: 'Chapter not found or not owned by user' }
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
        return { ok: false, error: `Chapter ${updates.chapter_number} already exists in this book` }
      }
      logger.error('updateChapter', error)
      return { ok: false, error: 'Failed to update chapter' }
    }

    return { ok: true, data: data as BookChapter }
  }, undefined, RATE_LIMITS.sensitive)
}

// ============================================
// Delete Chapter
// ============================================

export async function deleteChapter(id: string): Promise<ActionResultV2> {
  return withOrgUser(async ({ user, supabase }) => {
    // Verify ownership before delete
    const { data: existing } = await supabase
      .from('book_chapters')
      .select(`book_sources!inner(author_id)`)
      .eq('id', id)
      .eq('book_sources.author_id', user.id)
      .single()

    if (!existing) {
      return { ok: false, error: 'Chapter not found or not owned by user' }
    }

    // Delete chapter (card_templates.chapter_id will be set to NULL)
    const { error } = await supabase
      .from('book_chapters')
      .delete()
      .eq('id', id)

    if (error) {
      logger.error('deleteChapter', error)
      return { ok: false, error: 'Failed to delete chapter' }
    }

    return { ok: true }
  }, undefined, RATE_LIMITS.sensitive)
}

// ============================================
// Create Matching Group
// ============================================

export async function createMatchingGroup(
  input: CreateMatchingGroupInput
): Promise<ActionResultV2<MatchingGroup>> {
  return withOrgUser(async ({ user, supabase }) => {
    // Validate input
    const validation = createMatchingGroupSchema.safeParse(input)
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message || 'Invalid input' }
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
        return { ok: false, error: 'Chapter not found or not owned by user' }
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
      logger.error('createMatchingGroup', error)
      return { ok: false, error: 'Failed to create matching group' }
    }

    return { ok: true, data: data as MatchingGroup }
  }, undefined, RATE_LIMITS.sensitive)
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
): Promise<ActionResultV2<CardTemplateV11[]>> {
  return withOrgUser(async ({ supabase }) => {
    // Fetch cards with chapter_id match
    const { data, error } = await supabase
      .from('card_templates')
      .select('*')
      .eq('chapter_id', chapterId)

    if (error) {
      logger.error('getCardsByChapter', error)
      return { ok: false, error: 'Failed to fetch cards' }
    }

    return { ok: true, data: data as CardTemplateV11[] }
  }, undefined, RATE_LIMITS.standard)
}

// ============================================
// Get Card Count by Chapter
// ============================================

export async function getCardCountByChapter(
  chapterId: string
): Promise<ActionResultV2<number>> {
  return withOrgUser(async ({ supabase }) => {
    const { count, error } = await supabase
      .from('card_templates')
      .select('*', { count: 'exact', head: true })
      .eq('chapter_id', chapterId)

    if (error) {
      logger.error('getCardCountByChapter', error)
      return { ok: false, error: 'Failed to count cards' }
    }

    return { ok: true, data: count ?? 0 }
  }, undefined, RATE_LIMITS.standard)
}
