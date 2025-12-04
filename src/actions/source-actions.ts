'use server'

/**
 * SUPABASE STORAGE SETUP REQUIRED:
 * ================================
 * This module uploads PDFs to Supabase Storage bucket named "sources".
 * 
 * To create the bucket in Supabase:
 * 1. Go to Supabase Dashboard → Storage
 * 2. Click "New bucket"
 * 3. Name: "sources"
 * 4. Public bucket: YES (so we can generate public URLs for PDFs)
 * 5. File size limit: 50MB
 * 6. Allowed MIME types: application/pdf
 * 
 * RLS Policies for the bucket (run in SQL Editor):
 * ------------------------------------------------
 * -- Allow authenticated users to upload to their own folder
 * CREATE POLICY "Users can upload to own folder" ON storage.objects
 *   FOR INSERT WITH CHECK (
 *     bucket_id = 'sources' AND
 *     auth.uid()::text = (storage.foldername(name))[1]
 *   );
 * 
 * -- Allow authenticated users to read their own files
 * CREATE POLICY "Users can read own files" ON storage.objects
 *   FOR SELECT USING (
 *     bucket_id = 'sources' AND
 *     auth.uid()::text = (storage.foldername(name))[1]
 *   );
 * 
 * -- Allow authenticated users to delete their own files
 * CREATE POLICY "Users can delete own files" ON storage.objects
 *   FOR DELETE USING (
 *     bucket_id = 'sources' AND
 *     auth.uid()::text = (storage.foldername(name))[1]
 *   );
 */

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { validatePdfFile, createSourceSchema } from '@/lib/pdf-validation'
import type { ActionResult } from '@/types/actions'
import type { Source } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

// Storage bucket name - must be created in Supabase Dashboard
const STORAGE_BUCKET = 'sources'

/**
 * V8.2.3: Robust ID Resolution Helper
 * Resolves a deck ID to a deck_template using 3-step lookup:
 * 1. Direct V2 match (deck_templates.id)
 * 2. Legacy URL match (deck_templates.legacy_id)
 * 3. Subscription match (user_decks.id → deck_template_id)
 */
async function resolveDeckTemplateId(
  supabase: SupabaseClient,
  deckId: string,
  userId: string
): Promise<{ templateId: string; authorId: string } | null> {
  // Step 1: Direct V2 Match - check deck_templates by id
  const { data: directMatch } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckId)
    .single()

  if (directMatch) {
    console.log('[resolveDeckTemplateId] Step 1 matched: Direct V2 ID')
    return { templateId: directMatch.id, authorId: directMatch.author_id }
  }

  // Step 2: Legacy URL Match - check deck_templates by legacy_id
  const { data: legacyMatch } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('legacy_id', deckId)
    .single()

  if (legacyMatch) {
    console.log('[resolveDeckTemplateId] Step 2 matched: Legacy ID')
    return { templateId: legacyMatch.id, authorId: legacyMatch.author_id }
  }

  // Step 3: Subscription Match - check user_decks to get deck_template_id
  const { data: userDeckMatch } = await supabase
    .from('user_decks')
    .select('deck_template_id, deck_templates!inner(id, author_id)')
    .eq('id', deckId)
    .eq('user_id', userId)
    .single()

  if (userDeckMatch?.deck_templates) {
    console.log('[resolveDeckTemplateId] Step 3 matched: User Deck subscription')
    const template = userDeckMatch.deck_templates as unknown as { id: string; author_id: string }
    return { templateId: template.id, authorId: template.author_id }
  }

  console.log('[resolveDeckTemplateId] No match found for deckId:', deckId)
  return null
}

/**
 * Server Action for uploading a PDF source document.
 * Validates file type (PDF only) and size, uploads to Supabase Storage,
 * creates source record, and optionally links to a deck.
 * Requirements: 8.4, 9.2, 9.3
 */
