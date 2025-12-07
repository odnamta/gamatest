'use server'

import { revalidatePath } from 'next/cache'
import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE, MCQ_MAX_TOKENS } from '@/lib/ai-config'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { getCardDefaults } from '@/lib/card-defaults'
import {
  draftBatchInputSchema,
  mcqBatchItemSchema,
  type DraftBatchInput,
  type DraftBatchResult,
  type BulkCreateResult,
  type MCQBatchItem,
  type AIMode,
} from '@/lib/batch-mcq-schema'

/**
 * V6.1 Data Integrity Rules - shared across all modes
 */
const DATA_INTEGRITY_RULES = `
CRITICAL DATA INTEGRITY RULES:
1. UNITS: Maintain ALL original units (imperial or metric) EXACTLY as found in the source text.
   - Do NOT convert lb to kg, inches to cm, or any other unit conversions.
   - Do NOT round numbers. If the source says "142 lb", use "142 lb" not "64 kg".
2. NO HALLUCINATION: Never invent, infer, or guess new clinical numbers.
   - If a value is missing in the source text, leave it missing in the question.
   - Do NOT add vital signs, lab values, or measurements not present in the source.
3. VERBATIM EXTRACTION: Extract clinical data verbatim from the source material.
   - Do NOT "improve" or rephrase clinical data.
   - Preserve exact wording for medical terminology and values.`

const VISION_PRIORITY_INSTRUCTION = `
IF an image is provided, treat it as primary. The text may just be background.
Prefer questions that clearly come from the image.
If NO question is visible, say so instead of inventing one.`

const FIGURE_SAFETY_INSTRUCTION = `
FIGURE REFERENCE RULE:
If the text references a Figure (e.g., "Figure 19-1", "See diagram", "as shown below") but NO image is provided in this request, DO NOT create questions that require seeing that figure. Only create questions answerable from the text alone.`

/**
 * V9.1: Default subject for backward compatibility
 */
const DEFAULT_SUBJECT = 'Obstetrics & Gynecology'

/**
 * V9/V9.1: Build system prompt with Golden List topics and dynamic subject
 */
function buildBatchExtractPrompt(goldenTopics: string[], subject: string = DEFAULT_SUBJECT): string {
  const topicList = goldenTopics.length > 0 
    ? goldenTopics.join(', ')
    : 'Anatomy, Endocrinology, Infections, Oncology, MaternalFetal, Obstetrics, Gynecology'
  
  return `You are a medical board exam expert specializing in ${subject}.
Your task is to EXTRACT existing multiple-choice questions from the provided text.

Return a JSON object with a "questions" array containing ALL MCQs found.
Each MCQ must have:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices (extracted verbatim)
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: The explanation from the source, or a brief teaching point if none provided
- topic: EXACTLY ONE official topic from this list: [${topicList}]
- tags: Array of 1-2 specific CONCEPT tags in PascalCase (e.g., "Preeclampsia", "GestationalDiabetes") - REQUIRED`
}

const BATCH_EXTRACT_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Your task is to EXTRACT existing multiple-choice questions from the provided text.

Return a JSON object with a "questions" array containing ALL MCQs found.
Each MCQ must have:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices (extracted verbatim)
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: The explanation from the source, or a brief teaching point if none provided
- tags: Array of 1-3 MEDICAL CONCEPT tags only (e.g., "Preeclampsia", "PelvicAnatomy") - REQUIRED

FORENSIC MODE - THOROUGHNESS REQUIREMENTS:
- Scan the ENTIRE text thoroughly for ALL multiple-choice questions
- Extract EVERY question. If there are 20 questions, return 20 objects. NO ARTIFICIAL LIMIT.
- Do NOT skip any questions - extract ALL MCQs you find
- Generate at least 1 medical concept tag per question (REQUIRED - questions without tags will be rejected)
- Preserve the original ordering of questions as they appear in the source text

