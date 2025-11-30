import { z } from 'zod'
import { MIN_SOURCE_TEXT_LENGTH } from './ai-config'

/**
 * MCQ Draft Schemas and Types
 * 
 * Zod schemas for validating AI MCQ drafting input and output.
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
 */
export const draftMCQInputSchema = z.object({
  sourceText: z
    .string()
    .min(MIN_SOURCE_TEXT_LENGTH, `Select at least ${MIN_SOURCE_TEXT_LENGTH} characters`),
  deckId: z.string().uuid('Invalid deck ID'),
  deckName: z.string().optional(),
  mode: aiModeSchema.optional(),
  imageBase64: z.string().optional(),
  imageUrl: z.string().url().optional(),
})

export type DraftMCQInput = z.infer<typeof draftMCQInputSchema>

/**
 * Schema for MCQ draft returned by OpenAI.
 * Validates the JSON structure matches our expected format.
 * V6.6: Added optional tags field for AI-generated concept tags
 */
export const mcqDraftSchema = z.object({
  stem: z.string().min(10, 'Question stem is too short'),
  options: z
    .array(z.string().min(1, 'Option cannot be empty'))
    .min(2, 'Must have at least 2 options')
    .max(5, 'Must have at most 5 options (A-E)'),
  correct_index: z
    .number()
    .int('Correct index must be an integer')
    .min(0, 'Correct index must be 0-4')
    .max(4, 'Correct index must be 0-4'),
  explanation: z.string().min(10, 'Explanation is too short'),
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
