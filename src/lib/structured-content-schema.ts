/**
 * V11: Structured Content Engine - Zod Validation Schemas
 * 
 * Provides validation for book sources, chapters, and matching groups.
 */

import { z } from 'zod'

// ============================================
// Book Source Schemas
// ============================================

/**
 * Schema for creating a new book source
 * Validates: Requirements 1.2 - title must be non-empty
 */
export const createBookSourceSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Title cannot be empty or whitespace only'),
  edition: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
})

export type CreateBookSourceInput = z.infer<typeof createBookSourceSchema>

/**
 * Schema for updating a book source
 */
export const updateBookSourceSchema = z.object({
  id: z.string().uuid(),
  title: z
    .string()
    .min(1, 'Title is required')
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Title cannot be empty or whitespace only')
    .optional(),
  edition: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
})

export type UpdateBookSourceInput = z.infer<typeof updateBookSourceSchema>

// ============================================
// Book Chapter Schemas
// ============================================

/**
 * Schema for creating a new chapter
 * Validates: Requirements 2.2 - chapter_number must be positive, title non-empty
 */
export const createChapterSchema = z.object({
  book_source_id: z.string().uuid(),
  chapter_number: z
    .number()
    .int('Chapter number must be an integer')
    .positive('Chapter number must be positive'),
  title: z
    .string()
    .min(1, 'Title is required')
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Title cannot be empty or whitespace only'),
  expected_question_count: z.number().int().positive().nullable().optional(),
})

export type CreateChapterInput = z.infer<typeof createChapterSchema>

/**
 * Schema for updating a chapter
 */
export const updateChapterSchema = z.object({
  id: z.string().uuid(),
  chapter_number: z
    .number()
    .int('Chapter number must be an integer')
    .positive('Chapter number must be positive')
    .optional(),
  title: z
    .string()
    .min(1, 'Title is required')
    .transform(s => s.trim())
    .refine(s => s.length > 0, 'Title cannot be empty or whitespace only')
    .optional(),
  expected_question_count: z.number().int().positive().nullable().optional(),
})

export type UpdateChapterInput = z.infer<typeof updateChapterSchema>

// ============================================
// Matching Group Schemas
// ============================================

/**
 * Schema for creating a matching group
 * Validates: Requirements 4.1 - common_options must be non-empty array
 */
export const createMatchingGroupSchema = z.object({
  chapter_id: z.string().uuid().nullable().optional(),
  common_options: z
    .array(z.string().min(1))
    .min(2, 'Matching group must have at least 2 options'),
  instruction_text: z.string().nullable().optional(),
})

export type CreateMatchingGroupInput = z.infer<typeof createMatchingGroupSchema>

// ============================================
// Import Session Context Schema
// ============================================

/**
 * Schema for import session context
 */
export const importSessionContextSchema = z.object({
  bookSourceId: z.string().uuid().nullable(),
  chapterId: z.string().uuid().nullable(),
  expectedQuestionCount: z.number().int().positive().nullable(),
  detectedQuestionNumbers: z.array(z.number().int().positive()),
})

export type ImportSessionContextInput = z.infer<typeof importSessionContextSchema>

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validates book source title
 * Returns true if valid, false if empty/whitespace
 */
export function isValidBookSourceTitle(title: string): boolean {
  const result = createBookSourceSchema.shape.title.safeParse(title)
  return result.success
}

/**
 * Validates chapter number
 * Returns true if positive integer, false otherwise
 */
export function isValidChapterNumber(num: number): boolean {
  return Number.isInteger(num) && num > 0
}

/**
 * Validates chapter title
 * Returns true if valid, false if empty/whitespace
 */
export function isValidChapterTitle(title: string): boolean {
  const result = createChapterSchema.shape.title.safeParse(title)
  return result.success
}
