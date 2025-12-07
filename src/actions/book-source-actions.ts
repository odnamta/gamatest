'use server'

/**
 * V11: Book Source Server Actions
 * 
 * CRUD operations for book sources (textbooks/question banks).
 */

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  createBookSourceSchema,
  updateBookSourceSchema,
  type CreateBookSourceInput,
  type UpdateBookSourceInput,
} from '@/lib/structured-content-schema'
import type { BookSource } from '@/types/database'

// ============================================
// Result Types
// ============================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// Create Book Source
// ============================================

export async function createBookSource(
  input: CreateBookSourceInput
): Promise<ActionResult<BookSource>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate input
  const validation = createBookSourceSchema.safeParse(input)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0]?.message || 'Invalid input' }
  }

  const { title, edition, specialty } = validation.data

  // Insert book source
  const { data, error } = await supabase
    .from('book_sources')
    .insert({
      author_id: user.id,
      title,
      edition: edition ?? null,
      specialty: specialty ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[createBookSource] Error:', error)
    return { success: false, error: 'Failed to create book source' }
  }

  return { success: true, data: data as BookSource }
}

// ============================================
// Get Book Sources
// ============================================

export async function getBookSources(): Promise<ActionResult<BookSource[]>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch book sources for current author
  const { data, error } = await supabase
    .from('book_sources')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getBookSources] Error:', error)
    return { success: false, error: 'Failed to fetch book sources' }
  }

  return { success: true, data: data as BookSource[] }
}

// ============================================
// Get Single Book Source
// ============================================

export async function getBookSource(id: string): Promise<ActionResult<BookSource>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Fetch book source
  const { data, error } = await supabase
    .from('book_sources')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id)
    .single()

  if (error) {
    console.error('[getBookSource] Error:', error)
    return { success: false, error: 'Book source not found' }
  }

  return { success: true, data: data as BookSource }
}

// ============================================
// Update Book Source
// ============================================

export async function updateBookSource(
  input: UpdateBookSourceInput
): Promise<ActionResult<BookSource>> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Validate input
  const validation = updateBookSourceSchema.safeParse(input)
  if (!validation.success) {
    return { success: false, error: validation.error.errors[0]?.message || 'Invalid input' }
  }

  const { id, ...updates } = validation.data

  // Build update object (only include defined fields)
  const updateData: Record<string, unknown> = {}
  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.edition !== undefined) updateData.edition = updates.edition
  if (updates.specialty !== undefined) updateData.specialty = updates.specialty

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'No fields to update' }
  }

  // Update book source
  const { data, error } = await supabase
    .from('book_sources')
    .update(updateData)
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('[updateBookSource] Error:', error)
    return { success: false, error: 'Failed to update book source' }
  }

  return { success: true, data: data as BookSource }
}

// ============================================
// Delete Book Source
// ============================================

export async function deleteBookSource(id: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient()
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Delete book source (cascades to chapters)
  const { error } = await supabase
    .from('book_sources')
    .delete()
    .eq('id', id)
    .eq('author_id', user.id)

  if (error) {
    console.error('[deleteBookSource] Error:', error)
    return { success: false, error: 'Failed to delete book source' }
  }

  return { success: true }
}
