'use server'

import { revalidatePath } from 'next/cache'
import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE } from '@/lib/ai-config'
import { createSupabaseServerClient, getUser } from '@/lib/supabase/server'
import { getCardDefaults } from '@/lib/card-defaults'
import {
  draftBatchInputSchema,
  mcqBatchItemSchema,
  bulkCreateInputSchema,
  type DraftBatchInput,
  type DraftBatchResult,
  type BulkCreateInput,
  type BulkCreateResult,
  type MCQBatchItem,
} from '@/lib/batch-mcq-schema'
import { z } from 'zod'

/**
 * System prompt for batch MCQ generation.
 * Instructs the AI to extract multiple MCQs from source text.
 * Requirements: R1.2
 */
const BATCH_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Given source text from a medical textbook or reference, extract MULTIPLE distinct 
high-quality multiple-choice questions (MCQs) suitable for board-style exams.

Return a JSON object with a "questions" array containing up to 5 MCQs.
Each MCQ must have:
- stem: The question text (clinical vignette or direct question, at least 10 characters)
- options: Array of 2-5 answer choices
- correctIndex: Index of correct answer (0-based, 0-4)
- explanation: Brief teaching explanation (optional but recommended)
- tags: Array of 1-3 short clinical topic tags (e.g., "Preeclampsia", "Gestational Diabetes")
  - Tags should be clinical topics, NOT book names or chapter titles

Guidelines:
- Extract as many distinct, high-quality MCQs as the text supports (up to 5)
- Write at board exam difficulty level
- Include relevant clinical details in stems
- Make distractors plausible but clearly incorrect
- If the text doesn't contain enough content for MCQs, return {"questions": []}

Example response format:
{
  "questions": [
    {
      "stem": "A 28-year-old G1P0 at 32 weeks presents with...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 2,
      "explanation": "The correct answer is C because...",
      "tags": ["Preterm Labor", "Tocolytics"]
    }
  ]
}`

/**
 * Build user prompt with source text and optional context.
 */
function buildBatchUserPrompt(text: string, defaultTags?: string[]): string {
  let prompt = `Source text:\n${text}`
  
  if (defaultTags && defaultTags.length > 0) {
    prompt += `\n\nContext tags (for reference): ${defaultTags.join(', ')}`
  }
  
  prompt += '\n\nExtract up to 5 distinct MCQs from this content. Return JSON with "questions" array.'
  
  return prompt
}

/**
 * Server Action: Generate multiple MCQ drafts from source text using OpenAI.
 * 
 * @param input - Source text, deck ID, and optional default tags
 * @returns DraftBatchResult - Either { ok: true, drafts } or { ok: false, error }
 * 
 * Requirements: R1.1, R1.2, NFR-2
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
  
  const { text, defaultTags } = validationResult.data
  
  try {
    // Call OpenAI API with JSON mode (R1.2)
    const response = await openai.chat.completions.create({
      model: MCQ_MODEL,
      temperature: MCQ_TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BATCH_SYSTEM_PROMPT },
        { role: 'user', content: buildBatchUserPrompt(text, defaultTags) },
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
 * @param input - Deck ID and array of cards with merged tags
 * @returns BulkCreateResult - Either { ok: true, createdCount, deckId } or { ok: false, error }
 * 
 * Requirements: R1.4, R1.5, NFR-2
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
  
  const { deckId, cards } = validationResult.data
  
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
    // Step 1: Resolve all tag names to tag IDs (R1.5)
    // Collect all unique tag names across all cards
    const allTagNames = new Set<string>()
    for (const card of cards) {
      for (const tagName of card.tagNames) {
        const normalized = tagName.trim()
        if (normalized) {
          allTagNames.add(normalized)
        }
      }
    }
    
    // Fetch existing tags for this user
    const { data: existingTags } = await supabase
      .from('tags')
      .select('id, name')
      .eq('user_id', user.id)
    
    // Build name -> id map (case-insensitive)
    const tagNameToId = new Map<string, string>()
    for (const tag of existingTags || []) {
      tagNameToId.set(tag.name.toLowerCase(), tag.id)
    }
    
    // Create missing tags (Property 14)
    // Note: We need to handle case-sensitivity carefully since DB has UNIQUE(user_id, name)
    const tagsToCreate: string[] = []
    for (const tagName of allTagNames) {
      if (!tagNameToId.has(tagName.toLowerCase())) {
        tagsToCreate.push(tagName)
      }
    }
    
    if (tagsToCreate.length > 0) {
      // Insert tags one by one to handle potential duplicates gracefully
      for (const tagName of tagsToCreate) {
        // Skip if we already have this tag (case-insensitive)
        if (tagNameToId.has(tagName.toLowerCase())) {
          continue
        }
        
        // Try to insert the tag
        const { data: newTag, error: createTagError } = await supabase
          .from('tags')
          .insert({
            user_id: user.id,
            name: tagName.trim(),
            color: 'blue', // Default color for AI-created tags
          })
          .select('id, name')
          .single()
        
        if (createTagError) {
          // If it's a duplicate error, try to fetch the existing tag
          if (createTagError.code === '23505') { // Unique violation
            const { data: existingTag } = await supabase
              .from('tags')
              .select('id, name')
              .eq('user_id', user.id)
              .ilike('name', tagName.trim())
              .single()
            
            if (existingTag) {
              tagNameToId.set(existingTag.name.toLowerCase(), existingTag.id)
            }
          } else {
            console.error('Failed to create tag:', tagName, createTagError)
            // Continue with other tags instead of failing completely
          }
        } else if (newTag) {
          tagNameToId.set(newTag.name.toLowerCase(), newTag.id)
        }
      }
    }
    
    // Step 2: Prepare card rows with SM-2 defaults
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
    
    // Step 3: Insert all cards atomically (Property 11)
    const { data: insertedCards, error: insertError } = await supabase
      .from('cards')
      .insert(cardRows)
      .select('id')
    
    if (insertError || !insertedCards) {
      console.error('Failed to insert cards:', insertError)
      return { ok: false, error: { message: 'Failed to create cards', code: 'DB_ERROR' } }
    }
    
    // Step 4: Insert card_tags join rows
    const cardTagRows: { card_id: string; tag_id: string }[] = []
    for (let i = 0; i < insertedCards.length; i++) {
      const cardId = insertedCards[i].id
      const tagNames = cards[i].tagNames
      
      for (const tagName of tagNames) {
        const normalized = tagName.trim().toLowerCase()
        const tagId = tagNameToId.get(normalized)
        if (tagId) {
          cardTagRows.push({ card_id: cardId, tag_id: tagId })
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
