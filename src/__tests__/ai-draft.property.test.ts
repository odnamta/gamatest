import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { mcqDraftSchema, draftMCQInputSchema } from '../lib/mcq-draft-schema';
import { MIN_SOURCE_TEXT_LENGTH } from '../lib/ai-config';

/**
 * **Feature: v4-ai-brain, Property Tests for AI MCQ Drafting**
 * **Validates: Requirements FR-2.2, FR-2.5, FR-2.6**
 *
 * Property-based tests for MCQ draft validation schemas.
 * These tests verify the Zod schemas correctly validate/reject inputs.
 */

describe('Property 1: Valid MCQ Response Parsing', () => {
  /**
   * **Feature: v4-ai-brain, Property 1: Valid MCQ Response Parsing**
   * **Validates: FR-2.5**
   *
   * For any valid MCQ draft structure with:
   * - stem: non-empty string (min 10 chars)
   * - options: array of exactly 5 non-empty strings
   * - correct_index: integer 0-4
   * - explanation: non-empty string (min 10 chars)
   * The schema SHALL parse successfully and return the same data.
   */

  // Generator for valid stem (min 10 chars)
  const validStemArb = fc.string({ minLength: 10, maxLength: 500 });

  // Generator for valid option (non-empty)
  const validOptionArb = fc.string({ minLength: 1, maxLength: 200 });

  // Generator for valid options array (exactly 5)
  const validOptionsArb = fc.tuple(
    validOptionArb,
    validOptionArb,
    validOptionArb,
    validOptionArb,
    validOptionArb
  ).map(tuple => [...tuple]);

  // Generator for valid correct_index (0-4)
  const validCorrectIndexArb = fc.integer({ min: 0, max: 4 });

  // Generator for valid explanation (min 10 chars)
  const validExplanationArb = fc.string({ minLength: 10, maxLength: 500 });

  test('parses valid MCQ draft structure correctly', () => {
    fc.assert(
      fc.property(
        validStemArb,
        validOptionsArb,
        validCorrectIndexArb,
        validExplanationArb,
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.stem).toBe(stem);
            expect(result.data.options).toEqual(options);
            expect(result.data.correct_index).toBe(correct_index);
            expect(result.data.explanation).toBe(explanation);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Invalid Response Returns PARSE_ERROR', () => {
  /**
   * **Feature: v4-ai-brain, Property 2: Invalid Response Returns PARSE_ERROR**
   * **Validates: FR-2.6**
   *
   * For any malformed MCQ draft structure (missing fields, wrong types, invalid values),
   * the schema SHALL reject with validation errors.
   */

  test('rejects MCQ with missing stem', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 5, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 10 }),
        (options, correct_index, explanation) => {
          const input = { options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('rejects MCQ with wrong number of options', () => {
    // Test with fewer than 5 options
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 4 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 10 }),
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );

    // Test with more than 5 options
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 6, maxLength: 10 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 10 }),
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('rejects MCQ with invalid correct_index', () => {
    // Test with negative index
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 5, maxLength: 5 }),
        fc.integer({ min: -100, max: -1 }),
        fc.string({ minLength: 10 }),
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );

    // Test with index >= 5
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 5, maxLength: 5 }),
        fc.integer({ min: 5, max: 100 }),
        fc.string({ minLength: 10 }),
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('rejects MCQ with stem too short', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 9 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 5, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 10 }),
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('rejects MCQ with explanation too short', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10 }),
        fc.array(fc.string({ minLength: 1 }), { minLength: 5, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 0, maxLength: 9 }),
        (stem, options, correct_index, explanation) => {
          const input = { stem, options, correct_index, explanation };
          const result = mcqDraftSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 3: Short Text Returns TEXT_TOO_SHORT', () => {
  /**
   * **Feature: v4-ai-brain, Property 3: Short Text Returns TEXT_TOO_SHORT**
   * **Validates: FR-2.2**
   *
   * For any source text with fewer than MIN_SOURCE_TEXT_LENGTH characters,
   * the input schema SHALL reject with validation error.
   */

  // Generator for valid UUID
  const validUuidArb = fc.uuid();

  test('rejects source text shorter than minimum length', () => {
    // Generate strings shorter than MIN_SOURCE_TEXT_LENGTH
    const shortTextArb = fc.string({ minLength: 0, maxLength: MIN_SOURCE_TEXT_LENGTH - 1 });

    fc.assert(
      fc.property(
        shortTextArb,
        validUuidArb,
        fc.option(fc.string()),
        (sourceText, deckId, deckName) => {
          const input = {
            sourceText,
            deckId,
            deckName: deckName ?? undefined,
          };
          const result = draftMCQInputSchema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('sourceText')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('accepts source text at or above minimum length', () => {
    // Generate strings at or above MIN_SOURCE_TEXT_LENGTH
    const validTextArb = fc.string({ minLength: MIN_SOURCE_TEXT_LENGTH, maxLength: 1000 });

    fc.assert(
      fc.property(
        validTextArb,
        validUuidArb,
        fc.option(fc.string()),
        (sourceText, deckId, deckName) => {
          const input = {
            sourceText,
            deckId,
            deckName: deckName ?? undefined,
          };
          const result = draftMCQInputSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects invalid deck ID format', () => {
    const validTextArb = fc.string({ minLength: MIN_SOURCE_TEXT_LENGTH, maxLength: 200 });
    const invalidUuidArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => 
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
    );

    fc.assert(
      fc.property(
        validTextArb,
        invalidUuidArb,
        (sourceText, deckId) => {
          const input = { sourceText, deckId };
          const result = draftMCQInputSchema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('deckId')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
