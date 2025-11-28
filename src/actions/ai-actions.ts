'use server'

import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE } from '@/lib/ai-config'
import {
  draftMCQInputSchema,
  mcqDraftSchema,
  type DraftMCQInput,
  type MCQDraftResult,
} from '@/lib/mcq-draft-schema'

/**
 * System prompt for MCQ generation.
 * Instructs the AI to act as a medical board exam expert.
 */
const SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology. 
Given source text from a medical textbook or reference, create EXACTLY ONE 
high-quality multiple-choice question (MCQ) suitable for a board-style exam.

Return valid JSON with these exact fields:
- stem: The question text (clinical vignette or direct question)
- options: Array of exactly 5 answer choices (A through E)
- correct_index: Index of correct answer (0-4)
- explanation: Concise teaching explanation for why the answer is correct

Guidelines:
- Write at a board exam difficulty level
- Include relevant clinical details in the stem
- Make distractors plausible but clearly incorrect
- Explanation should teach the key concept`

/**
 * Builds the user prompt with source text and optional deck context.
 */
function buildUserPrompt(sourceText: string, deckName?: string): string {
  let prompt = `Source text:\n${sourceText}`
  
  if (deckName) {
    prompt += `\n\nDeck/topic: ${deckName}`
  }
  
  prompt += '\n\nGenerate one MCQ based on this content, aligned with the deck/topic if possible.'
  
  return prompt
}

/**
 * Server Action: Generate an MCQ draft from source text using OpenAI.
 * 
 * @param input - Source text, deck ID, and optional deck name
 * @returns MCQDraftResult - Either { ok: true, draft } or { ok: false, error }
 * 
 * Requirements: FR-2
 */
export async function draftMCQFromText(input: DraftMCQInput): Promise<MCQDraftResult> {
  // Validate input with Zod schema (FR-2.1, FR-2.2)
  const validationResult = draftMCQInputSchema.safeParse(input)
  
  if (!validationResult.success) {
    return { ok: false, error: 'TEXT_TOO_SHORT' }
  }
  
  const { sourceText, deckName } = validationResult.data
  
  try {
    // Call OpenAI API (FR-2.3, FR-2.4)
    const response = await openai.chat.completions.create({
      model: MCQ_MODEL,
      temperature: MCQ_TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(sourceText, deckName) },
      ],
    })
    
    // Extract content from response
    const content = response.choices[0]?.message?.content
    
    if (!content) {
      console.error('OpenAI returned empty content')
      return { ok: false, error: 'OPENAI_ERROR' }
    }
    
    // Parse JSON response
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Failed to parse OpenAI response as JSON:', content)
      return { ok: false, error: 'PARSE_ERROR' }
    }
    
    // Validate against MCQ schema (FR-2.5)
    const draftResult = mcqDraftSchema.safeParse(parsed)
    
    if (!draftResult.success) {
      console.error('MCQ draft validation failed:', draftResult.error.issues)
      return { ok: false, error: 'PARSE_ERROR' }
    }
    
    // Success! Return the validated draft (FR-2.6)
    return { ok: true, draft: draftResult.data }
    
  } catch (error) {
    // Handle API errors (network, auth, rate limits, etc.)
    console.error('OpenAI API error:', error)
    return { ok: false, error: 'OPENAI_ERROR' }
  }
}
