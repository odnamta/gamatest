'use server'

import { revalidatePath } from 'next/cache'
import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE } from '@/lib/ai-config'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { getCardDefaults } from '@/lib/card-defaults'
import type { CardTemplate } from '@/types/database'
import {
  draftBatchInputSchema,
  mcqBatchItemSchema,
  bulkCreateInputSchema,
  type DraftBatchInput,
  type DraftBatchResult,
  type BulkCreateInput,
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

/**
 * V6.6: Vision priority instruction - when image is provided
 */
const VISION_PRIORITY_INSTRUCTION = `
IF an image is provided, treat it as primary. The text may just be background.
Prefer questions that clearly come from the image.
If NO question is visible, say so instead of inventing one.`

/**
 * System prompt for EXTRACT mode (Q&A sources) - batch version.
 * V6.2: Extracts existing MCQs verbatim from Q&A text.
 * V6.6: Added Vision priority instruction
 */
const BATCH_EXTRACT_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Your task is to EXTRACT existing multiple-choice questions from the provided text.

Return a JSON object with a "questions" array containing up to 5 MCQs.
Each MCQ must have:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices (extracted verbatim)
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: The explanation from the source, or a brief teaching point if none provided
- tags: Array of 1-3 MEDICAL CONCEPT tags only (e.g., "Preeclampsia", "PelvicAnatomy")

EXTRACTION RULES:
- Identify any existing multiple-choice questions already present in the selected text.
- Extract the question stems and options VERBATIM (fix obvious OCR spacing only).
- Do NOT create new questions or add options that aren't clearly present in the text.
- If the text contains questions with fewer than 5 options, that's fine (2-5 options allowed).
- If no clear MCQs are found, return {"questions": []}.
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
 * System prompt for GENERATE mode (Textbook sources) - batch version.
 * V6.2: Creates new MCQs from textbook content.
 */
const BATCH_GENERATE_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Your task is to CREATE multiple high-yield board-style MCQs from the provided textbook passage.

Return a JSON object with a "questions" array containing up to 5 MCQs.
Each MCQ must have:
- stem: The question text (clinical vignette or direct question, at least 10 characters)
- options: Array of 2-5 answer choices
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: Brief teaching explanation (optional but recommended)
- tags: Array of 1-3 MEDICAL CONCEPT tags only (e.g., "Preeclampsia", "PelvicAnatomy")
  - Format: Use PascalCase without spaces (e.g., GestationalDiabetes, PregnancyInducedHypertension)
  - Do NOT generate structural tags (e.g., Chapter1, Lange, Section2) - these are handled separately

GENERATION RULES:
- Read the textbook-like passage carefully.
- Create up to 5 distinct high-yield board-style MCQs that test key concepts from this passage.
- All clinical facts, thresholds, and units used in questions and answer options MUST come from the passage.
- Never invent new numbers or units not present in the source.
- Invent plausible distractors (wrong answers), but they must be conceptually related to the passage.
- Distractors must not contradict medical facts stated in the passage.
- Write at board exam difficulty level.
- If the text doesn't contain enough content for MCQs, return {"questions": []}.
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
 * Get the appropriate system prompt based on mode.
 */
function getBatchSystemPrompt(mode: AIMode = 'extract'): string {
  switch (mode) {
    case 'extract':
      return BATCH_EXTRACT_SYSTEM_PROMPT
    case 'generate':
      return BATCH_GENERATE_SYSTEM_PROMPT
    default:
      return BATCH_EXTRACT_SYSTEM_PROMPT
  }
}

/**
 * Build user prompt with source text and optional context.
 */
function buildBatchUserPrompt(text: string, defaultTags?: string[], mode: AIMode = 'extract'): string {
  let prompt = `Source text:\n${text}`
  
  if (defaultTags && defaultTags.length > 0) {
    prompt += `\n\nContext tags (for reference): ${defaultTags.join(', ')}`
  }
  
  if (mode === 'extract') {
    prompt += '\n\nExtract up to 5 existing MCQs from this content. Return JSON with "questions" array.'
  } else {
    prompt += '\n\nGenerate up to 5 distinct MCQs from this content. Return JSON with "questions" array.'
  }
  
  return prompt
}

/**
 * Build OpenAI message content with optional image.
 * V6.2: Vision MVP support
 */
function buildMessageContent(
  text: string,
  imageBase64?: string,
  imageUrl?: string
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  // If no image, return plain text
  if (!imageBase64 && !imageUrl) {
    return text
  }

  // Build multimodal content
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
 * 
 * @param input - Source text, deck ID, optional default tags, mode, and image
 * @returns DraftBatchResult - Either { ok: true, drafts } or { ok: false, error }
 * 
 * Requirements: R1.1, R1.2, NFR-2, V6.2 Brain Toggle, V6.2 Vision MVP
 */
export async function draftBatchMCQFromText(input: DraftBatchInput): Promise<DraftBatchResult> {
  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn('draftBatchMCQFromText: missing OPENAI_API_KEY')
    return { ok: false, error: { message: 'AI is not configured', code: 'NOT_CONFIGURED' } }
  }

  // Validate input with Zod schema (R1.2, NFR-2)
  const validationResult = draftBatchInputSchema.safeParse(input)
  
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]
    return { 
      ok: false, 
      error: { 
        message: firstError?.message || 'Invalid input', 
        code: 'VALIDATION_ERROR' 
      } 
    }
  }
  
  const { text, defaultTags, mode = 'extract', imageBase64, imageUrl } = validationResult.data
  
  // V6.6: Debug logging for image presence
  if (imageBase64 || imageUrl) {
    console.log('[draftBatchMCQFromText] Image provided:', {
      hasBase64: !!imageBase64,
      base64Length: imageBase64?.length || 0,
      hasUrl: !!imageUrl,
    })
  }
  
  try {
    // Build message content (with optional image for Vision MVP)
    const userContent = buildMessageContent(
      buildBatchUserPrompt(text, defaultTags, mode),
      imageBase64,
      imageUrl
    )

    // Call OpenAI API with JSON mode (R1.2)
    const response = await openai.chat.completions.create({
      model: MCQ_MODEL,
      temperature: MCQ_TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getBatchSystemPrompt(mode) },
        { role: 'user', content: userContent as string },
      ],
    })
    
    // Extract content from response
    const content = response.choices[0]?.message?.content
    
    if (!content) {
      console.error('OpenAI returned empty content')
      return { ok: false, error: { message: 'AI returned empty response', code: 'OPENAI_ERROR' } }
    }
    
    // Parse JSON response
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Failed to parse OpenAI response as JSON:', content)
      return { ok: false, error: { message: 'Invalid AI response format', code: 'PARSE_ERROR' } }
    }
    
    // Extract questions array from response
    const questionsArray = (parsed as { questions?: unknown })?.questions
    
    if (!Array.isArray(questionsArray)) {
      // If no questions array, return empty (not an error per R1.2)
      return { ok: true, drafts: [] }
    }
    
    // Validate each item and cap at 5 (Property 5)
    const validDrafts: MCQBatchItem[] = []
    for (const item of questionsArray.slice(0, 5)) {
      const itemResult = mcqBatchItemSchema.safeParse(item)
      if (itemResult.success) {
        validDrafts.push(itemResult.data)
      }
      // Skip invalid items silently
    }
    
    // Return validated drafts (Property 3: bounded 0-5)
    return { ok: true, drafts: validDrafts }
    
  } catch (error) {
    // Handle API errors (network, auth, rate limits, etc.)
    console.error('OpenAI API error:', error)
    return { ok: false, error: { message: 'AI service unavailable', code: 'OPENAI_ERROR' } }
  }
}