export async function uploadSourceAction(
  formData: FormData
): Promise<ActionResult & { sourceId?: string }> {
  try {
    // Get authenticated user
    const user = await getUser()
    if (!user) {
      return { success: false, error: 'Authentication required' }
    }

    // Extract form data
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const deckId = formData.get('deckId') as string | null

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return { success: false, error: 'No file provided' }
    }

    // Validate PDF file
    const fileValidation = validatePdfFile(file.name, file.type, file.size)
    if (!fileValidation.valid) {
      return { success: false, error: fileValidation.error || 'Invalid file' }
    }

    // Validate other fields
    const validationResult = createSourceSchema.safeParse({
      title: title || file.name.replace(/\.pdf$/i, ''),
      deckId: deckId || undefined,
    })

    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0] as string
        if (!fieldErrors[field]) {
          fieldErrors[field] = []
        }
        fieldErrors[field].push(issue.message)
      }
      return { success: false, error: 'Validation failed', fieldErrors }
    }

    const { title: validatedTitle, deckId: validatedDeckId } = validationResult.data
    const supabase = await createSupabaseServerClient()

    // V8.2.3: Robust ID resolution with 3-step lookup
    let resolvedTemplateId: string | null = null
    if (validatedDeckId) {
      console.log('[uploadSourceAction] Received deckId:', validatedDeckId, 'User:', user.id)
      
      const resolved = await resolveDeckTemplateId(supabase, validatedDeckId, user.id)
      
      if (!resolved) {
        console.warn('[uploadSourceAction] Deck not found after 3-step lookup:', validatedDeckId)
        return { success: false, error: 'Deck not found' }
      }

      console.log('[uploadSourceAction] Resolved template:', resolved.templateId, 'from input:', validatedDeckId)

      // Only authors can upload PDFs to a deck
      if (resolved.authorId !== user.id) {
        console.warn('[uploadSourceAction] Author mismatch:', { templateAuthor: resolved.authorId, currentUser: user.id })
        return { success: false, error: 'Only the deck author can upload source materials' }
      }
      
      resolvedTemplateId = resolved.templateId
    }

    // Generate user-scoped file path
    // Format: {user_id}/{timestamp}_{filename}
    // The user_id folder allows RLS policies to restrict access per user
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage (Requirements: 9.2)
    // Uses the "sources" bucket - must be created in Supabase Dashboard
    console.log('[uploadSourceAction] DB check passed, attempting storage upload for:', filePath)
    
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      // Log the full error for debugging
      console.error('[uploadSourceAction] Storage upload error:', uploadError)
      
      // Check for common error cases and provide helpful messages
      const errorMsg = uploadError.message || String(uploadError)
      if (errorMsg.includes('not found') || errorMsg.includes('does not exist') || errorMsg.includes('Bucket not found')) {
        return { 
          success: false, 
          error: `Storage bucket '${STORAGE_BUCKET}' does not exist. Please create it in Supabase Dashboard → Storage.` 
        }
      }
      if (errorMsg.includes('policy') || errorMsg.includes('permission') || errorMsg.includes('Unauthorized') || errorMsg.includes('row-level security')) {
        return { 
          success: false, 
          error: `Storage Permission Error: Check RLS policies for the '${STORAGE_BUCKET}' bucket.` 
        }
      }
      return { success: false, error: `Upload failed: ${errorMsg}` }
    }

    // Get public URL for the uploaded file
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    const fileUrl = urlData.publicUrl

    // Create source record
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .insert({
        user_id: user.id,
        title: validatedTitle,
        type: 'pdf_book',
        file_url: fileUrl,
        metadata: {
          original_filename: file.name,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
        },
      })
      .select()
      .single()

    if (sourceError) {
      // Log the full error for debugging
      console.error('Failed to create source record:', sourceError)
      // Clean up uploaded file if source creation fails
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath])
      
      // Check for table not found error
      const errorMsg = sourceError.message || String(sourceError)
      if (errorMsg.includes('sources') && (errorMsg.includes('not found') || errorMsg.includes('does not exist'))) {
        return { success: false, error: "Database table 'sources' does not exist. Please run the V2 migration SQL." }
      }
      return { success: false, error: `Failed to create source: ${errorMsg}` }
    }

    // Optionally link to deck (Requirements: 9.3)
    // Use resolved template ID for the link, not the original input ID
    if (resolvedTemplateId) {
      const { error: linkError } = await supabase
        .from('deck_sources')
        .insert({
          deck_id: resolvedTemplateId,
          source_id: source.id,
        })

      if (linkError) {
        // Don't fail the whole operation, just log the error
        console.error('[uploadSourceAction] Failed to link source to deck:', linkError)
      }
    }

    // Revalidate relevant paths - use both original and resolved IDs
    if (validatedDeckId) {
      revalidatePath(`/decks/${validatedDeckId}`)
      revalidatePath(`/decks/${validatedDeckId}/add-bulk`)
    }
    if (resolvedTemplateId && resolvedTemplateId !== validatedDeckId) {
      revalidatePath(`/decks/${resolvedTemplateId}`)
      revalidatePath(`/decks/${resolvedTemplateId}/add-bulk`)
    }
    revalidatePath('/dashboard')

    return { success: true, data: source, sourceId: source.id }
  } catch (error) {
    // Catch any unexpected errors and return a proper response
    console.error('uploadSourceAction unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during upload'
    return { success: false, error: errorMessage }
  }
}

