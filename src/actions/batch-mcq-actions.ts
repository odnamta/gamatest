'use server'

import { revalidatePath } from 'next/cache'
import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE, MCQ_MAX_TOKENS } from '@/lib/ai-config'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { withUser, type AuthContext } from './_helpers'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getCardDefaults } from '@/lib/card-defaults'
import {
  draftBatchInputSchema,
  mcqBatchItemSchema,
  type DraftBatchInput,
  type DraftBatchResult,
  type BulkCreateResult,
  type MCQBatchItem,
  type MCQBatchItemWithQuality,
  type AIMode,
} from '@/lib/batch-mcq-schema'
import {
  scanChunkForQuestionsAndOptions,
  compareWithAIDrafts,
  getIssuesForDraft,
} from '@/lib/mcq-quality-scanner'
import { deduplicateMCQBatch } from '@/lib/deduplication'
import {
  getBatchSystemPrompt,
  buildMessageContent,
} from '@/lib/ai-prompts'

function buildBatchUserPrompt(text: string, defaultTags?: string[], mode: AIMode = 'extract'): string {
  let prompt = `Source text:\n${text}`
  if (defaultTags && defaultTags.length > 0) {
    prompt += `\n\nContext tags (for reference): ${defaultTags.join(', ')}`
  }
  // V8.6: Removed artificial cap - extract/generate ALL MCQs
  prompt += mode === 'extract'
    ? '\n\nExtract ALL existing MCQs from this content. Return JSON with "questions" array.'
    : '\n\nGenerate ALL distinct MCQs from this content. Return JSON with "questions" array.'
  return prompt
}

/**
 * Server Action: Generate multiple MCQ drafts from source text using OpenAI.
 * V9: Fetches Golden List topics for AI classification.
 */