EXTRACTION RULES:
- Identify any existing multiple-choice questions already present in the selected text.
- Extract the question stems and options VERBATIM (fix obvious OCR spacing only).
- Do NOT create new questions or add options that aren't clearly present in the text.
- If the text contains questions with fewer than 5 options, that's fine (2-5 options allowed).
- If no clear MCQs are found, return {"questions": []}.

COMPLEX FORMAT FLAGGING (V8.6):
- If a question has a complex format (matching questions, linked/sequential questions, tables, diagrams, or multi-part questions), add "NeedsReview" to the tags array.
- This helps users identify cards that may need manual verification.
${FIGURE_SAFETY_INSTRUCTION}
${VISION_PRIORITY_INSTRUCTION}
${DATA_INTEGRITY_RULES}

Example response format:
{
  "questions": [
    {
      "stem": "A 28-year-old G1P0 at 32 weeks presents with...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "The correct answer is C because...",
      "tags": ["PretermLabor", "Tocolytics"]
    }
  ]
}`

/**
 * V9/V9.1: Build generate prompt with Golden List topics and dynamic subject
 */
function buildBatchGeneratePrompt(goldenTopics: string[], subject: string = DEFAULT_SUBJECT): string {
  const topicList = goldenTopics.length > 0 
    ? goldenTopics.join(', ')
    : 'Anatomy, Endocrinology, Infections, Oncology, MaternalFetal, Obstetrics, Gynecology'
  
  return `You are a medical board exam expert specializing in ${subject}.
Your task is to CREATE multiple high-yield board-style MCQs from the provided textbook passage.

Return a JSON object with a "questions" array containing ALL MCQs you can generate.
Each MCQ must have:
- stem: The question text (clinical vignette or direct question, at least 10 characters)
- options: Array of 2-5 answer choices
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: Brief teaching explanation (optional but recommended)
- topic: EXACTLY ONE official topic from this list: [${topicList}]
- tags: Array of 1-2 specific CONCEPT tags in PascalCase (e.g., "Preeclampsia", "GestationalDiabetes") - REQUIRED`
}

const BATCH_GENERATE_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Your task is to CREATE multiple high-yield board-style MCQs from the provided textbook passage.

Return a JSON object with a "questions" array containing ALL MCQs you can generate.
Each MCQ must have:
- stem: The question text (clinical vignette or direct question, at least 10 characters)
- options: Array of 2-5 answer choices
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: Brief teaching explanation (optional but recommended)
- tags: Array of 1-3 MEDICAL CONCEPT tags only (e.g., "Preeclampsia", "PelvicAnatomy") - REQUIRED

FORENSIC MODE - THOROUGHNESS REQUIREMENTS:
- Scan the ENTIRE text thoroughly for ALL testable concepts
- Generate ALL distinct MCQs covering different key concepts from the passage. NO ARTIFICIAL LIMIT.
- If there are 20 testable concepts, return 20 objects.
- Generate at least 1 medical concept tag per question (REQUIRED - questions without tags will be rejected)
- Ensure questions are ordered logically based on the flow of the source material

GENERATION RULES:
- Read the textbook-like passage carefully.
- Create up to 5 distinct high-yield board-style MCQs that test key concepts from this passage.
- All clinical facts, thresholds, and units used in questions and answer options MUST come from the passage.
- Never invent new numbers or units not present in the source.
- Write at board exam difficulty level.
- If the text doesn't contain enough content for MCQs, return {"questions": []}.

COMPLEX FORMAT FLAGGING (V8.6):
- If a question has a complex format (matching questions, linked/sequential questions, tables, diagrams, or multi-part questions), add "NeedsReview" to the tags array.
- This helps users identify cards that may need manual verification.
${FIGURE_SAFETY_INSTRUCTION}
${VISION_PRIORITY_INSTRUCTION}
${DATA_INTEGRITY_RULES}

Example response format:
{
  "questions": [
    {
      "stem": "A 28-year-old G1P0 at 32 weeks presents with...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "The correct answer is C because...",
      "tags": ["PretermLabor", "Tocolytics"]
    }
  ]
}`