/**
 * Fetches sources linked to a specific deck via deck_sources.
 * Requirements: 8.3
 */
export async function getSourcesForDeck(deckId: string): Promise<Source[]> {
  const user = await getUser()
  if (!user) {
    return []
  }

  // Validate deckId
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  // Fetch sources linked to the deck via deck_sources join table
  const { data, error } = await supabase
    .from('deck_sources')
    .select(`
      source_id,
      sources (
        id,
        user_id,
        title,
        type,
        file_url,
        metadata,
        created_at
      )
    `)
    .eq('deck_id', deckId)

  if (error || !data) {
    return []
  }

  // Extract and return the source objects
  return data
    .map((ds) => ds.sources as unknown as Source)
    .filter((source): source is Source => source !== null)
}

/**
 * Links an existing source to a deck.
 * Requirements: 8.3, 9.3
 */
export async function linkSourceToDeckAction(
  sourceId: string,
  deckId: string
): Promise<ActionResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sourceId) || !uuidRegex.test(deckId)) {
    return { success: false, error: 'Invalid source or deck ID' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify user owns the source
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id')
    .eq('id', sourceId)
    .single()

  if (sourceError || !source) {
    return { success: false, error: 'Source not found or access denied' }
  }

  // V8.2.3: Robust ID resolution with 3-step lookup
  console.log('[linkSourceToDeckAction] Received deckId:', deckId, 'User:', user.id)
  
  const resolved = await resolveDeckTemplateId(supabase, deckId, user.id)
  
  if (!resolved) {
    console.warn('[linkSourceToDeckAction] Deck not found after 3-step lookup:', deckId)
    return { success: false, error: 'Deck not found' }
  }

  console.log('[linkSourceToDeckAction] Resolved template:', resolved.templateId, 'from input:', deckId)

  if (resolved.authorId !== user.id) {
    console.warn('[linkSourceToDeckAction] Author mismatch:', { templateAuthor: resolved.authorId, currentUser: user.id })
    return { success: false, error: 'Only the deck author can link source materials' }
  }

  // Create the link using resolved template ID
  const { error: linkError } = await supabase
    .from('deck_sources')
    .insert({
      deck_id: resolved.templateId,
      source_id: sourceId,
    })

  if (linkError) {
    // Check if it's a duplicate
    if (linkError.code === '23505') {
      return { success: false, error: 'Source is already linked to this deck' }
    }
    return { success: false, error: `Failed to link source: ${linkError.message}` }
  }

  revalidatePath(`/decks/${deckId}`)
  revalidatePath(`/decks/${deckId}/add-bulk`)
  if (resolved.templateId !== deckId) {
    revalidatePath(`/decks/${resolved.templateId}`)
    revalidatePath(`/decks/${resolved.templateId}/add-bulk`)
  }

  return { success: true }
}

/**
 * Unlinks a source from a deck.
 */
export async function unlinkSourceFromDeckAction(
  sourceId: string,
  deckId: string
): Promise<ActionResult> {
  const user = await getUser()
  if (!user) {
    return { success: false, error: 'Authentication required' }
  }

  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sourceId) || !uuidRegex.test(deckId)) {
    return { success: false, error: 'Invalid source or deck ID' }
  }

  const supabase = await createSupabaseServerClient()

  // Delete the link (RLS will ensure user owns the deck)
  const { error } = await supabase
    .from('deck_sources')
    .delete()
    .eq('deck_id', deckId)
    .eq('source_id', sourceId)

  if (error) {
    return { success: false, error: `Failed to unlink source: ${error.message}` }
  }

  revalidatePath(`/decks/${deckId}`)
  revalidatePath(`/decks/${deckId}/add-bulk`)

  return { success: true }
}
