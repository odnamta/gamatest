import { z } from 'zod'

/**
 * Batch MCQ Schemas and Types
 * 
 * Zod schemas for validating batch AI MCQ drafting input and output.
 * 
 * Requirements: R1.2 - Multi-Question Output
 */

/**
 * Schema for a single MCQ draft item from batch AI response.
 * Each draft contains stem, options (2-5), correctIndex (0-4), explanation, and topic tags (1-3).
 */
export const mcqBatchItemSchema = z.object({
  stem: z.string().min(10, 'Question stem must be at least 10 characters'),
  options: z
    .array(z.string().min(1, 'Option cannot be empty'))
    .min(2, 'Must have at least 2 options')
    .max(5, 'Must have at most 5 options'),
  correctIndex: z
    .number()
    .int('Correct index must be an integer')
    .min(0, 'Correct index must be 0-4')
    .max(4, 'Correct index must be 0-4'),
  explanation: z.string().optional(),
  tags: z
    .array(z.string().max(30, 'Tag must be at most 30 characters'))
    .min(1, 'Must have at least 1 tag')
    .max(3, 'Must have at most 3 tags')
    .optional(),
})

export type MCQBatchItem = z.infer<typeof mcqBatchItemSchema>

/**
 * Schema for array of MCQ drafts (capped at 5).
 * Used to validate the AI response after parsing.
 */
export const mcqBatchDraftSchema = z.array(mcqBatchItemSchema).max(5)

export type MCQBatchDraft = z.infer<typeof mcqBatchDraftSchema>

/**
 * Input schema for draftBatchMCQFromText server action.
 * Validates deckId, text (50-10000 chars), and optional defaultTags.
 */
export const draftBatchInputSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  text: z
    .string()
    .min(50, 'Text must be at least 50 characters')
    .max(10000, 'Text must be at most 10000 characters'),
  defaultTags: z.array(z.string()).optional(),
})

export type DraftBatchInput = z.infer<typeof draftBatchInputSchema>

/**
 * Input schema for bulkCreateMCQ server action.
 * Validates deckId and array of cards (1-5) with merged tags.
 */
export const bulkCreateInputSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  cards: z
    .array(
      z.object({
        stem: z.string().min(1, 'Stem is required'),
        options: z
          .array(z.string().min(1, 'Option cannot be empty'))
          .min(2, 'Must have at least 2 options')
          .max(5, 'Must have at most 5 options'),
        correctIndex: z
          .number()
          .int('Correct index must be an integer')
          .min(0, 'Correct index must be non-negative'),
        explanation: z.string().optional(),
        tagNames: z.array(z.string()),
      })
    )
    .min(1, 'Must have at least 1 card')
    .max(5, 'Must have at most 5 cards'),
})

export type BulkCreateInput = z.infer<typeof bulkCreateInputSchema>

/**
 * Result types for server actions
 */
export type DraftBatchResult =
  | { ok: true; drafts: MCQBatchItem[] }
  | { ok: false; error: { message: string; code?: string } }

export type BulkCreateResult =
  | { ok: true; createdCount: number; deckId: string }
  | { ok: false; error: { message: string; code?: string } }

/**
 * Client-side UI type for batch drafts with additional state.
 * Extends server draft with id (for React keys) and include checkbox state.
 */
export interface MCQBatchDraftUI {
  id: string              // Unique key for React
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
  aiTags: string[]        // AI-suggested tags (editable)
  include: boolean        // Checkbox state (default: true)
}

/**
 * Transform server draft to UI draft format.
 * Sets include to true by default (Property 7).
 */
export function toUIFormat(draft: MCQBatchItem, index: number): MCQBatchDraftUI {
  return {
    id: `draft-${Date.now()}-${index}`,
    stem: draft.stem,
    options: draft.options,
    correctIndex: draft.correctIndex,
    explanation: draft.explanation || '',
    aiTags: draft.tags || [],
    include: true, // Default to included (Property 7)
  }
}

/**
 * Transform array of server drafts to UI format.
 */
export function toUIFormatArray(drafts: MCQBatchItem[]): MCQBatchDraftUI[] {
  return drafts.map((draft, index) => toUIFormat(draft, index))
}
