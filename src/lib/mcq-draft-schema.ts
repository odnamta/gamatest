import { z } from 'zod'
import { MIN_SOURCE_TEXT_LENGTH } from './ai-config'

/**
 * MCQ Draft Schemas and Types
 * 
 * Zod schemas for validating AI MCQ drafting input and output.
 * 
 * Requirements: FR-2.5, FR-2.6
 */

/**
 * Input schema for draftMCQFromText server action.
 * Validates the source text and deck information.
 */
export const draftMCQInputSchema = z.object({
  sourceText: z
    .string()
    .min(MIN_SOURCE_TEXT_LENGTH, `Select at least ${MIN_SOURCE_TEXT_LENGTH} characters`),
  deckId: z.string().uuid('Invalid deck ID'),
  deckName: z.string().optional(),
})

export type DraftMCQInput = z.infer<typeof draftMCQInputSchema>

/**
 * Schema for MCQ draft returned by OpenAI.
 * Validates the JSON structure matches our expected format.
 */
export const mcqDraftSchema = z.object({
  stem: z.string().min(10, 'Question stem is too short'),
  options: z
    .array(z.string().min(1, 'Option cannot be empty'))
    .length(5, 'Must have exactly 5 options (A-E)'),
  correct_index: z
    .number()
    .int('Correct index must be an integer')
    .min(0, 'Correct index must be 0-4')
    .max(4, 'Correct index must be 0-4'),
  explanation: z.string().min(10, 'Explanation is too short'),
})

export type MCQDraft = z.infer<typeof mcqDraftSchema>

/**
 * Error types for MCQ drafting.
 */
export type MCQDraftError = 'TEXT_TOO_SHORT' | 'OPENAI_ERROR' | 'PARSE_ERROR'

/**
 * Discriminated union result type for draftMCQFromText.
 * Either returns a successful draft or an error type.
 */
export type MCQDraftResult =
  | { ok: true; draft: MCQDraft }
  | { ok: false; error: MCQDraftError }
