'use server'

import { openai } from '@/lib/openai-client'
import { MCQ_MODEL, MCQ_TEMPERATURE } from '@/lib/ai-config'
import {
  draftMCQInputSchema,
  mcqDraftSchema,
  type DraftMCQInput,
  type MCQDraftResult,
  type AIMode,
} from '@/lib/mcq-draft-schema'

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
 * V6.6: Tag generation instruction - shared across modes
 */
const TAG_GENERATION_INSTRUCTION = `
- tags: Array of 1-3 MEDICAL CONCEPT tags only (e.g., "Preeclampsia", "PelvicAnatomy")
  - Format: Use PascalCase without spaces (e.g., GestationalDiabetes, PregnancyInducedHypertension)
  - Do NOT generate structural tags (e.g., Chapter1, Lange, Section2) - these are handled separately`

/**
 * V6.6: Vision priority instruction - when image is provided
 */
const VISION_PRIORITY_INSTRUCTION = `
IF an image is provided, treat it as primary. The text may just be background.
Prefer questions that clearly come from the image.
If NO question is visible, say so instead of inventing one.`

/**
 * System prompt for EXTRACT mode (Q&A sources).
 * V6.2: Extracts existing MCQs verbatim from Q&A text.
 * V6.6: Added tags field and Vision priority
 */
const EXTRACT_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Your task is to EXTRACT an existing multiple-choice question from the provided text.

Return valid JSON with these exact fields:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices - extracted verbatim (do not pad if fewer than 5)
- correct_index: Index of correct answer (0-based)
- explanation: The explanation from the source, or a brief teaching point if none provided
${TAG_GENERATION_INSTRUCTION}

EXTRACTION RULES:
- Identify any existing multiple-choice question already present in the selected text.
- Extract the question stem and options VERBATIM (fix obvious OCR spacing only).
- Do NOT create new questions or add options that aren't clearly present in the text.
- If the text contains a question with fewer than 5 options, extract only the options present.
- If no clear MCQ is found, return the closest question-like content.
${VISION_PRIORITY_INSTRUCTION}
${DATA_INTEGRITY_RULES}`

/**
 * System prompt for GENERATE mode (Textbook sources).
 * V6.2: Creates new MCQs from textbook content.
 * V6.6: Added tags field and Vision priority
 */
const GENERATE_SYSTEM_PROMPT = `You are a medical board exam expert specializing in obstetrics and gynecology.
Your task is to CREATE ONE new high-yield board-style MCQ from the provided textbook passage.

Return valid JSON with these exact fields:
- stem: The question text (clinical vignette or direct question)
- options: Array of 4-5 answer choices (A through D or E)
- correct_index: Index of correct answer (0-based)
- explanation: Concise teaching explanation for why the answer is correct
${TAG_GENERATION_INSTRUCTION}

GENERATION RULES:
- Read the textbook-like passage carefully.
- Create ONE new high-yield board-style MCQ that tests a key concept from this passage.
- All clinical facts, thresholds, and units used in the question and answer options MUST come from the passage.
- Never invent new numbers or units not present in the source.
- Invent plausible distractors (wrong answers), but they must still be conceptually related to the passage.
- Distractors must not contradict medical facts stated in the passage.
- Write at board exam difficulty level.
${VISION_PRIORITY_INSTRUCTION}
${DATA_INTEGRITY_RULES}`

/**
 * Legacy system prompt (fallback, same as generate mode).
 */
const LEGACY_SYSTEM_PROMPT = GENERATE_SYSTEM_PROMPT

/**
 * Get the appropriate system prompt based on mode.
 */
function getSystemPrompt(mode: AIMode = 'extract'): string {
  switch (mode) {
    case 'extract':
      return EXTRACT_SYSTEM_PROMPT
    case 'generate':
      return GENERATE_SYSTEM_PROMPT
    default:
      return LEGACY_SYSTEM_PROMPT
  }
}

/**
 * Builds the user prompt with source text and optional deck context.
 */
function buildUserPrompt(sourceText: string, deckName?: string, mode: AIMode = 'extract'): string {
  let prompt = `Source text:\n${sourceText}`
  
  if (deckName) {
    prompt += `\n\nDeck/topic: ${deckName}`
  }
  
  if (mode === 'extract') {
    prompt += '\n\nExtract the MCQ from this content. Return JSON with stem, options, correct_index, and explanation.'
  } else {
    prompt += '\n\nGenerate one MCQ based on this content, aligned with the deck/topic if possible.'
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
 * Server Action: Generate an MCQ draft from source text using OpenAI.
 * 
 * @param input - Source text, deck ID, optional deck name, mode, and image
 * @returns MCQDraftResult - Either { ok: true, draft } or { ok: false, error }
 * 
 * Requirements: FR-2, V6.2 Brain Toggle, V6.2 Vision MVP
 */
export async function draftMCQFromText(input: DraftMCQInput): Promise<MCQDraftResult> {
  // Check if OpenAI API key is configured (server-side only)
  if (!process.env.OPENAI_API_KEY) {
    console.warn('draftMCQFromText: missing OPENAI_API_KEY')
    return { ok: false, error: 'NOT_CONFIGURED' }
  }

  // Validate input with Zod schema (FR-2.1, FR-2.2)
  const validationResult = draftMCQInputSchema.safeParse(input)
  
  if (!validationResult.success) {
    return { ok: false, error: 'TEXT_TOO_SHORT' }
  }
  
  const { sourceText, deckName, mode = 'extract', imageBase64, imageUrl } = validationResult.data
  
  // V6.6: Debug logging for image presence
  if (imageBase64 || imageUrl) {
    console.log('[draftMCQFromText] Image provided:', {
      hasBase64: !!imageBase64,
      base64Length: imageBase64?.length || 0,
      hasUrl: !!imageUrl,
    })
  }
  
  try {
    // Build message content (with optional image for Vision MVP)
    const userContent = buildMessageContent(
      buildUserPrompt(sourceText, deckName, mode),
      imageBase64,
      imageUrl
    )

    // Call OpenAI API (FR-2.3, FR-2.4)
    const response = await openai.chat.completions.create({
      model: MCQ_MODEL,
      temperature: MCQ_TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getSystemPrompt(mode) },
        { role: 'user', content: userContent as string },
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
