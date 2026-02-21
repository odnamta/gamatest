'use server'

import { revalidatePath } from 'next/cache'
import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE, MCQ_MAX_TOKENS } from '@/lib/ai-config'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { withUser, type AuthContext } from './_helpers'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
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

/**
 * V6.1 Data Integrity Rules - shared across all modes
 */
const DATA_INTEGRITY_RULES = `
CRITICAL DATA INTEGRITY RULES:
1. UNITS: Maintain ALL original units EXACTLY as found in the source text.
   - Do NOT convert units. If the source says "142 lb", use "142 lb" not "64 kg".
   - Do NOT round numbers.
2. NO HALLUCINATION: Never invent, infer, or guess new data values.
   - If a value is missing in the source text, leave it missing in the question.
   - Do NOT add data, measurements, or values not present in the source.
3. VERBATIM EXTRACTION: Extract data verbatim from the source material.
   - Do NOT "improve" or rephrase technical data.
   - Preserve exact wording for domain-specific terminology and values.`

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
const DEFAULT_SUBJECT = 'General'

/**
 * V11.2.1: Hard ban on meta-language patterns in Extract mode
 * These patterns indicate AI is generating comprehension questions instead of copying real MCQs
 */
const EXTRACT_META_BAN = `
HARD BAN - DO NOT PRODUCE THESE PATTERNS:
- Questions about "page X", "section Y", "chapter Z"
- Questions like "What is the main topic of..."
- Questions like "What does this passage discuss..."
- Questions like "According to page X..."
- Questions about document structure, headings, or organization
- Comprehension questions about what the text "covers" or "explains"

If you cannot find real exam-style MCQs in the text, return {"questions": []} rather than inventing meta-questions.`

/**
 * V11.2.1: Positive example of properly extracted MCQ
 */
const EXTRACT_POSITIVE_EXAMPLE = `
CORRECT EXAMPLE (properly extracted exam-style MCQ):
{
  "stem": "A forklift operator notices a hydraulic leak during pre-shift inspection. What is the most appropriate next step?",
  "options": ["Continue operating until shift ends", "Tag out the forklift and report to supervisor", "Attempt to repair the leak", "Switch to a different forklift without reporting"],
  "correctIndex": 1,
  "explanation": "Equipment with safety hazards must be immediately tagged out and reported per safety guidelines.",
  "tags": ["SafetyInspection", "HeavyEquipment"]
}`

/**
 * V11.2.1: Negative example of meta-question to avoid
 */
const EXTRACT_NEGATIVE_EXAMPLE = `
WRONG EXAMPLE (meta-question - DO NOT PRODUCE):
{
  "stem": "What is the main topic discussed on page 5?",
  "options": ["Safety protocols", "Inventory management", "Customer service", "Equipment maintenance"],
  "correctIndex": 0,
  "explanation": "Page 5 covers safety protocols.",
  "tags": ["Chapter1"]
}
This is WRONG because it's a comprehension question about the document, not a real exam MCQ from the source.`

/**
 * V9/V9.1: Build system prompt with Golden List topics and dynamic subject
 * V11.2.1: Hardened prompt to prevent meta-questions - COPY ONLY, no generation
 */
function buildBatchExtractPrompt(goldenTopics: string[], subject: string = DEFAULT_SUBJECT): string {
  const topicList = goldenTopics.length > 0
    ? goldenTopics.join(', ')
    : 'General, Safety, Operations, Management, Technical, Compliance'

  return `You are an expert in ${subject} creating assessment questions.
Your task is to COPY existing exam-style multiple-choice questions from the provided text.

CRITICAL: You are in EXTRACT mode. Your job is to COPY, not CREATE.
- Only extract questions that ALREADY EXIST in the text with numbered stems (1., 2., 3.) and options (A-E or similar)
- The text likely comes from a reference book or training manual - find and copy the real MCQs
- Do NOT create new questions
- Do NOT write comprehension questions about the text itself

Return a JSON object with a "questions" array containing ALL MCQs found.
Each MCQ must have:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices (extracted verbatim)
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: The explanation from the source, or a brief teaching point if none provided
- topic: EXACTLY ONE official topic from this list: [${topicList}]
- tags: Array of 1-2 specific CONCEPT tags in PascalCase (e.g., "SafetyProtocol", "InventoryManagement") - REQUIRED
${EXTRACT_META_BAN}
${EXTRACT_POSITIVE_EXAMPLE}
${EXTRACT_NEGATIVE_EXAMPLE}`
}