export async function draftBatchMCQFromText(input: DraftBatchInput): Promise<DraftBatchResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, error: { message: 'AI is not configured', code: 'NOT_CONFIGURED' } }
  }

  const validationResult = draftBatchInputSchema.safeParse(input)
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]
    return { ok: false, error: { message: firstError?.message || 'Invalid input', code: 'VALIDATION_ERROR' } }
  }
  
  const { text, defaultTags, mode = 'extract', subject, imageBase64, imageUrl } = validationResult.data

  // Auth + rate limit check (sensitive: AI batch operation)
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }
  const rateLimitResult = await checkRateLimit(`user:${user.id}:draftBatchMCQ`, RATE_LIMITS.sensitive)
  if (!rateLimitResult.allowed) {
    return { ok: false, error: { message: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' } }
  }

  // V9: Fetch Golden List topics for AI classification
  let goldenTopics: string[] = []
  try {
    const supabase = await createSupabaseServerClient()
    const { data: topics } = await supabase
      .from('tags')
      .select('name')
      .eq('user_id', user.id)
      .eq('category', 'topic')
      .order('name')
    goldenTopics = topics?.map(t => t.name) || []
  } catch {
    logger.warn('draftBatchMCQFromText.goldenList', 'Failed to load Golden List, using defaults')
  }
  
  try {
    const userContent = buildMessageContent(
      buildBatchUserPrompt(text, defaultTags, mode),
      imageBase64,
      imageUrl
    )

    // V8.6: Added max_tokens to prevent truncation on dense pages
    // V9: Pass Golden List topics to system prompt
    // V9.1: Pass subject for dynamic specialty
    const response = await openai.chat.completions.create({
      model: MCQ_MODEL,
      temperature: MCQ_TEMPERATURE,
      max_tokens: MCQ_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getBatchSystemPrompt(mode, goldenTopics, subject) },
        { role: 'user', content: userContent as string },
      ],
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      return { ok: false, error: { message: 'AI returned empty response', code: 'OPENAI_ERROR' } }
    }
    
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return { ok: false, error: { message: 'Invalid AI response format', code: 'PARSE_ERROR' } }
    }
    
    const questionsArray = (parsed as { questions?: unknown })?.questions
    if (!Array.isArray(questionsArray)) {
      return { ok: true, drafts: [] }
    }
    
    const validDrafts: MCQBatchItem[] = []
    // V8.6: Process ALL items without artificial cap
    const itemsToValidate = questionsArray
    let filteredCount = 0

    for (const item of itemsToValidate) {
      const itemResult = mcqBatchItemSchema.safeParse(item)
      if (itemResult.success) {
        validDrafts.push(itemResult.data)
      } else {
        filteredCount++
      }
    }

    // V13: Deduplicate drafts by normalized stem (cross-page duplicates)
    const { unique: dedupedDrafts, removedCount: dedupedCount } = deduplicateMCQBatch(validDrafts)
    if (dedupedCount > 0) {
      logger.info('draftBatchMCQFromText.dedup', `Removed ${dedupedCount} duplicate draft(s) by stem`)
    }

    // V12: Quality Scanner Integration (advisory only, never blocks)
    let scanResult = null
    let numQuestionsWithMissingOptions = 0
    let numQuestionsWithExtraOptions = 0

    try {
      // Step 1: Scan the raw text chunk
      scanResult = scanChunkForQuestionsAndOptions(text)

      // Step 2: Compare with AI drafts (use deduped count)
      const aiDraftOptionCounts = dedupedDrafts.map(d => d.options.length)
      scanResult = compareWithAIDrafts(scanResult, dedupedDrafts.length, aiDraftOptionCounts)

      // Step 3: Count issues by type
      for (const question of scanResult.questions) {
        for (const issue of question.issues) {
          if (issue.code === 'MISSING_OPTIONS') numQuestionsWithMissingOptions++
          if (issue.code === 'EXTRA_OPTIONS') numQuestionsWithExtraOptions++
        }
      }

    } catch (scanError) {
      // V12: Fail soft - log and continue without quality data
      logger.warn('draftBatchMCQFromText.qualityScan', 'Quality scan failed, continuing without quality data')
    }

    // V12: Attach quality issues to each draft (in-memory only)
    const draftsWithQuality: MCQBatchItemWithQuality[] = dedupedDrafts.map((draft, index) => ({
      ...draft,
      qualityIssues: scanResult ? getIssuesForDraft(scanResult, index) : undefined,
      rawTextChunk: text, // Store source text for viewer
    }))

    return {
      ok: true,
      drafts: draftsWithQuality,
      // V12: Quality metadata for metrics
      rawTextChunk: text,
      rawQuestionCount: scanResult?.rawQuestionCount,
      aiDraftCount: dedupedDrafts.length,
      dedupedCount, // V13: Number of duplicates removed
      numQuestionsWithMissingOptions,
      numQuestionsWithExtraOptions,
    }
  } catch (error) {
    logger.error('draftBatchMCQFromText', error)
    return { ok: false, error: { message: 'AI service unavailable', code: 'OPENAI_ERROR' } }
  }
}


// ============================================
// V8.0: Bulk Create - V2 Schema Only (No Fallback)
// ============================================

/**
 * V11: Matching block data for automatic matching_group creation
 */
export interface MatchingBlockInput {
  commonOptions: string[]      // The shared options (A, B, C, D, E texts)
  instructionText?: string     // Optional instruction text for the matching set
}

/**
 * V8.0 Input type for bulk create with deck_template_id
 * V11: Extended with optional book/chapter/matching group context
 * V11.3: Extended with importSessionId for draft/publish workflow
 */
export interface BulkCreateV2Input {
  deckTemplateId: string
  sessionTags?: string[]
  cards: Array<{
    stem: string
    options: string[]
    correctIndex: number
    explanation?: string
    tagNames: string[]
    questionNumber?: number  // V11: Original question number from source
  }>
  // V11: Structured content context (all optional for backwards compatibility)
  bookSourceId?: string
  chapterId?: string
  matchingGroupId?: string
  // V11: Matching block data - when provided, creates a matching_group and links all cards
  matchingBlockData?: MatchingBlockInput
  // V11.3: Import session ID for draft/publish workflow
  // When provided, cards are created with status='draft' and grouped by this session ID
  importSessionId?: string
}

