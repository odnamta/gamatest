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
1. UNITS: Maintain ALL original units EXACTLY as found in the source text.
   - Do NOT convert units. If the source says "142 lb", use "142 lb" not "64 kg".
   - Do NOT round numbers.
2. NO HALLUCINATION: Never invent, infer, or guess new data values.
   - If a value is missing in the source text, leave it missing in the question.
   - Do NOT add data, measurements, or values not present in the source.
3. VERBATIM EXTRACTION: Extract data verbatim from the source material.
   - Do NOT "improve" or rephrase technical data.
   - Preserve exact wording for domain-specific terminology and values.`

/**
 * V6.6: Tag generation instruction - shared across modes
 */
const TAG_GENERATION_INSTRUCTION = `
- tags: Array of 1-3 CONCEPT tags only (e.g., "SafetyProtocol", "InventoryManagement")
  - Format: Use PascalCase without spaces (e.g., HeavyEquipment, CustomerService)
  - Do NOT generate structural tags (e.g., Chapter1, Section2) - these are handled separately`

/**
 * V6.6: Vision priority instruction - when image is provided
 */
const VISION_PRIORITY_INSTRUCTION = `
IF an image is provided, treat it as primary. The text may just be background.
Prefer questions that clearly come from the image.
If NO question is visible, say so instead of inventing one.`

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

If you cannot find a real exam-style MCQ in the text, return an empty response rather than inventing meta-questions.`

/**
 * V11.2.1: Positive example of properly extracted MCQ
 */
const EXTRACT_POSITIVE_EXAMPLE = `
CORRECT EXAMPLE (properly extracted exam-style MCQ):
{
  "stem": "A forklift operator notices a hydraulic leak while performing a pre-shift inspection. What is the most appropriate next step?",
  "options": ["Continue operating until the shift ends", "Tag out the forklift and report to supervisor", "Attempt to repair the leak", "Switch to a different forklift without reporting"],
  "correct_index": 1,
  "explanation": "Equipment with safety hazards must be immediately tagged out and reported per OSHA guidelines.",
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
  "correct_index": 0,
  "explanation": "Page 5 covers safety protocols.",
  "tags": ["Chapter1"]
}
This is WRONG because it's a comprehension question about the document, not a real exam MCQ.`

/**
 * V9.1: Build system prompt for EXTRACT mode with dynamic subject.
 * V6.2: Extracts existing MCQs verbatim from Q&A text.
 * V6.6: Added tags field and Vision priority
 * V11.2.1: Hardened prompt to prevent meta-questions - COPY ONLY, no generation
 */
function buildExtractSystemPrompt(subject: string = DEFAULT_SUBJECT): string {
  return `You are an expert in ${subject} creating assessment questions.
Your task is to COPY existing exam-style multiple-choice questions from the provided text.

CRITICAL: You are in EXTRACT mode. Your job is to COPY, not CREATE.
- Only extract questions that ALREADY EXIST in the text with numbered stems (1., 2., 3.) and options (A-E or similar)
- The text likely comes from a reference book or training manual - find and copy the real MCQs
- Do NOT create new questions
- Do NOT write comprehension questions about the text itself

Return valid JSON with these exact fields:
- stem: The question text (extracted verbatim, fix obvious OCR spacing only)
- options: Array of 2-5 answer choices - extracted verbatim (do not pad if fewer than 5)
- correct_index: Index of correct answer (0-based)
- explanation: The explanation from the source, or a brief teaching point if none provided
${TAG_GENERATION_INSTRUCTION}

EXTRACTION RULES:
- Look for existing MCQs with numbered question stems and lettered options (A, B, C, D, E)
- Extract the question stem and options VERBATIM (fix obvious OCR spacing only)
- Do NOT create new questions or add options that aren't clearly present in the text
- If the text contains a question with fewer than 5 options, extract only the options present
- If no clear MCQ is found, return {"stem": "", "options": [], "correct_index": 0, "explanation": "", "tags": []}
${EXTRACT_META_BAN}
${EXTRACT_POSITIVE_EXAMPLE}
${EXTRACT_NEGATIVE_EXAMPLE}
${VISION_PRIORITY_INSTRUCTION}
${DATA_INTEGRITY_RULES}`
}

/**
 * V9.1: Build system prompt for GENERATE mode with dynamic subject.
 * V6.2: Creates new MCQs from textbook content.
 * V6.6: Added tags field and Vision priority
 */
function buildGenerateSystemPrompt(subject: string = DEFAULT_SUBJECT): string {
  return `You are an expert in ${subject} creating assessment questions.
Your task is to CREATE ONE new high-quality assessment-style MCQ from the provided passage.

Return valid JSON with these exact fields:
- stem: The question text (clinical vignette or direct question)
- options: Array of 4-5 answer choices (A through D or E)
- correct_index: Index of correct answer (0-based)
- explanation: Concise teaching explanation for why the answer is correct
${TAG_GENERATION_INSTRUCTION}

GENERATION RULES:
- Read the textbook-like passage carefully.
- Create ONE new high-yield board-style MCQ that tests a key concept from this passage.
- All facts, thresholds, and values used in the question and answer options MUST come from the passage.
- Never invent new numbers or values not present in the source.
- Invent plausible distractors (wrong answers), but they must still be conceptually related to the passage.
- Distractors must not contradict facts stated in the passage.
- Write at professional assessment difficulty level.
${VISION_PRIORITY_INSTRUCTION}
${DATA_INTEGRITY_RULES}`
}

/**
 * V9.1: Get the appropriate system prompt based on mode and subject.
 * Subject defaults to 'General' for backward compatibility.
 */
function getSystemPrompt(mode: AIMode = 'extract', subject?: string): string {
  // V9.1: Normalize subject - use default if null, empty, or whitespace only
  const normalizedSubject = subject?.trim() || DEFAULT_SUBJECT
  
  switch (mode) {
    case 'extract':
      return buildExtractSystemPrompt(normalizedSubject)
    case 'generate':
      return buildGenerateSystemPrompt(normalizedSubject)
    default:
      return buildGenerateSystemPrompt(normalizedSubject)
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
  
  const { sourceText, deckName, mode = 'extract', subject, imageBase64, imageUrl } = validationResult.data
  
  try {
    // Build message content (with optional image for Vision MVP)
    const userContent = buildMessageContent(
      buildUserPrompt(sourceText, deckName, mode),
      imageBase64,
      imageUrl
    )

    // Call OpenAI API (FR-2.3, FR-2.4)
    // V9.1: Pass subject to getSystemPrompt for dynamic specialty
    const response = await openai.chat.completions.create({
      model: MCQ_MODEL,
      temperature: MCQ_TEMPERATURE,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: getSystemPrompt(mode, subject) },
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
