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
import { withOrgUser } from './_helpers'
import { RATE_LIMITS } from '@/lib/rate-limit'
import { validatePdfFile, createSourceSchema } from '@/lib/pdf-validation'
import { formatZodErrors } from '@/lib/zod-utils'
import type { ActionResultV2 } from '@/types/actions'
import type { Source } from '@/types/database'
import { logger } from '@/lib/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

// Storage bucket name - must be created in Supabase Dashboard
const STORAGE_BUCKET = 'sources'

/**
 * V8.2.4: Auto-migrate a single legacy deck to V2 schema.
 * Creates deck_template with legacy_id reference.
 * Creates user_decks subscription for owner.
 * Does NOT migrate cards (lazy migration on first study).
 * 
 * ⚠️ V2 Only Law EXCEPTION: This is an approved exception to read from
 * public.decks for auto-migration purposes only.
 */
async function migrateLegacyDeck(
  supabase: SupabaseClient,
  legacyDeckId: string,
  userId: string
): Promise<{ templateId: string; authorId: string } | null> {
  // 1. Query legacy deck from public.decks
  const { data: legacyDeck, error: legacyError } = await supabase
    .from('decks')
    .select('id, title, user_id')
    .eq('id', legacyDeckId)
    .single()

  if (legacyError || !legacyDeck) {
    return null
  }

  // 2. Verify ownership - only owner can trigger migration
  if (legacyDeck.user_id !== userId) {
    return null
  }

  // 3. Race condition guard - check if already migrated
  const { data: existing } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('legacy_id', legacyDeckId)
    .single()

  if (existing) {
    return { templateId: existing.id, authorId: existing.author_id }
  }

  // 4. Create deck_template with legacy_id reference
  const { data: newTemplate, error: createError } = await supabase
    .from('deck_templates')
    .insert({
      title: legacyDeck.title,
      author_id: legacyDeck.user_id,
      visibility: 'private',
      legacy_id: legacyDeckId,
    })
    .select('id, author_id')
    .single()

  if (createError || !newTemplate) {
    logger.error('migrateLegacyDeck.createTemplate', createError)
    return null
  }

  // 5. Auto-subscribe owner via user_decks
  const { error: subscribeError } = await supabase.from('user_decks').insert({
    user_id: legacyDeck.user_id,
    deck_template_id: newTemplate.id,
    is_active: true,
  })

  if (subscribeError) {
    console.warn('[migrateLegacyDeck] Failed to auto-subscribe owner:', subscribeError)
    // Don't fail - deck was created successfully
  }

  return { templateId: newTemplate.id, authorId: newTemplate.author_id }
}

/**
 * V8.2.4: Robust ID Resolution Helper with Auto-Migration
 * Resolves a deck ID to a deck_template using 4-step lookup:
 * 1. Direct V2 match (deck_templates.id)
 * 2. Legacy URL match (deck_templates.legacy_id)
 * 3. Subscription match (user_decks.id → deck_template_id)
 * 4. Legacy table lookup + auto-migration (public.decks)
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
    return { templateId: directMatch.id, authorId: directMatch.author_id }
  }

  // Step 2: Legacy URL Match - check deck_templates by legacy_id
  const { data: legacyMatch } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('legacy_id', deckId)
    .single()

  if (legacyMatch) {
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
    const template = userDeckMatch.deck_templates as unknown as { id: string; author_id: string }
    return { templateId: template.id, authorId: template.author_id }
  }

  // Step 4: V8.2.4 - Legacy table lookup + auto-migration
  const migrated = await migrateLegacyDeck(supabase, deckId, userId)
  if (migrated) {
    return migrated
  }

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
): Promise<ActionResultV2<{ source: Source; sourceId: string }>> {
  // Extract form data before entering withOrgUser (FormData can't be passed across async boundaries in some cases)
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const deckId = formData.get('deckId') as string | null

  return withOrgUser(async ({ user, supabase }) => {
  try {

    // Validate file exists
    if (!file || !(file instanceof File)) {
      return { ok: false, error: 'No file provided' }
    }

    // Validate PDF file
    const fileValidation = validatePdfFile(file.name, file.type, file.size)
    if (!fileValidation.valid) {
      return { ok: false, error: fileValidation.error || 'Invalid file' }
    }

    // Validate other fields
    const validationResult = createSourceSchema.safeParse({
      title: title || file.name.replace(/\.pdf$/i, ''),
      deckId: deckId || undefined,
    })

    if (!validationResult.success) {
      return { ok: false, error: formatZodErrors(validationResult.error) }
    }

    const { title: validatedTitle, deckId: validatedDeckId } = validationResult.data

    // V8.2.3: Robust ID resolution with 3-step lookup
    let resolvedTemplateId: string | null = null
    if (validatedDeckId) {
      const resolved = await resolveDeckTemplateId(supabase, validatedDeckId, user.id)
      
      if (!resolved) {
        console.warn('[uploadSourceAction] Deck not found after 4-step lookup:', validatedDeckId, 'User:', user.id)
        return { ok: false, error: 'Deck not found. Please verify the deck exists or create a new one.' }
      }

      // Only authors can upload PDFs to a deck
      if (resolved.authorId !== user.id) {
        console.warn('[uploadSourceAction] Author mismatch:', { templateAuthor: resolved.authorId, currentUser: user.id })
        return { ok: false, error: 'Only the deck author can upload source materials' }
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
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) {
      // Log the full error for debugging
      logger.error('uploadSourceAction.storageUpload', uploadError)
      
      // Check for common error cases and provide helpful messages
      const errorMsg = uploadError.message || String(uploadError)
      if (errorMsg.includes('not found') || errorMsg.includes('does not exist') || errorMsg.includes('Bucket not found')) {
        return {
          ok: false,
          error: `Storage bucket '${STORAGE_BUCKET}' does not exist. Please create it in Supabase Dashboard → Storage.`
        }
      }
      if (errorMsg.includes('policy') || errorMsg.includes('permission') || errorMsg.includes('Unauthorized') || errorMsg.includes('row-level security')) {
        return {
          ok: false,
          error: `Storage Permission Error: Check RLS policies for the '${STORAGE_BUCKET}' bucket.`
        }
      }
      return { ok: false, error: `Upload failed: ${errorMsg}` }
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
      logger.error('uploadSourceAction.createSource', sourceError)
      // Clean up uploaded file if source creation fails
      await supabase.storage.from(STORAGE_BUCKET).remove([filePath])
      
      // Check for table not found error
      const errorMsg = sourceError.message || String(sourceError)
      if (errorMsg.includes('sources') && (errorMsg.includes('not found') || errorMsg.includes('does not exist'))) {
        return { ok: false, error: "Database table 'sources' does not exist. Please run the V2 migration SQL." }
      }
      return { ok: false, error: `Failed to create source: ${errorMsg}` }
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
        logger.error('uploadSourceAction.linkToDeck', linkError)
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

    return { ok: true, data: { source: source as Source, sourceId: source.id } }
  } catch (error) {
    // Catch any unexpected errors and return a proper response
    logger.error('uploadSourceAction', error)
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during upload'
    return { ok: false, error: errorMessage }
  }
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Fetches sources linked to a specific deck via deck_sources.
 * Requirements: 8.3
 */
