'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { getCategoryColor } from '@/lib/tag-colors'
import { toTitleCase } from '@/lib/string-utils'
import type { Tag, TagCategory } from '@/types/database'

/**
 * Admin Tag Server Actions
 * V9: Tag Manager functionality for category management and merging
 * V9.5: Added renameTag and autoFormatTags for data hygiene
 * Requirements: V9-3.2, V9-3.3, V9-3.4, V9-3.5, V9.5-2.1, V9.5-4.1
 */

// Validation schemas
const updateCategorySchema = z.object({
  tagId: z.string().uuid('Invalid tag ID'),
  category: z.enum(['source', 'topic', 'concept']),
})

const mergeTagsSchema = z.object({
  sourceTagId: z.string().uuid('Invalid source tag ID'),
  targetTagId: z.string().uuid('Invalid target tag ID'),
})

// Result types
export type AdminTagActionResult =
  | { ok: true; tag?: Tag }
  | { ok: false; error: string }

export type MergeTagsResult =
  | { ok: true; mergedCount: number }
  | { ok: false; error: string }

export interface TagsByCategory {
  source: Tag[]
  topic: Tag[]
  concept: Tag[]
}

// V9.5: Rename tag result types
export type RenameTagResult =
  | { ok: true; tag: Tag }
  | { ok: false; error: string }
  | { ok: false; conflict: true; existingTagId: string; existingTagName: string }

// V9.5: Auto-format result types
export interface AutoFormatTagsResult {
  ok: true
  updated: number
  skipped: Array<{ tagId: string; tagName: string; reason: string }>
}

export type AutoFormatResult = AutoFormatTagsResult | { ok: false; error: string }

// ============================================
// V9.6: Tag Consolidation Types
// ============================================

/**
 * V9.6: Merge suggestion from AI analysis
 */
export interface MergeSuggestion {
  masterTagId: string
  masterTagName: string
  variations: Array<{
    tagId: string
    tagName: string
  }>
}

/**
 * V9.6: Result type for tag consolidation analysis
 */
export type AnalyzeTagConsolidationResult =
  | { ok: true; suggestions: MergeSuggestion[] }
  | { ok: false; error: 'NOT_CONFIGURED' | 'AI_ERROR' | 'PARSE_ERROR' | 'AUTH_ERROR' }

/**
 * Update a tag's category and automatically update its color.
 * V9: Category change triggers color enforcement.
 * Req: V9-3.2, V9-3.5
 */
export async function updateTagCategory(
  tagId: string,
  newCategory: TagCategory
): Promise<AdminTagActionResult> {
  const validation = updateCategorySchema.safeParse({ tagId, category: newCategory })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify ownership
  const { data: existingTag } = await supabase
    .from('tags')
    .select('id, category')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (!existingTag) {
    return { ok: false, error: 'Tag not found' }
  }

  // V9: Enforce color based on new category
  const newColor = getCategoryColor(newCategory)

  // Update category and color atomically
  const { data: tag, error } = await supabase
    .from('tags')
    .update({ category: newCategory, color: newColor })
    .eq('id', tagId)
    .select()
    .single()

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/admin/tags')
  return { ok: true, tag }
}

/**
 * Merge two tags: transfer all associations from source to target, then delete source.
 * V9: Preserves all card-tag relationships.
 * Req: V9-3.3, V9-3.4
 */