/**
 * Server Action: Create multiple MCQ cards atomically.
 * 
 * @param input - Deck ID, sessionTags, and array of cards with merged tags
 * @returns BulkCreateResult - Either { ok: true, createdCount, deckId } or { ok: false, error }
 * 
 * Requirements: R1.4, R1.5, NFR-2, V6.1 Atomic Tag Merging
 */
export async function bulkCreateMCQ(input: BulkCreateInput): Promise<BulkCreateResult> {
  // Validate input with Zod schema
  const validationResult = bulkCreateInputSchema.safeParse(input)
  
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0]
    return { 
      ok: false, 
      error: { 
        message: firstError?.message || 'Invalid input', 
        code: 'VALIDATION_ERROR' 
      } 
    }
  }
  
  const { deckId, sessionTags = [], cards } = validationResult.data
  
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }
  
  const supabase = await createSupabaseServerClient()
  
  // Verify user owns the deck (R1.4)
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', user.id)
    .single()
  
  if (deckError || !deck) {
    return { ok: false, error: { message: 'Deck not found or access denied', code: 'UNAUTHORIZED' } }
  }
  
  try {
    // Step 1: Collect all unique tag names (session + per-card AI tags)
    // V6.1: Merge session tags with per-card tags using case-insensitive deduplication
    const allTagNames = new Set<string>()
    
    // Add session tags first (they take precedence)
    for (const tagName of sessionTags) {
      const trimmed = tagName.trim()
      if (trimmed) {
        allTagNames.add(trimmed)
      }
    }
    
    // Add per-card AI tags
    for (const card of cards) {
      for (const tagName of card.tagNames) {
        const trimmed = tagName.trim()
        if (trimmed) {
          // Case-insensitive check: only add if not already present
          const lowerTrimmed = trimmed.toLowerCase()
          const alreadyExists = Array.from(allTagNames).some(
            existing => existing.toLowerCase() === lowerTrimmed
          )
          if (!alreadyExists) {
            allTagNames.add(trimmed)
          }
        }
      }
    }
    
    // Step 2: Resolve tag names to IDs using atomic upsert
    // V6.1: Use case-insensitive matching with atomic operations
    const tagNameToId = new Map<string, string>()
    
    for (const tagName of allTagNames) {
      // First, try to find existing tag (case-insensitive)
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
      
      // Tag doesn't exist, create it atomically
      // The unique index on (user_id, LOWER(name)) prevents race condition duplicates
      const { data: newTag, error: createTagError } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: tagName,
          color: 'purple', // V6.1: Purple for AI-generated concept tags
        })
        .select('id, name')
        .single()
      
      if (createTagError) {
        // Handle race condition: another request created the tag
        if (createTagError.code === '23505') { // Unique violation
          const { data: raceTag } = await supabase
            .from('tags')
            .select('id, name')
            .eq('user_id', user.id)
            .ilike('name', tagName)
            .single()
          
          if (raceTag) {
            tagNameToId.set(tagName.toLowerCase(), raceTag.id)
          }
        } else {
          console.error('Failed to create tag:', tagName, createTagError)
        }
      } else if (newTag) {
        tagNameToId.set(newTag.name.toLowerCase(), newTag.id)
      }
    }
    
    // Step 3: Prepare card rows with SM-2 defaults
    const defaults = getCardDefaults()
    const cardRows = cards.map((card) => ({
      deck_id: deckId,
      card_type: 'mcq' as const,
      front: '',
      back: '',
      stem: card.stem,
      options: card.options,
      correct_index: card.correctIndex,
      explanation: card.explanation || null,
      image_url: null,
      interval: defaults.interval,
      ease_factor: defaults.ease_factor,
      next_review: defaults.next_review.toISOString(),
    }))
    
    // Step 4: Insert all cards atomically (Property 11)
    const { data: insertedCards, error: insertError } = await supabase
      .from('cards')
      .insert(cardRows)
      .select('id')
    
    if (insertError || !insertedCards) {
      console.error('Failed to insert cards:', insertError)
      return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
    }
    
    // Step 5: Insert card_tags join rows
    // V6.1: Each card gets session tags + its own AI tags (deduplicated)
    const cardTagRows: { card_id: string; tag_id: string }[] = []
    const seenCardTagPairs = new Set<string>()
    
    for (let i = 0; i < insertedCards.length; i++) {
      const cardId = insertedCards[i].id
      
      // Add session tags first
      for (const tagName of sessionTags) {
        const normalized = tagName.trim().toLowerCase()
        const tagId = tagNameToId.get(normalized)
        if (tagId) {
          const pairKey = `${cardId}:${tagId}`
          if (!seenCardTagPairs.has(pairKey)) {
            seenCardTagPairs.add(pairKey)
            cardTagRows.push({ card_id: cardId, tag_id: tagId })
          }
        }
      }
      
      // Add per-card AI tags
      for (const tagName of cards[i].tagNames) {
        const normalized = tagName.trim().toLowerCase()
        const tagId = tagNameToId.get(normalized)
        if (tagId) {
          const pairKey = `${cardId}:${tagId}`
          if (!seenCardTagPairs.has(pairKey)) {
            seenCardTagPairs.add(pairKey)
            cardTagRows.push({ card_id: cardId, tag_id: tagId })
          }
        }
      }
    }
    
    if (cardTagRows.length > 0) {
      const { error: tagInsertError } = await supabase
        .from('card_tags')
        .insert(cardTagRows)
      
      if (tagInsertError) {
        console.error('Failed to insert card_tags:', tagInsertError)
        // Note: Cards are already created, but tags failed
        // In a real transaction this would rollback, but Supabase doesn't support that easily
        // For now, we still return success since cards were created
      }
    }
    
    // Revalidate deck page
    revalidatePath(`/decks/${deckId}`)
    
    return { ok: true, createdCount: insertedCards.length, deckId }
    
  } catch (error) {
    console.error('Bulk create error:', error)
    return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
  }
}