/**
 * V8.0: Server Action to create multiple MCQ card_templates atomically.
 * NO LEGACY FALLBACK - deck_template must exist in V2 schema.
 * 
 * @param input - Deck template ID, sessionTags, and array of cards
 * @returns BulkCreateResult
 */
export async function bulkCreateMCQV2(input: BulkCreateV2Input): Promise<BulkCreateResult> {
  const { 
    deckTemplateId, 
    sessionTags = [], 
    cards,
    // V11: Structured content context
    bookSourceId,
    chapterId,
    matchingGroupId,
    matchingBlockData,
    // V11.3: Import session for draft/publish workflow
    importSessionId,
  } = input
  
  // V11.3: Determine card status based on importSessionId
  // When importSessionId is provided, cards are drafts; otherwise published (backwards compatible)
  const cardStatus = importSessionId ? 'draft' : 'published'

  // Single auth + rate limit via withUser
  const authResult = await withUser(async ({ user, supabase }: AuthContext) => {
    // Rate limit check (sensitive: bulk card creation)
    const bulkCreateRateLimit = await checkRateLimit(`user:${user.id}:bulkCreateMCQ`, RATE_LIMITS.sensitive)
    if (!bulkCreateRateLimit.allowed) {
      return { ok: false as const, error: { message: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' } }
    }

    // V8.0: Direct deck_template lookup - NO FALLBACK
    const { data: deckTemplate, error: deckError } = await supabase
      .from('deck_templates')
      .select('id, author_id')
      .eq('id', deckTemplateId)
      .single()

    if (deckError || !deckTemplate) {
      return { ok: false as const, error: { message: `Deck not found in V2 schema: ${deckTemplateId}`, code: 'NOT_FOUND' } }
    }

    if (deckTemplate.author_id !== user.id) {
      return { ok: false as const, error: { message: 'Only the author can add cards', code: 'UNAUTHORIZED' } }
    }

    return { ok: true as const, data: { user, supabase } }
  })

  // Handle auth failure
  if (!authResult.ok) {
    if (authResult.error === 'AUTH_REQUIRED') {
      return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
    }
    return authResult as BulkCreateResult
  }

  const { user, supabase } = authResult.data!
  
  // V11.6: Import normalizeStem for duplicate detection
  const { normalizeStem } = await import('@/lib/content-staging-metrics')
  
  try {
    // V11.6: Step 0a - Duplicate detection within same deck + session
    // Fetch existing cards in this deck + session to check for duplicates
    let existingStems = new Set<string>()
    let skippedCount = 0
    
    if (importSessionId) {
      const { data: existingCards } = await supabase
        .from('card_templates')
        .select('stem')
        .eq('deck_template_id', deckTemplateId)
        .eq('import_session_id', importSessionId)
      
      if (existingCards) {
        existingStems = new Set(existingCards.map((c) => normalizeStem(c.stem)))
      }
    }
    
    // V11.6: Filter out duplicates and track intra-batch duplicates
    const batchStems = new Set<string>()
    const cardsToCreate: typeof cards = []
    
    for (const card of cards) {
      const normalized = normalizeStem(card.stem)
      
      if (existingStems.has(normalized) || batchStems.has(normalized)) {
        skippedCount++
      } else {
        cardsToCreate.push(card)
        batchStems.add(normalized)
      }
    }
    
    // If all cards were duplicates, return early with success
    if (cardsToCreate.length === 0) {
      return { ok: true, createdCount: 0, skippedCount, deckId: deckTemplateId }
    }
    
    // V11: Step 0b - Create matching_group if matchingBlockData is provided
    // This creates the group first so we can link all cards to it
    let effectiveMatchingGroupId = matchingGroupId || null
    
    if (matchingBlockData && matchingBlockData.commonOptions.length >= 2) {
      const { data: newGroup, error: groupError } = await supabase
        .from('matching_groups')
        .insert({
          chapter_id: chapterId || null,
          common_options: matchingBlockData.commonOptions,
          instruction_text: matchingBlockData.instructionText || null,
        })
        .select('id')
        .single()
      
      if (groupError) {
        logger.error('bulkCreateMCQV2.createMatchingGroup', groupError)
        // Non-fatal: continue without matching group linking
      } else if (newGroup) {
        effectiveMatchingGroupId = newGroup.id
      }
    }
    
    // Step 1: Collect all unique tag names
    // V8.4: Added defensive checks and logging for tag persistence
    // V11.6: Use cardsToCreate (filtered for duplicates)
    const allTagNames = new Set<string>()
    for (const tagName of sessionTags) {
      const trimmed = tagName.trim()
      if (trimmed) allTagNames.add(trimmed)
    }
    for (let cardIdx = 0; cardIdx < cardsToCreate.length; cardIdx++) {
      const card = cardsToCreate[cardIdx]
      // V8.4: Defensive check - ensure tagNames exists and is an array
      const cardTags = Array.isArray(card.tagNames) ? card.tagNames : []

      for (const tagName of cardTags) {
        const trimmed = tagName.trim()
        if (trimmed) {
          const lowerTrimmed = trimmed.toLowerCase()
          const alreadyExists = Array.from(allTagNames).some(
            existing => existing.toLowerCase() === lowerTrimmed
          )
          if (!alreadyExists) allTagNames.add(trimmed)
        }
      }
    }
    
    // V11.5.1: Import tag resolver for canonical topic tag matching
    const { resolveTopicTag } = await import('@/lib/tag-resolver')
    
    // Step 2: Batch resolve tag names to IDs (V20.5: replaces N+1 loop)
    // V11.5.1: Use resolveTopicTag for canonical Golden List matching
    const tagNameToId = new Map<string, string>()
    const tagNamesArray = Array.from(allTagNames)

    // Step 2a: Fetch all existing tags for this user in a single query
    const { data: existingUserTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id)
      .limit(5000)

    const existingByLower = new Map<string, { id: string; name: string }>()
    for (const tag of existingUserTags ?? []) {
      existingByLower.set(tag.name.toLowerCase(), tag)
    }

    // Match existing tags case-insensitively (also check canonical forms)
    for (const tagName of tagNamesArray) {
      const existing = existingByLower.get(tagName.toLowerCase())
      if (existing) {
        tagNameToId.set(tagName.toLowerCase(), existing.id)
        continue
      }
      const canonical = resolveTopicTag(tagName)
      if (canonical) {
        const existingCanonical = existingByLower.get(canonical.toLowerCase())
        if (existingCanonical) {
          tagNameToId.set(tagName.toLowerCase(), existingCanonical.id)
        }
      }
    }

    // Step 2b: Batch create missing tags
    const missingTagNames = tagNamesArray.filter(
      name => !tagNameToId.has(name.toLowerCase())
    )

    if (missingTagNames.length > 0) {
      const newTagRows = missingTagNames.map(tagName => {
        const canonicalTopic = resolveTopicTag(tagName)
        const isGoldenTopic = canonicalTopic !== null
        return {
          user_id: user.id,
          name: canonicalTopic || tagName,
          color: isGoldenTopic ? 'purple' : 'green',
          category: isGoldenTopic ? 'topic' : 'concept',
        }
      })

      const { data: createdTags, error: createError } = await supabase
        .from('tags')
        .insert(newTagRows)
        .select('id, name')

      if (createError?.code === '23505') {
        // Race condition: some tags created concurrently — re-fetch to resolve
        const { data: refreshedTags } = await supabase
          .from('tags')
          .select('id, name')
          .eq('user_id', user.id)
          .limit(5000)

        const refreshedByLower = new Map<string, string>()
        for (const tag of refreshedTags ?? []) {
          refreshedByLower.set(tag.name.toLowerCase(), tag.id)
        }

        for (const tagName of missingTagNames) {
          const finalName = resolveTopicTag(tagName) || tagName
          const tagId = refreshedByLower.get(finalName.toLowerCase())
          if (tagId) tagNameToId.set(tagName.toLowerCase(), tagId)
        }
      } else if (createdTags) {
        for (let i = 0; i < createdTags.length; i++) {
          tagNameToId.set(missingTagNames[i].toLowerCase(), createdTags[i].id)
        }
      }
    }
    
    // Step 3: Insert card_templates
    // V11: Include structured content foreign keys if provided
    // V11.3: Include status and import_session_id for draft/publish workflow
    // V11.5: Use effectiveMatchingGroupId which may be auto-created from matchingBlockData
    // V11.6: Use cardsToCreate (filtered for duplicates)
    const cardTemplateRows = cardsToCreate.map((card) => ({
      deck_template_id: deckTemplateId,
      author_id: user.id,
      stem: card.stem,
      options: card.options,
      correct_index: card.correctIndex,
      explanation: card.explanation || null,
      source_meta: null,
      // V11: Structured content fields (null if not provided for backwards compatibility)
      book_source_id: bookSourceId || null,
      chapter_id: chapterId || null,
      question_number: card.questionNumber || null,
      matching_group_id: effectiveMatchingGroupId,
      // V11.3: Draft/publish workflow fields
      status: cardStatus,
      import_session_id: importSessionId || null,
    }))
    
    const { data: insertedTemplates, error: insertError } = await supabase
      .from('card_templates')
      .insert(cardTemplateRows)
      .select('id')
    
    if (insertError || !insertedTemplates) {
      return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
    }
    
    // Step 4: Insert card_template_tags
    // V8.4: Added logging and defensive checks for tag linking
    const cardTagRows: { card_template_id: string; tag_id: string }[] = []
    const seenPairs = new Set<string>()
    
    for (let i = 0; i < insertedTemplates.length; i++) {
      const cardTemplateId = insertedTemplates[i].id
      let cardTagCount = 0
      
      // Link session tags
      for (const tagName of sessionTags) {
        const tagId = tagNameToId.get(tagName.trim().toLowerCase())
        if (tagId) {
          const key = `${cardTemplateId}:${tagId}`
          if (!seenPairs.has(key)) {
            seenPairs.add(key)
            cardTagRows.push({ card_template_id: cardTemplateId, tag_id: tagId })
            cardTagCount++
          }
        }
      }
      
      // V8.4: Defensive check - ensure tagNames exists and is an array
      // V11.6: Use cardsToCreate (filtered for duplicates)
      const cardTags = Array.isArray(cardsToCreate[i].tagNames) ? cardsToCreate[i].tagNames : []
      
      // Link AI-generated tags
      for (const tagName of cardTags) {
        const tagId = tagNameToId.get(tagName.trim().toLowerCase())
        if (tagId) {
          const key = `${cardTemplateId}:${tagId}`
          if (!seenPairs.has(key)) {
            seenPairs.add(key)
            cardTagRows.push({ card_template_id: cardTemplateId, tag_id: tagId })
            cardTagCount++
          }
        } else {
          logger.warn('bulkCreateMCQV2.tagNotFound', `Tag "${tagName}" not found in tagNameToId map`)
        }
      }
      
    }

    if (cardTagRows.length > 0) {
      const { error: tagLinkError } = await supabase.from('card_template_tags').insert(cardTagRows)
      if (tagLinkError) {
        logger.error('bulkCreateMCQV2.insertCardTemplateTags', tagLinkError)
      }
    }
    
    // Step 5: Create user_card_progress for author
    const defaults = getCardDefaults()
    const progressRows = insertedTemplates.map((ct) => ({
      user_id: user.id,
      card_template_id: ct.id,
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
      repetitions: 0,
      suspended: false,
    }))
    
    await supabase.from('user_card_progress').insert(progressRows)
    
    revalidatePath(`/decks/${deckTemplateId}`)
    
    // V11.6: Include skippedCount in result
    return { ok: true, createdCount: insertedTemplates.length, skippedCount, deckId: deckTemplateId }
  } catch (error) {
    logger.error('bulkCreateMCQV2', error)
    return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
  }
}

/**
 * V8.0: Legacy bulkCreateMCQ redirects to V2
 * @deprecated Use bulkCreateMCQV2 directly
 */
export async function bulkCreateMCQ(input: {
  deckId: string
  sessionTags?: string[]
  cards: Array<{
    stem: string
    options: string[]
    correctIndex: number
    explanation?: string
    tagNames: string[]
  }>
}): Promise<BulkCreateResult> {
  // V8.0: Redirect to V2 - deckId is now treated as deckTemplateId
  return bulkCreateMCQV2({
    deckTemplateId: input.deckId,
    sessionTags: input.sessionTags,
    cards: input.cards,
  })
}


// ============================================
// V11.6: Drafts Workspace Server Actions
// ============================================

import type { DraftCardSummary, ActionResultV2 } from '@/types/actions'

/**
 * V11.6: Get all draft cards for a deck
 * Returns drafts ordered by question_number ASC NULLS LAST, then created_at ASC, then id ASC
 * 
 * @param deckId - The deck template ID
 * @returns ActionResultV2 with drafts array
 * 
 * **Feature: v11.6-bulk-import-reliability**
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
 */
export async function getDeckDrafts(
  deckId: string
): Promise<ActionResultV2<{ deckId: string; deckTitle: string; drafts: DraftCardSummary[] }>> {
  return withUser(async ({ user, supabase }) => {
    // Verify deck exists and user is author
    const { data: deck, error: deckError } = await supabase
      .from('deck_templates')
      .select('id, title, author_id')
      .eq('id', deckId)
      .single()

    if (deckError || !deck) {
      return { ok: false, error: 'Deck not found' }
    }

    if (deck.author_id !== user.id) {
      return { ok: false, error: 'UNAUTHORIZED' }
    }

    // Fetch drafts with tags
    // Order: question_number ASC NULLS LAST, created_at ASC, id ASC
    const { data: drafts, error: draftsError } = await supabase
      .from('card_templates')
      .select(`
        id,
        question_number,
        stem,
        import_session_id,
        created_at,
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
      .eq('status', 'draft')
      .order('question_number', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (draftsError) {
      logger.error('getDeckDrafts', draftsError)
      return { ok: false, error: 'Failed to fetch drafts' }
    }

    // Transform to DraftCardSummary format
    const draftSummaries: DraftCardSummary[] = (drafts || []).map((draft) => {
      // Extract tags from nested join structure
      const tags: Array<{ id: string; name: string; color: string; category: string }> = []
      if (draft.card_template_tags) {
        for (const ctt of draft.card_template_tags) {
          if (ctt.tags && typeof ctt.tags === 'object' && !Array.isArray(ctt.tags)) {
            const t = ctt.tags as { id: string; name: string; color: string; category: string }
            tags.push({ id: t.id, name: t.name, color: t.color, category: t.category })
          }
        }
      }
      return {
        id: draft.id,
        questionNumber: draft.question_number,
        stem: draft.stem,
        importSessionId: draft.import_session_id,
        createdAt: draft.created_at,
        tags,
      }
    })

    return {
      ok: true,
      data: {
        deckId: deck.id,
        deckTitle: deck.title,
        drafts: draftSummaries,
      },
    }
  }) as Promise<ActionResultV2<{ deckId: string; deckTitle: string; drafts: DraftCardSummary[] }>>
}

/**
 * V11.6: Bulk publish selected draft cards
 * Transitions all selected cards from 'draft' to 'published' status
 * 
 * @param cardIds - Array of card template IDs to publish
 * @returns ActionResultV2 with updated count
 * 
 * **Feature: v11.6-bulk-import-reliability**
 * **Validates: Requirements 3.1**
 */
export async function bulkPublishDrafts(
  cardIds: string[]
): Promise<ActionResultV2<{ updatedCount: number }>> {
  if (cardIds.length === 0) {
    return { ok: true, data: { updatedCount: 0 } }
  }

  return withUser(async ({ user, supabase }) => {
    // Verify user owns all cards (is author)
    const { data: cards, error: fetchError } = await supabase
      .from('card_templates')
      .select('id, author_id, deck_template_id')
      .in('id', cardIds)

    if (fetchError) {
      logger.error('bulkPublishDrafts.fetchCards', fetchError)
      return { ok: false, error: 'Failed to fetch cards' }
    }

    if (!cards || cards.length !== cardIds.length) {
      return { ok: false, error: 'Some cards not found' }
    }

    // Check all cards belong to user
    const unauthorized = cards.some((c) => c.author_id !== user.id)
    if (unauthorized) {
      return { ok: false, error: 'UNAUTHORIZED' }
    }

    // Update status to published
    const { error: updateError, count } = await supabase
      .from('card_templates')
      .update({ status: 'published' })
      .in('id', cardIds)
      .eq('author_id', user.id) // Extra safety

    if (updateError) {
      logger.error('bulkPublishDrafts.updateCards', updateError)
      return { ok: false, error: 'Failed to publish cards' }
    }

    // Revalidate deck pages
    const deckIds = [...new Set(cards.map((c) => c.deck_template_id))]
    for (const deckId of deckIds) {
      revalidatePath(`/decks/${deckId}`)
    }

    return { ok: true, data: { updatedCount: count || cardIds.length } }
  }, RATE_LIMITS.bulk) as Promise<ActionResultV2<{ updatedCount: number }>>
}

/**
 * V11.6: Bulk archive selected draft cards
 * Transitions all selected cards from 'draft' to 'archived' status
 * 
 * @param cardIds - Array of card template IDs to archive
 * @returns ActionResultV2 with updated count
 * 
 * **Feature: v11.6-bulk-import-reliability**
 * **Validates: Requirements 3.2**
 */
export async function bulkArchiveDrafts(
  cardIds: string[]
): Promise<ActionResultV2<{ updatedCount: number }>> {
  if (cardIds.length === 0) {
    return { ok: true, data: { updatedCount: 0 } }
  }

  return withUser(async ({ user, supabase }) => {
    // Verify user owns all cards (is author)
    const { data: cards, error: fetchError } = await supabase
      .from('card_templates')
      .select('id, author_id, deck_template_id')
      .in('id', cardIds)

    if (fetchError) {
      logger.error('bulkArchiveDrafts.fetchCards', fetchError)
      return { ok: false, error: 'Failed to fetch cards' }
    }

    if (!cards || cards.length !== cardIds.length) {
      return { ok: false, error: 'Some cards not found' }
    }

    // Check all cards belong to user
    const unauthorized = cards.some((c) => c.author_id !== user.id)
    if (unauthorized) {
      return { ok: false, error: 'UNAUTHORIZED' }
    }

    // Update status to archived
    const { error: updateError, count } = await supabase
      .from('card_templates')
      .update({ status: 'archived' })
      .in('id', cardIds)
      .eq('author_id', user.id) // Extra safety

    if (updateError) {
      logger.error('bulkArchiveDrafts.updateCards', updateError)
      return { ok: false, error: 'Failed to archive cards' }
    }

    // Revalidate deck pages
    const deckIds = [...new Set(cards.map((c) => c.deck_template_id))]
    for (const deckId of deckIds) {
      revalidatePath(`/decks/${deckId}`)
    }

    return { ok: true, data: { updatedCount: count || cardIds.length } }
  }, RATE_LIMITS.bulk) as Promise<ActionResultV2<{ updatedCount: number }>>
}