const BATCH_EXTRACT_SYSTEM_PROMPT = `You are an expert assessment question extractor.
Your task is to COPY existing exam-style multiple-choice questions from the provided text.

CRITICAL: You are in EXTRACT mode. Your job is to COPY, not CREATE.
- Only extract questions that ALREADY EXIST in the text with numbered stems (1., 2., 3.) and options (A-E or similar)
- The text likely comes from a reference book or training manual - find and copy the real MCQs
- Do NOT create new questions
- Do NOT write comprehension questions about the text itself

Return a JSON object with a "questions" array containing ALL MCQs found.
Each MCQ must have:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices (extracted verbatim)
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: The explanation from the source, or a brief teaching point if none provided
- tags: Array of 1-3 CONCEPT tags only (e.g., "SafetyProtocol", "EquipmentMaintenance") - REQUIRED

FORENSIC MODE - THOROUGHNESS REQUIREMENTS:
- Scan the ENTIRE text thoroughly for ALL multiple-choice questions
- Extract EVERY question. If there are 20 questions, return 20 objects. NO ARTIFICIAL LIMIT.
- Do NOT skip any questions - extract ALL MCQs you find
- Generate at least 1 concept tag per question (REQUIRED - questions without tags will be rejected)
- Preserve the original ordering of questions as they appear in the source text

EXTRACTION RULES:
- Look for existing MCQs with numbered question stems and lettered options (A, B, C, D, E)
- Extract the question stems and options VERBATIM (fix obvious OCR spacing only)
- Do NOT create new questions or add options that aren't clearly present in the text
- If the text contains questions with fewer than 5 options, that's fine (2-5 options allowed)
- If no clear MCQs are found, return {"questions": []}

HARD BAN - DO NOT PRODUCE THESE PATTERNS:
- Questions about "page X", "section Y", "chapter Z"
- Questions like "What is the main topic of..."
- Questions like "What does this passage discuss..."
- Questions like "According to page X..."
- Questions about document structure, headings, or organization
- Comprehension questions about what the text "covers" or "explains"

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
      "stem": "When handling hazardous materials, the first step according to SOP is...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "The correct answer is C because...",
      "tags": ["HazardousMaterials", "SafetyProcedure"]
    }
  ]
}`

/**
 * V9/V9.1: Build generate prompt with Golden List topics and dynamic subject
 */
function buildBatchGeneratePrompt(goldenTopics: string[], subject: string = DEFAULT_SUBJECT): string {
  const topicList = goldenTopics.length > 0
    ? goldenTopics.join(', ')
    : 'General, Safety, Operations, Management, Technical, Compliance'

  return `You are an expert in ${subject} creating assessment questions.
Your task is to CREATE multiple high-quality assessment-style MCQs from the provided passage.

Return a JSON object with a "questions" array containing ALL MCQs you can generate.
Each MCQ must have:
- stem: The question text (scenario-based or direct question, at least 10 characters)
- options: Array of 2-5 answer choices
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: Brief teaching explanation (optional but recommended)
- topic: EXACTLY ONE official topic from this list: [${topicList}]
- tags: Array of 1-2 specific CONCEPT tags in PascalCase (e.g., "SafetyProtocol", "InventoryManagement") - REQUIRED`
}