export async function mergeTags(
  sourceTagId: string,
  targetTagId: string
): Promise<MergeTagsResult> {
  const validation = mergeTagsSchema.safeParse({ sourceTagId, targetTagId })
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  if (sourceTagId === targetTagId) {
    return { ok: false, error: 'Cannot merge a tag with itself' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify ownership of both tags
  const { data: sourcetag } = await supabase
    .from('tags')
    .select('id, name')
    .eq('id', sourceTagId)
    .eq('user_id', user.id)
    .single()

  const { data: targetTag } = await supabase
    .from('tags')
    .select('id, name')
    .eq('id', targetTagId)
    .eq('user_id', user.id)
    .single()

  if (!sourcetag || !targetTag) {
    return { ok: false, error: 'One or both tags not found' }
  }

  // Get all card_template_tags associations for source and target tags in parallel
  const [{ data: sourceAssociations }, { data: targetAssociations }] = await Promise.all([
    supabase.from('card_template_tags').select('card_template_id').eq('tag_id', sourceTagId),
    supabase.from('card_template_tags').select('card_template_id').eq('tag_id', targetTagId),
  ])

  let mergedCount = 0
  const targetCardIds = new Set((targetAssociations ?? []).map((a) => a.card_template_id))

  if (sourceAssociations && sourceAssociations.length > 0) {
    const toTransfer = sourceAssociations.filter((a) => !targetCardIds.has(a.card_template_id))
    const toDedupe = sourceAssociations.filter((a) => targetCardIds.has(a.card_template_id))

    // Batch transfer: update non-duplicate associations to target tag
    for (const assoc of toTransfer) {
      await supabase
        .from('card_template_tags')
        .update({ tag_id: targetTagId })
        .eq('card_template_id', assoc.card_template_id)
        .eq('tag_id', sourceTagId)
      mergedCount++
    }

    // Batch delete: remove duplicate associations
    for (const assoc of toDedupe) {
      await supabase
        .from('card_template_tags')
        .delete()
        .eq('card_template_id', assoc.card_template_id)
        .eq('tag_id', sourceTagId)
    }
  }

  // Also handle legacy card_tags table (batched)
  const [{ data: legacyAssociations }, { data: legacyTargetAssocs }] = await Promise.all([
    supabase.from('card_tags').select('card_id').eq('tag_id', sourceTagId),
    supabase.from('card_tags').select('card_id').eq('tag_id', targetTagId),
  ])
  const legacyTargetIds = new Set((legacyTargetAssocs ?? []).map((a) => a.card_id))

  if (legacyAssociations && legacyAssociations.length > 0) {
    const toTransfer = legacyAssociations.filter((a) => !legacyTargetIds.has(a.card_id))
    const toDedupe = legacyAssociations.filter((a) => legacyTargetIds.has(a.card_id))

    for (const assoc of toTransfer) {
      await supabase
        .from('card_tags')
        .update({ tag_id: targetTagId })
        .eq('card_id', assoc.card_id)
        .eq('tag_id', sourceTagId)
      mergedCount++
    }

    for (const assoc of toDedupe) {
      await supabase
        .from('card_tags')
        .delete()
        .eq('card_id', assoc.card_id)
        .eq('tag_id', sourceTagId)
    }
  }

  // Delete the source tag
  const { error: deleteError } = await supabase
    .from('tags')
    .delete()
    .eq('id', sourceTagId)

  if (deleteError) {
    return { ok: false, error: deleteError.message }
  }

  revalidatePath('/admin/tags')
  return { ok: true, mergedCount }
}

// ============================================
// V9.2: Enhanced Tag Merge (Multiple Sources)
// ============================================

/**
 * V9.2: Result type for bulk merge operations
 */
export type BulkMergeTagsResult =
  | { ok: true; affectedCards: number; deletedTags: number }
  | { ok: false; error: string }

/**
 * V9.2: Merge multiple source tags into a single target tag.
 * All card associations from source tags are transferred to target.
 * Handles duplicates by removing source links when target already exists.
 * 
 * Requirements: 3.4, 3.5, 3.6, 3.7, 3.8
 * 
 * @param sourceTagIds - Array of tag IDs to merge away
 * @param targetTagId - The tag ID to merge into
 * @returns BulkMergeTagsResult with affected card and deleted tag counts
 */
export async function mergeMultipleTags(
  sourceTagIds: string[],
  targetTagId: string
): Promise<BulkMergeTagsResult> {
  if (!sourceTagIds.length) {
    return { ok: false, error: 'No source tags selected' }
  }

  if (sourceTagIds.includes(targetTagId)) {
    return { ok: false, error: 'Cannot merge a tag into itself' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify target tag exists and belongs to user
  const { data: targetTag, error: targetError } = await supabase
    .from('tags')
    .select('id, name')
    .eq('id', targetTagId)
    .eq('user_id', user.id)
    .single()

  if (targetError || !targetTag) {
    return { ok: false, error: 'Target tag not found' }
  }

  // Verify all source tags exist and belong to user
  const { data: sourceTags, error: sourceError } = await supabase
    .from('tags')
    .select('id, name')
    .in('id', sourceTagIds)
    .eq('user_id', user.id)

  if (sourceError || !sourceTags || sourceTags.length !== sourceTagIds.length) {
    return { ok: false, error: 'One or more source tags not found' }
  }

  let totalAffectedCards = 0
  let deletedTags = 0

  // Process each source tag
  for (const sourceTagId of sourceTagIds) {
    // Get all card_template_tags associations for this source tag
    const { data: sourceAssociations } = await supabase
      .from('card_template_tags')
      .select('card_template_id')
      .eq('tag_id', sourceTagId)

    if (sourceAssociations && sourceAssociations.length > 0) {
      for (const assoc of sourceAssociations) {
        // Check if target already has this card
        const { data: existing } = await supabase
          .from('card_template_tags')
          .select('card_template_id')
          .eq('card_template_id', assoc.card_template_id)
          .eq('tag_id', targetTagId)
          .single()

        if (!existing) {
          // Transfer association to target tag
          const { error: updateError } = await supabase
            .from('card_template_tags')
            .update({ tag_id: targetTagId })
            .eq('card_template_id', assoc.card_template_id)
            .eq('tag_id', sourceTagId)

          if (!updateError) {
            totalAffectedCards++
          }
        } else {
          // Delete duplicate association (card already has target tag)
          await supabase
            .from('card_template_tags')
            .delete()
            .eq('card_template_id', assoc.card_template_id)
            .eq('tag_id', sourceTagId)
        }
      }
    }

    // Also handle legacy card_tags table
    const { data: legacyAssociations } = await supabase
      .from('card_tags')
      .select('card_id')
      .eq('tag_id', sourceTagId)

    if (legacyAssociations && legacyAssociations.length > 0) {
      for (const assoc of legacyAssociations) {
        const { data: existing } = await supabase
          .from('card_tags')
          .select('card_id')
          .eq('card_id', assoc.card_id)
          .eq('tag_id', targetTagId)
          .single()

        if (!existing) {
          const { error: updateError } = await supabase
            .from('card_tags')
            .update({ tag_id: targetTagId })
            .eq('card_id', assoc.card_id)
            .eq('tag_id', sourceTagId)

          if (!updateError) {
            totalAffectedCards++
          }
        } else {
          await supabase
            .from('card_tags')
            .delete()
            .eq('card_id', assoc.card_id)
            .eq('tag_id', sourceTagId)
        }
      }
    }

    // Delete the source tag
    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .eq('id', sourceTagId)

    if (!deleteError) {
      deletedTags++
    }
  }

  revalidatePath('/admin/tags')
  return { ok: true, affectedCards: totalAffectedCards, deletedTags }
}

/**
 * Get all tags grouped by category.
 * V9: Returns tags organized for the Tag Manager UI.
 * Req: V9-3.1
 */
export async function getTagsByCategory(): Promise<TagsByCategory> {
  const user = await getUser()
  if (!user) {
    return { source: [], topic: [], concept: [] }
  }

  const supabase = await createSupabaseServerClient()

  const { data: tags } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  if (!tags) {
    return { source: [], topic: [], concept: [] }
  }

  // Group by category
  return {
    source: tags.filter(t => t.category === 'source'),
    topic: tags.filter(t => t.category === 'topic'),
    concept: tags.filter(t => t.category === 'concept'),
  }
}

/**
 * Get the Golden List of official topics.
 * V9: Used by AI tagging to classify questions.
 * Req: V9-4.1
 */
export async function getGoldenTopics(): Promise<string[]> {
  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  const { data: topics } = await supabase
    .from('tags')
    .select('name')
    .eq('user_id', user.id)
    .eq('category', 'topic')
    .order('name')

  return topics?.map(t => t.name) || []
}

/**
 * Get the Golden List of official sources.
 * V9: Used by session presets.
 */
export async function getGoldenSources(): Promise<Tag[]> {
  const user = await getUser()
  if (!user) {
    return []
  }

  const supabase = await createSupabaseServerClient()

  const { data: sources } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .eq('category', 'source')
    .order('name')

  return sources || []
}

// ============================================
// V9.5: Data Hygiene - Rename and Auto-Format
// ============================================

/**
 * V9.5: Rename a tag with duplicate detection.
 * Returns conflict response if new name matches existing tag (case-insensitive).
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 * 
 * @param tagId - The tag ID to rename
 * @param newName - The new name for the tag
 * @returns RenameTagResult with success, error, or conflict response
 */
export async function renameTag(
  tagId: string,
  newName: string
): Promise<RenameTagResult> {
  // Validate new name is non-empty after trimming
  const trimmedName = newName.trim()
  if (!trimmedName) {
    return { ok: false, error: 'Tag name cannot be empty' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Verify the tag exists and belongs to user
  const { data: existingTag, error: tagError } = await supabase
    .from('tags')
    .select('id, name')
    .eq('id', tagId)
    .eq('user_id', user.id)
    .single()

  if (tagError || !existingTag) {
    return { ok: false, error: 'Tag not found' }
  }

  // If name hasn't changed, return success
  if (existingTag.name === trimmedName) {
    const { data: tag } = await supabase
      .from('tags')
      .select('*')
      .eq('id', tagId)
      .single()
    return { ok: true, tag: tag as Tag }
  }

  // Check for existing tag with same name (case-insensitive)
  const { data: conflictingTag } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', user.id)
    .ilike('name', trimmedName)
    .neq('id', tagId)
    .single()

  if (conflictingTag) {
    return {
      ok: false,
      conflict: true,
      existingTagId: conflictingTag.id,
      existingTagName: conflictingTag.name,
    }
  }

  // Update the tag name
  const { data: updatedTag, error: updateError } = await supabase
    .from('tags')
    .update({ name: trimmedName })
    .eq('id', tagId)
    .select()
    .single()

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  revalidatePath('/admin/tags')
  return { ok: true, tag: updatedTag as Tag }
}

/**
 * V9.5: Auto-format all tags to Title Case.
 * Skips tags that would create collisions.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * 
 * @returns AutoFormatResult with counts of updated and skipped tags
 */
export async function autoFormatTags(): Promise<AutoFormatResult> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'Authentication required' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch all tags for the user
  const { data: tags, error: fetchError } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', user.id)
    .order('name')

  if (fetchError) {
    return { ok: false, error: fetchError.message }
  }

  if (!tags || tags.length === 0) {
    return { ok: true, updated: 0, skipped: [] }
  }

  // Build a map of formatted names to detect collisions
  const formattedNames = new Map<string, string>() // lowercase formatted -> original tag id
  const skipped: Array<{ tagId: string; tagName: string; reason: string }> = []
  const toUpdate: Array<{ id: string; newName: string }> = []

  // First pass: identify what needs updating and detect collisions
  for (const tag of tags) {
    const formatted = toTitleCase(tag.name)
    const formattedLower = formatted.toLowerCase()

    // Skip if already formatted
    if (tag.name === formatted) {
      formattedNames.set(formattedLower, tag.id)
      continue
    }

    // Check if formatted name would collide with existing tag
    const existingTagWithName = tags.find(
      t => t.id !== tag.id && t.name.toLowerCase() === formattedLower
    )

    if (existingTagWithName) {
      skipped.push({
        tagId: tag.id,
        tagName: tag.name,
        reason: `Would collide with existing tag "${existingTagWithName.name}"`,
      })
      continue
    }

    // Check if formatted name would collide with another tag being formatted
    if (formattedNames.has(formattedLower)) {
      skipped.push({
        tagId: tag.id,
        tagName: tag.name,
        reason: `Would collide after formatting`,
      })
      continue
    }

    formattedNames.set(formattedLower, tag.id)
    toUpdate.push({ id: tag.id, newName: formatted })
  }

  // Second pass: update tags
  let updated = 0
  for (const { id, newName } of toUpdate) {
    const { error: updateError } = await supabase
      .from('tags')
      .update({ name: newName })
      .eq('id', id)

    if (!updateError) {
      updated++
    }
  }

  if (updated > 0) {
    revalidatePath('/admin/tags')
  }

  return { ok: true, updated, skipped }
}

// ============================================
// V9.6: AI-Powered Tag Consolidation
// ============================================

import { openai } from '@/lib/openai-client'
import {
  batchTagsForAnalysis,
  parseConsolidationResponse,
  resolveTagSuggestions,
  buildTagLookup,
} from '@/lib/tag-consolidation'

/**
 * V9.6: Analyze tags using AI to identify typos, synonyms, and casing issues.
 * Returns merge suggestions grouped by master tag.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3
 * 
 * @returns AnalyzeTagConsolidationResult with suggestions or error
 */
export async function analyzeTagConsolidation(): Promise<AnalyzeTagConsolidationResult> {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }

  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'AUTH_ERROR' }
  }

  const supabase = await createSupabaseServerClient()

  // Fetch all tags for the user
  const { data: tags, error: fetchError } = await supabase
    .from('tags')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  if (fetchError) {
    console.error('Failed to fetch tags:', fetchError)
    return { ok: false, error: 'AI_ERROR' }
  }

  if (!tags || tags.length === 0) {
    return { ok: true, suggestions: [] }
  }

  // Build lookup map for resolution
  const tagLookup = buildTagLookup(tags)
  const tagNames = tags.map(t => t.name)

  // Batch tags if needed (< 200 = single batch, otherwise chunks of 100)
  const batches = batchTagsForAnalysis(tagNames)

  // Process each batch and collect suggestions
  const allSuggestions: MergeSuggestion[] = []

  for (const batch of batches) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `You are a data cleanup assistant. Analyze the provided list of tags and identify groups that should be merged due to:
- Typos (e.g., "Adrenalgland" should be "Adrenal Glands")
- Synonyms (e.g., "OB" and "Obstetrics")
- Casing inconsistencies (e.g., "adrenal glands" and "Adrenal Glands")
- Spacing/punctuation issues (e.g., "Adrenal-gland" and "Adrenal Glands")

For each group, choose the most correct/canonical form as the "master" tag.

Return ONLY valid JSON in this exact format:
{
  "groups": [
    {
      "master": "Canonical Tag Name",
      "variations": ["typo1", "synonym1", "casing-variant"]
    }
  ]
}

If no duplicates/synonyms are found, return: {"groups": []}`,
          },
          {
            role: 'user',
            content: `Analyze these tags for duplicates, typos, and synonyms:\n\n${batch.join('\n')}`,
          },
        ],
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        console.error('OpenAI returned empty content')
        continue
      }

      // Parse the AI response
      const parsed = parseConsolidationResponse(content)
      if (!parsed) {
        console.error('Failed to parse AI response:', content)
        continue
      }

      // Resolve suggestions to database IDs
      const resolved = resolveTagSuggestions(parsed, tagLookup)
      allSuggestions.push(...resolved)
    } catch (error) {
      console.error('OpenAI API error:', error)
      return { ok: false, error: 'AI_ERROR' }
    }
  }

  return { ok: true, suggestions: allSuggestions }
}
