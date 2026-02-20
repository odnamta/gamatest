'use server'

/**
 * V11/V13: Book Source Server Actions
 *
 * CRUD operations for book sources (textbooks/question banks).
 * V13: Org-scoped via withOrgUser helper.
 */

import { withOrgUser } from './_helpers'
import {
  createBookSourceSchema,
  updateBookSourceSchema,
  type CreateBookSourceInput,
  type UpdateBookSourceInput,
} from '@/lib/structured-content-schema'
import type { ActionResultV2 } from '@/types/actions'
import type { BookSource } from '@/types/database'

// ============================================
// Create Book Source
// ============================================

export async function createBookSource(
  input: CreateBookSourceInput
): Promise<ActionResultV2<BookSource>> {
  // Validate input before auth to fail fast
  const validation = createBookSourceSchema.safeParse(input)
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0]?.message || 'Invalid input' }
  }

  return withOrgUser(async ({ user, supabase, org }) => {
    const { title, edition, specialty } = validation.data

    const { data, error } = await supabase
      .from('book_sources')
      .insert({
        author_id: user.id,
        org_id: org.id,
        title,
        edition: edition ?? null,
        specialty: specialty ?? null,
      })
      .select()
      .single()

    if (error) {
      return { ok: false, error: 'Failed to create book source' }
    }

    return { ok: true, data: data as BookSource }
  })
}

// ============================================
// Get Book Sources
// ============================================

export async function getBookSources(): Promise<ActionResultV2<BookSource[]>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    // Parallel queries instead of .or() string interpolation
    const [orgResult, legacyResult] = await Promise.all([
      supabase
        .from('book_sources')
        .select('*')
        .eq('author_id', user.id)
        .eq('org_id', org.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('book_sources')
        .select('*')
        .eq('author_id', user.id)
        .is('org_id', null)
        .order('created_at', { ascending: false }),
    ])

    const orgBooks = orgResult.data ?? []
    const legacyBooks = legacyResult.data ?? []
    const seen = new Set(orgBooks.map((b) => b.id))
    const merged = [...orgBooks, ...legacyBooks.filter((b) => !seen.has(b.id))]

    return { ok: true, data: merged as BookSource[] }
  })
}

// ============================================
// Get Single Book Source
// ============================================

export async function getBookSource(id: string): Promise<ActionResultV2<BookSource>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { data, error } = await supabase
      .from('book_sources')
      .select('*')
      .eq('id', id)
      .eq('author_id', user.id)
      .eq('org_id', org.id)
      .single()

    if (error) {
      return { ok: false, error: 'Book source not found' }
    }

    return { ok: true, data: data as BookSource }
  })
}

// ============================================
// Update Book Source
// ============================================

export async function updateBookSource(
  input: UpdateBookSourceInput
): Promise<ActionResultV2<BookSource>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    // Validate input
    const validation = updateBookSourceSchema.safeParse(input)
    if (!validation.success) {
      return { ok: false, error: validation.error.issues[0]?.message || 'Invalid input' }
    }

    const { id, ...updates } = validation.data

    // Build update object (only include defined fields)
    const updateData: Record<string, unknown> = {}
    if (updates.title !== undefined) updateData.title = updates.title
    if (updates.edition !== undefined) updateData.edition = updates.edition
    if (updates.specialty !== undefined) updateData.specialty = updates.specialty

    if (Object.keys(updateData).length === 0) {
      return { ok: false, error: 'No fields to update' }
    }

    const { data, error } = await supabase
      .from('book_sources')
      .update(updateData)
      .eq('id', id)
      .eq('author_id', user.id)
      .eq('org_id', org.id)
      .select()
      .single()

    if (error) {
      return { ok: false, error: 'Failed to update book source' }
    }

    return { ok: true, data: data as BookSource }
  })
}

// ============================================
// Delete Book Source
// ============================================

export async function deleteBookSource(id: string): Promise<ActionResultV2<void>> {
  return withOrgUser(async ({ user, supabase, org }) => {
    const { error } = await supabase
      .from('book_sources')
      .delete()
      .eq('id', id)
      .eq('author_id', user.id)
      .eq('org_id', org.id)

    if (error) {
      return { ok: false, error: 'Failed to delete book source' }
    }

    return { ok: true }
  })
}