const BATCH_GENERATE_SYSTEM_PROMPT = `You are an expert assessment question creator.
Your task is to CREATE multiple high-quality assessment-style MCQs from the provided passage.

Return a JSON object with a "questions" array containing ALL MCQs you can generate.
Each MCQ must have:
- stem: The question text (scenario-based or direct question, at least 10 characters)
- options: Array of 2-5 answer choices
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: Brief teaching explanation (optional but recommended)
- tags: Array of 1-3 CONCEPT tags only (e.g., "SafetyProtocol", "EquipmentMaintenance") - REQUIRED

FORENSIC MODE - THOROUGHNESS REQUIREMENTS:
- Scan the ENTIRE text thoroughly for ALL testable concepts
- Generate ALL distinct MCQs covering different key concepts from the passage. NO ARTIFICIAL LIMIT.
- If there are 20 testable concepts, return 20 objects.
- Generate at least 1 concept tag per question (REQUIRED - questions without tags will be rejected)
- Ensure questions are ordered logically based on the flow of the source material

GENERATION RULES:
- Read the passage carefully.
- Create up to 5 distinct high-quality assessment-style MCQs that test key concepts from this passage.
- All facts, thresholds, and values used in questions and answer options MUST come from the passage.
- Never invent new numbers or values not present in the source.
- Write at professional assessment difficulty level.
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
      "stem": "When handling hazardous materials, the first step according to SOP is...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "The correct answer is C because...",
      "tags": ["HazardousMaterials", "SafetyProcedure"]
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

  // Rate limit check (sensitive: AI batch operation)
  const user = await getUser()
  if (user) {
    const rateLimitResult = checkRateLimit(`user:${user.id}:draftBatchMCQ`, RATE_LIMITS.sensitive)
    if (!rateLimitResult.allowed) {
      return { ok: false, error: { message: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' } }
    }
  }

  // V9: Fetch Golden List topics for AI classification
  let goldenTopics: string[] = []
  try {
    if (user) {
      const supabase = await createSupabaseServerClient()
      const { data: topics } = await supabase
        .from('tags')
        .select('name')
        .eq('user_id', user.id)
        .eq('category', 'topic')
        .order('name')
      goldenTopics = topics?.map(t => t.name) || []
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
      }
    }
    
    // V12: Quality Scanner Integration (advisory only, never blocks)
    let scanResult = null
    let numQuestionsWithMissingOptions = 0
    let numQuestionsWithExtraOptions = 0
    
    try {
      // Step 1: Scan the raw text chunk
      scanResult = scanChunkForQuestionsAndOptions(text)

      // Step 2: Compare with AI drafts
      const aiDraftOptionCounts = validDrafts.map(d => d.options.length)
      scanResult = compareWithAIDrafts(scanResult, validDrafts.length, aiDraftOptionCounts)
      
      // Step 3: Count issues by type
      for (const question of scanResult.questions) {
        for (const issue of question.issues) {
          if (issue.code === 'MISSING_OPTIONS') numQuestionsWithMissingOptions++
          if (issue.code === 'EXTRA_OPTIONS') numQuestionsWithExtraOptions++
        }
      }
      
    } catch (scanError) {
      // V12: Fail soft - log and continue without quality data
      console.warn('[draftBatchMCQFromText] V12: Quality scan failed, continuing without quality data:', scanError)
    }
    
    // V12: Attach quality issues to each draft (in-memory only)
    const draftsWithQuality: MCQBatchItemWithQuality[] = validDrafts.map((draft, index) => ({
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
      aiDraftCount: validDrafts.length,
      numQuestionsWithMissingOptions,
      numQuestionsWithExtraOptions,
    }
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

  // Rate limit check (sensitive: bulk card creation)
  const rateLimitUser = await getUser()
  if (!rateLimitUser) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }
  const bulkCreateRateLimit = checkRateLimit(`user:${rateLimitUser.id}:bulkCreateMCQ`, RATE_LIMITS.sensitive)
  if (!bulkCreateRateLimit.allowed) {
    return { ok: false, error: { message: 'Rate limit exceeded. Please try again later.', code: 'RATE_LIMITED' } }
  }

  // V11.5.1: Use withUser for auth
  const authResult = await withUser(async ({ user, supabase }: AuthContext) => {
    // V8.0: Direct deck_template lookup - NO FALLBACK
    const { data: deckTemplate, error: deckError } = await supabase
      .from('deck_templates')
      .select('id, author_id')
      .eq('id', deckTemplateId)
      .single()
    
    if (deckError || !deckTemplate) {
      // V8.0: No legacy fallback - return error immediately
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
    // Pass through other errors (deck not found, not author)
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
        console.error('[bulkCreateMCQV2] V11: Failed to create matching_group:', groupError)
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
          console.warn(`[bulkCreateMCQV2] Tag "${tagName}" not found in tagNameToId map`)
        }
      }
      
    }

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
    
    // V11.6: Include skippedCount in result
    return { ok: true, createdCount: insertedTemplates.length, skippedCount, deckId: deckTemplateId }
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
      console.error('[getDeckDrafts] Error fetching drafts:', draftsError)
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
      console.error('[bulkPublishDrafts] Error fetching cards:', fetchError)
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
      console.error('[bulkPublishDrafts] Error updating cards:', updateError)
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
      console.error('[bulkArchiveDrafts] Error fetching cards:', fetchError)
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
      console.error('[bulkArchiveDrafts] Error updating cards:', updateError)
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