/**
 * V9/V9.1: Get system prompt with optional Golden List topics and dynamic subject
 */
function getBatchSystemPrompt(mode: AIMode = 'extract', goldenTopics: string[] = [], subject?: string): string {
  // V9.1: Normalize subject - use default if null, empty, or whitespace only
  const normalizedSubject = subject?.trim() || DEFAULT_SUBJECT
  
  if (goldenTopics.length > 0) {
    // V9: Use topic-aware prompts when Golden List is available
    return mode === 'generate' 
      ? buildBatchGeneratePrompt(goldenTopics, normalizedSubject) 
      : buildBatchExtractPrompt(goldenTopics, normalizedSubject)
  }
  // V9.1: Fallback to dynamic prompts with subject (no legacy hardcoded prompts)
  return mode === 'generate' 
    ? buildBatchGeneratePrompt([], normalizedSubject) 
    : buildBatchExtractPrompt([], normalizedSubject)
}

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

function buildMessageContent(
  text: string,
  imageBase64?: string,
  imageUrl?: string
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  if (!imageBase64 && !imageUrl) return text
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text },
  ]
  if (imageUrl) {
    content.push({ type: 'image_url', image_url: { url: imageUrl } })
  } else if (imageBase64) {
    content.push({ type: 'image_url', image_url: { url: imageBase64 } })
  }
  return content
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
  
  // V9.1: Log subject for debugging
  if (subject) {
    console.log('[draftBatchMCQFromText] V9.1: Using subject:', subject)
  }
  
  // V9: Fetch Golden List topics for AI classification
  let goldenTopics: string[] = []
  try {
    const user = await getUser()
    if (user) {
      const supabase = await createSupabaseServerClient()
      const { data: topics } = await supabase
        .from('tags')
        .select('name')
        .eq('user_id', user.id)
        .eq('category', 'topic')
        .order('name')
      goldenTopics = topics?.map(t => t.name) || []
      console.log(`[draftBatchMCQFromText] V9: Loaded ${goldenTopics.length} Golden List topics`)
    }
  } catch (e) {
    console.warn('[draftBatchMCQFromText] V9: Failed to load Golden List, using defaults')
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
        // V8.5: Log validation failures for debugging
        console.log(`[draftBatchMCQFromText] Filtered question with invalid data:`, itemResult.error.issues.map(i => i.message).join(', '))
      }
    }
    
    // V8.5: Log summary of filtered questions
    if (filteredCount > 0) {
      console.log(`[draftBatchMCQFromText] Filtered ${filteredCount} questions with invalid tags or data`)
    }
    
    return { ok: true, drafts: validDrafts }
  } catch (error) {
    console.error('OpenAI API error:', error)
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
  } = input
  
  // V11: Log structured content context if provided
  if (bookSourceId || chapterId || matchingGroupId || matchingBlockData) {
    console.log('[bulkCreateMCQV2] V11: Structured content context:', {
      bookSourceId,
      chapterId,
      matchingGroupId,
      hasMatchingBlockData: !!matchingBlockData,
    })
  }
  
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }
  
  const supabase = await createSupabaseServerClient()
  
  // V8.0: Direct deck_template lookup - NO FALLBACK
  const { data: deckTemplate, error: deckError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckTemplateId)
    .single()
  
  if (deckError || !deckTemplate) {
    // V8.0: No legacy fallback - return error immediately
    return { ok: false, error: { message: `Deck not found in V2 schema: ${deckTemplateId}`, code: 'NOT_FOUND' } }
  }

  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: { message: 'Only the author can add cards', code: 'UNAUTHORIZED' } }
  }
  
  try {
    // V11: Step 0 - Create matching_group if matchingBlockData is provided
    // This creates the group first so we can link all cards to it
    let effectiveMatchingGroupId = matchingGroupId || null
    
    if (matchingBlockData && matchingBlockData.commonOptions.length >= 2) {
      console.log('[bulkCreateMCQV2] V11: Creating matching_group for block with', 
        matchingBlockData.commonOptions.length, 'options')
      
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
        console.error('[bulkCreateMCQV2] V11: Failed to create matching_group:', groupError)
        // Non-fatal: continue without matching group linking
      } else if (newGroup) {
        effectiveMatchingGroupId = newGroup.id
        console.log('[bulkCreateMCQV2] V11: Created matching_group:', effectiveMatchingGroupId)
      }
    }
    
    // Step 1: Collect all unique tag names
    // V8.4: Added defensive checks and logging for tag persistence
    const allTagNames = new Set<string>()
    for (const tagName of sessionTags) {
      const trimmed = tagName.trim()
      if (trimmed) allTagNames.add(trimmed)
    }
    for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
      const card = cards[cardIdx]
      // V8.4: Defensive check - ensure tagNames exists and is an array
      const cardTags = Array.isArray(card.tagNames) ? card.tagNames : []
      console.log(`[bulkCreateMCQV2] Card ${cardIdx}: ${cardTags.length} AI tags received`)
      
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
    
    console.log(`[bulkCreateMCQV2] Total unique tags to resolve: ${allTagNames.size}`, Array.from(allTagNames))
    
    // V9: Fetch Golden List topics to determine category for new tags
    const { data: goldenTopics } = await supabase
      .from('tags')
      .select('name')
      .eq('user_id', user.id)
      .eq('category', 'topic')
    const goldenTopicNames = new Set((goldenTopics || []).map(t => t.name.toLowerCase()))
    
    // Step 2: Resolve tag names to IDs
    // V9: Assign correct category based on Golden List
    const tagNameToId = new Map<string, string>()
    for (const tagName of allTagNames) {
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('name', tagName)
        .single()
      
      if (existingTag) {
        tagNameToId.set(tagName.toLowerCase(), existingTag.id)
        continue
      }
      
      // V9: Determine category - if matches Golden List topic, use 'topic', else 'concept'
      const isGoldenTopic = goldenTopicNames.has(tagName.toLowerCase())
      const category = isGoldenTopic ? 'topic' : 'concept'
      const color = isGoldenTopic ? 'purple' : 'green'
      
      const { data: newTag, error: createTagError } = await supabase
        .from('tags')
        .insert({ user_id: user.id, name: tagName, color, category })
        .select('id, name')
        .single()
      
      if (createTagError?.code === '23505') {
        const { data: raceTag } = await supabase
          .from('tags')
          .select('id, name')
          .eq('user_id', user.id)
          .ilike('name', tagName)
          .single()
        if (raceTag) tagNameToId.set(tagName.toLowerCase(), raceTag.id)
      } else if (newTag) {
        tagNameToId.set(newTag.name.toLowerCase(), newTag.id)
      }
    }
    
    // Step 3: Insert card_templates
    // V11: Include structured content foreign keys if provided
    // V11.5: Use effectiveMatchingGroupId which may be auto-created from matchingBlockData
    const cardTemplateRows = cards.map((card) => ({
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
    
    console.log(`[bulkCreateMCQV2] Resolved ${tagNameToId.size} unique tags to IDs`)
    
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
      const cardTags = Array.isArray(cards[i].tagNames) ? cards[i].tagNames : []
      
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
          console.warn(`[bulkCreateMCQV2] Tag "${tagName}" not found in tagNameToId map`)
        }
      }
      
      console.log(`[bulkCreateMCQV2] Card ${i} (${cardTemplateId}): linking ${cardTagCount} tags`)
    }
    
    console.log(`[bulkCreateMCQV2] Inserting ${cardTagRows.length} card-tag links`)
    
    if (cardTagRows.length > 0) {
      const { error: tagLinkError } = await supabase.from('card_template_tags').insert(cardTagRows)
      if (tagLinkError) {
        console.error('[bulkCreateMCQV2] Failed to insert card_template_tags:', tagLinkError)
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
    
    return { ok: true, createdCount: insertedTemplates.length, deckId: deckTemplateId }
  } catch (error) {
    console.error('Bulk create V2 error:', error)
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