export async function getSourcesForDeck(deckId: string): Promise<Source[]> {
  // Validate deckId
  if (!deckId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deckId)) {
    return []
  }

  const result = await withOrgUser(async ({ supabase }) => {
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
  }, undefined, RATE_LIMITS.standard)

  // If auth/org error, return empty
  if ('error' in result && (result as { ok: false; error: string }).ok === false) {
    return []
  }
  return result as Source[]
}

/**
 * Links an existing source to a deck.
 * Requirements: 8.3, 9.3
 */
export async function linkSourceToDeckAction(
  sourceId: string,
  deckId: string
): Promise<ActionResultV2> {
  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sourceId) || !uuidRegex.test(deckId)) {
    return { ok: false, error: 'Invalid source or deck ID' }
  }

  return withOrgUser(async ({ user, supabase }) => {
    // Verify user owns the source
    const { data: source, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('id', sourceId)
      .single()

    if (sourceError || !source) {
      return { ok: false, error: 'Source not found or access denied' }
    }

    // V8.2.3: Robust ID resolution with 3-step lookup
    const resolved = await resolveDeckTemplateId(supabase, deckId, user.id)

    if (!resolved) {
      console.warn('[linkSourceToDeckAction] Deck not found after 4-step lookup:', deckId, 'User:', user.id)
      return { ok: false, error: 'Deck not found. Please verify the deck exists or create a new one.' }
    }

    if (resolved.authorId !== user.id) {
      console.warn('[linkSourceToDeckAction] Author mismatch:', { templateAuthor: resolved.authorId, currentUser: user.id })
      return { ok: false, error: 'Only the deck author can link source materials' }
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
        return { ok: false, error: 'Source is already linked to this deck' }
      }
      return { ok: false, error: `Failed to link source: ${linkError.message}` }
    }

    revalidatePath(`/decks/${deckId}`)
    revalidatePath(`/decks/${deckId}/add-bulk`)
    if (resolved.templateId !== deckId) {
      revalidatePath(`/decks/${resolved.templateId}`)
      revalidatePath(`/decks/${resolved.templateId}/add-bulk`)
    }

    return { ok: true }
  }, undefined, RATE_LIMITS.sensitive)
}

/**
 * Unlinks a source from a deck.
 */
export async function unlinkSourceFromDeckAction(
  sourceId: string,
  deckId: string
): Promise<ActionResultV2> {
  // Validate UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(sourceId) || !uuidRegex.test(deckId)) {
    return { ok: false, error: 'Invalid source or deck ID' }
  }

  return withOrgUser(async ({ supabase }) => {
    // Delete the link (RLS will ensure user owns the deck)
    const { error } = await supabase
      .from('deck_sources')
      .delete()
      .eq('deck_id', deckId)
      .eq('source_id', sourceId)

    if (error) {
      return { ok: false, error: `Failed to unlink source: ${error.message}` }
    }

    revalidatePath(`/decks/${deckId}`)
    revalidatePath(`/decks/${deckId}/add-bulk`)

    return { ok: true }
  }, undefined, RATE_LIMITS.sensitive)
}
