/**
 * AI Configuration for MCQ Drafting
 * 
 * Centralizes model and temperature settings for OpenAI calls.
 * Values can be overridden via environment variables.
 * 
 * Requirements: NFR-4
 */

/**
 * OpenAI model to use for MCQ generation.
 * Default: gpt-4o (best quality for assessment content)
 * Can be overridden with MCQ_MODEL env var (e.g., gpt-4o-mini for cost savings)
 */
export const MCQ_MODEL = process.env.MCQ_MODEL ?? 'gpt-4o'

/**
 * Temperature for MCQ generation.
 * Default: 0.2 (low temperature for factual accuracy)
 * Can be overridden with MCQ_TEMPERATURE env var
 */
export const MCQ_TEMPERATURE = parseFloat(process.env.MCQ_TEMPERATURE ?? '0.2')

/**
 * Minimum character count for source text.
 * Text shorter than this will be rejected with TEXT_TOO_SHORT error.
 */
export const MIN_SOURCE_TEXT_LENGTH = 50

/**
 * Rate limit window in milliseconds.
 * Users must wait this long between AI draft requests.
 */
export const RATE_LIMIT_MS = 3000

/**
 * V8.6: Maximum tokens for MCQ batch extraction.
 * Increased to prevent truncation on dense pages with many questions.
 * Can be overridden with MCQ_MAX_TOKENS env var.
 */
export const MCQ_MAX_TOKENS = parseInt(process.env.MCQ_MAX_TOKENS ?? '4096')
