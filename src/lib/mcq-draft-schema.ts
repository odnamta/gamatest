import { z } from 'zod'
import { MIN_SOURCE_TEXT_LENGTH } from './ai-config'
import { MCQ_LIMITS } from './constants'

/**
 * MCQ Draft Schemas and Types
 * 
 * Zod schemas for validating AI MCQ drafting input and output.
 * V11.5: Uses MCQ_LIMITS from constants for validation.
 * 
 * Requirements: FR-2.5, FR-2.6, V6.2 Brain Toggle
 */

/**
 * AI Mode type for Brain Toggle feature.
 * - extract: Extract existing MCQs from Q&A text (verbatim)
 * - generate: Generate new MCQs from textbook content
 */
export const aiModeSchema = z.enum(['extract', 'generate']).default('extract')
export type AIMode = z.infer<typeof aiModeSchema>

/**
 * Input schema for draftMCQFromText server action.
 * Validates the source text and deck information.
 * V6.2: Added mode for Brain Toggle, imageBase64/imageUrl for Vision MVP
 * V9.1: Added subject for multi-domain AI support
 */
export const draftMCQInputSchema = z.object({
  sourceText: z
    .string()
    .min(MIN_SOURCE_TEXT_LENGTH, `Select at least ${MIN_SOURCE_TEXT_LENGTH} characters`),
  deckId: z.string().uuid('Invalid deck ID'),
  deckName: z.string().optional(),
  mode: aiModeSchema.optional(),
  subject: z.string().optional(),  // V9.1: Subject area for AI prompt
  imageBase64: z.string().optional(),
  imageUrl: z.string().url().optional(),
})

export type DraftMCQInput = z.infer<typeof draftMCQInputSchema>

/**
 * Schema for MCQ draft returned by OpenAI.
 * Validates the JSON structure matches our expected format.
 * V6.6: Added optional tags field for AI-generated concept tags
 * V11.5: Uses MCQ_LIMITS from constants
 */
export const mcqDraftSchema = z.object({
  stem: z.string().min(MCQ_LIMITS.minStemLength, `Question stem must be at least ${MCQ_LIMITS.minStemLength} characters`),
  options: z
    .array(z.string().min(1, 'Option cannot be empty'))
    .min(MCQ_LIMITS.minOptions, `Must have at least ${MCQ_LIMITS.minOptions} options`)
    .max(MCQ_LIMITS.maxOptions, `Must have at most ${MCQ_LIMITS.maxOptions} options (A-E)`),
  correct_index: z
    .number()
    .int('Correct index must be an integer')
    .min(0, 'Correct index must be 0-4')
    .max(MCQ_LIMITS.maxOptions - 1, `Correct index must be 0-${MCQ_LIMITS.maxOptions - 1}`),
  explanation: z.string().min(MCQ_LIMITS.minExplanationLength, `Explanation must be at least ${MCQ_LIMITS.minExplanationLength} characters`),
  tags: z.array(z.string()).optional(), // V6.6: AI-generated concept tags
})

export type MCQDraft = z.infer<typeof mcqDraftSchema>

/**
 * Error types for MCQ drafting.
 */
export type MCQDraftError = 'TEXT_TOO_SHORT' | 'OPENAI_ERROR' | 'PARSE_ERROR' | 'NOT_CONFIGURED'

/**
 * Discriminated union result type for draftMCQFromText.
 * Either returns a successful draft or an error type.
 */
export type MCQDraftResult =
  | { ok: true; draft: MCQDraft }
  | { ok: false; error: MCQDraftError }