// ============================================
// V6.4: Shared Library V2 Functions
// ============================================

// Feature flag for V2 schema
const USE_V2_SCHEMA = true

/**
 * V6.4 Input type for bulk create with deck_template_id
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
  }>
}

/**
 * Server Action: Create multiple MCQ card_templates atomically.
 * V6.4: Creates card_templates instead of cards, auto-creates user_card_progress.
 * 
 * @param input - Deck template ID, sessionTags, and array of cards with merged tags
 * @returns BulkCreateResult - Either { ok: true, createdCount, deckId } or { ok: false, error }
 */
export async function bulkCreateMCQV2(input: BulkCreateV2Input): Promise<BulkCreateResult> {
  // V7.1: Instrumentation for debugging Auto-Scan wiring
  console.log('[bulkCreateMCQV2] Called with:', {
    deckTemplateId: input.deckTemplateId,
    sessionTags: input.sessionTags?.length ?? 0,
    cardsCount: input.cards?.length ?? 0,
  })

  if (!USE_V2_SCHEMA) {
    // Fall back to V1 with deckId
    return bulkCreateMCQ({
      deckId: input.deckTemplateId,
      sessionTags: input.sessionTags || [],
      cards: input.cards,
    })
  }

  const { deckTemplateId, sessionTags = [], cards } = input
  
  // Get authenticated user
  const user = await getUser()
  if (!user) {
    return { ok: false, error: { message: 'Authentication required', code: 'UNAUTHORIZED' } }
  }
  
  const supabase = await createSupabaseServerClient()
  
  // Verify user owns the deck_template or has it subscribed
  const { data: deckTemplate, error: deckError } = await supabase
    .from('deck_templates')
    .select('id, author_id')
    .eq('id', deckTemplateId)
    .single()
  
  if (deckError || !deckTemplate) {
    // V7.1: Include received ID in error message for debugging
    return { ok: false, error: { message: `Deck template not found for id=${deckTemplateId}`, code: 'NOT_FOUND' } }
  }

  // Only author can add cards to a deck_template
  if (deckTemplate.author_id !== user.id) {
    return { ok: false, error: { message: 'Only the author can add cards', code: 'UNAUTHORIZED' } }
  }
  
  try {
    // Step 1: Collect all unique tag names (session + per-card AI tags)
    const allTagNames = new Set<string>()
    
    for (const tagName of sessionTags) {
      const trimmed = tagName.trim()
      if (trimmed) {
        allTagNames.add(trimmed)
      }
    }
    
    for (const card of cards) {
      for (const tagName of card.tagNames) {
        const trimmed = tagName.trim()
        if (trimmed) {
          const lowerTrimmed = trimmed.toLowerCase()
          const alreadyExists = Array.from(allTagNames).some(
            existing => existing.toLowerCase() === lowerTrimmed
          )
          if (!alreadyExists) {
            allTagNames.add(trimmed)
          }
        }
      }
    }
    
    // Step 2: Resolve tag names to IDs
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
      
      const { data: newTag, error: createTagError } = await supabase
        .from('tags')
        .insert({
          user_id: user.id,
          name: tagName,
          color: 'purple',
        })
        .select('id, name')
        .single()
      
      if (createTagError) {
        if (createTagError.code === '23505') {
          const { data: raceTag } = await supabase
            .from('tags')
            .select('id, name')
            .eq('user_id', user.id)
            .ilike('name', tagName)
            .single()
          
          if (raceTag) {
            tagNameToId.set(tagName.toLowerCase(), raceTag.id)
          }
        }
      } else if (newTag) {
        tagNameToId.set(newTag.name.toLowerCase(), newTag.id)
      }
    }
    
    // Step 3: Prepare card_template rows
    const cardTemplateRows = cards.map((card) => ({
      deck_template_id: deckTemplateId,
      stem: card.stem,
      options: card.options,
      correct_index: card.correctIndex,
      explanation: card.explanation || null,
      source_meta: null,
    }))
    
    // Step 4: Insert all card_templates
    const { data: insertedTemplates, error: insertError } = await supabase
      .from('card_templates')
      .insert(cardTemplateRows)
      .select('id')
    
    if (insertError || !insertedTemplates) {
      console.error('Failed to insert card_templates:', insertError)
      return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
    }
    
    // Step 5: Insert card_template_tags join rows
    const cardTagRows: { card_template_id: string; tag_id: string }[] = []
    const seenCardTagPairs = new Set<string>()
    
    for (let i = 0; i < insertedTemplates.length; i++) {
      const cardTemplateId = insertedTemplates[i].id
      
      for (const tagName of sessionTags) {
        const normalized = tagName.trim().toLowerCase()
        const tagId = tagNameToId.get(normalized)
        if (tagId) {
          const pairKey = `${cardTemplateId}:${tagId}`
          if (!seenCardTagPairs.has(pairKey)) {
            seenCardTagPairs.add(pairKey)
            cardTagRows.push({ card_template_id: cardTemplateId, tag_id: tagId })
          }
        }
      }
      
      for (const tagName of cards[i].tagNames) {
        const normalized = tagName.trim().toLowerCase()
        const tagId = tagNameToId.get(normalized)
        if (tagId) {
          const pairKey = `${cardTemplateId}:${tagId}`
          if (!seenCardTagPairs.has(pairKey)) {
            seenCardTagPairs.add(pairKey)
            cardTagRows.push({ card_template_id: cardTemplateId, tag_id: tagId })
          }
        }
      }
    }
    
    if (cardTagRows.length > 0) {
      const { error: tagInsertError } = await supabase
        .from('card_template_tags')
        .insert(cardTagRows)
      
      if (tagInsertError) {
        console.error('Failed to insert card_template_tags:', tagInsertError)
      }
    }
    
    // Step 6: Auto-create user_card_progress for author
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
    
    const { error: progressError } = await supabase
      .from('user_card_progress')
      .insert(progressRows)
    
    if (progressError) {
      console.error('Failed to create user_card_progress:', progressError)
      // Don't fail - cards were created, progress can be created lazily
    }
    
    // Revalidate deck page
    revalidatePath(`/decks/${deckTemplateId}`)
    
    return { ok: true, createdCount: insertedTemplates.length, deckId: deckTemplateId }
    
  } catch (error) {
    console.error('Bulk create V2 error:', error)
    return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
  }
}
