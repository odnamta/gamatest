import { z } from 'zod'

/**
 * Batch MCQ Schemas and Types
 * 
 * Zod schemas for validating batch AI MCQ drafting input and output.
 * 
 * Requirements: R1.2 - Multi-Question Output, V6.2 Brain Toggle
 */

/**
 * AI Mode type for Brain Toggle feature.
 * - extract: Extract existing MCQs from Q&A text (verbatim)
 * - generate: Generate new MCQs from textbook content
 */
export const aiModeSchema = z.enum(['extract', 'generate']).default('extract')
export type AIMode = z.infer<typeof aiModeSchema>

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
    .array(z.string().min(1, 'Tag cannot be empty').max(30, 'Tag must be at most 30 characters'))
    .min(1, 'Must have at least 1 tag')
    .max(3, 'Must have at most 3 tags'),
})

export type MCQBatchItem = z.infer<typeof mcqBatchItemSchema>

/**
 * Schema for array of MCQ drafts (no artificial cap).
 * Used to validate the AI response after parsing.
 * V8.6: Removed .max(5) to allow unlimited extraction from dense pages.
 */
export const mcqBatchDraftSchema = z.array(mcqBatchItemSchema)

export type MCQBatchDraft = z.infer<typeof mcqBatchDraftSchema>

/**
 * Input schema for draftBatchMCQFromText server action.
 * Validates deckId, text (50-10000 chars), and optional defaultTags.
 * V6.2: Added mode for Brain Toggle, imageBase64/imageUrl for Vision MVP
 * V9.1: Added subject for multi-domain AI support
 */
export const draftBatchInputSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  text: z
    .string()
    .min(50, 'Text must be at least 50 characters')
    .max(10000, 'Text must be at most 10000 characters'),
  defaultTags: z.array(z.string()).optional(),
  mode: aiModeSchema.optional(),
  subject: z.string().optional(),  // V9.1: Subject area for AI prompt
  imageBase64: z.string().optional(),
  imageUrl: z.string().url().optional(),
})

export type DraftBatchInput = z.infer<typeof draftBatchInputSchema>

/**
 * Input schema for bulkCreateMCQ server action.
 * Validates deckId, sessionTags, and array of cards (1-5) with merged tags.
 * V6.1: Added sessionTags for atomic tag merging
 */
export const bulkCreateInputSchema = z.object({
  deckId: z.string().uuid('Invalid deck ID'),
  sessionTags: z.array(z.string()).optional().default([]),
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
 * V12: Extended with quality scanner data
 */
export type DraftBatchResult =
  | { 
      ok: true
      drafts: MCQBatchItemWithQuality[]
      // V12: Quality scanner metadata
      rawTextChunk?: string
      rawQuestionCount?: number
      aiDraftCount?: number
      numQuestionsWithMissingOptions?: number
      numQuestionsWithExtraOptions?: number
    }
  | { ok: false; error: { message: string; code?: string } }

/**
 * V11.6: Added skippedCount for duplicate detection reporting
 */
export type BulkCreateResult =
  | { ok: true; createdCount: number; skippedCount?: number; deckId: string }
  | { ok: false; error: { message: string; code?: string } }

/**
 * V12: Quality issue type for scanner integration
 * Re-exported from mcq-quality-scanner for convenience
 */
export type { MCQIssue, MCQIssueSeverity, MCQIssueCode } from './mcq-quality-scanner'

/**
 * Client-side UI type for batch drafts with additional state.
 * Extends server draft with id (for React keys) and include checkbox state.
 * V12: Added qualityIssues and rawTextChunk for quality scanner integration.
 */
export interface MCQBatchDraftUI {
  id: string              // Unique key for React
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
  aiTags: string[]        // AI-suggested tags (editable)
  include: boolean        // Checkbox state (default: true)
  // V12: Quality scanner fields (in-memory only, not DB)
  qualityIssues?: import('./mcq-quality-scanner').MCQIssue[]
  rawTextChunk?: string   // Source text for this draft
}

/**
 * V12: Extended MCQBatchItem with quality fields for internal use
 */
export interface MCQBatchItemWithQuality extends MCQBatchItem {
  qualityIssues?: import('./mcq-quality-scanner').MCQIssue[]
  rawTextChunk?: string
}

/**
 * Transform server draft to UI draft format.
 * Sets include to true by default (Property 7).
 * V12: Supports qualityIssues and rawTextChunk passthrough.
 */
export function toUIFormat(
  draft: MCQBatchItem | MCQBatchItemWithQuality,
  index: number,
  rawTextChunk?: string
): MCQBatchDraftUI {
  const draftWithQuality = draft as MCQBatchItemWithQuality
  return {
    id: `draft-${Date.now()}-${index}`,
    stem: draft.stem,
    options: draft.options,
    correctIndex: draft.correctIndex,
    explanation: draft.explanation || '',
    aiTags: draft.tags || [],
    include: true, // Default to included (Property 7)
    // V12: Quality scanner fields
    qualityIssues: draftWithQuality.qualityIssues,
    rawTextChunk: rawTextChunk || draftWithQuality.rawTextChunk,
  }
}

/**
 * Transform array of server drafts to UI format.
 * V12: Supports rawTextChunk passthrough for all drafts.
 */
export function toUIFormatArray(
  drafts: (MCQBatchItem | MCQBatchItemWithQuality)[],
  rawTextChunk?: string
): MCQBatchDraftUI[] {
  return drafts.map((draft, index) => toUIFormat(draft, index, rawTextChunk))
}
