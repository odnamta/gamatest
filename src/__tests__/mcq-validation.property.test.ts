import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { createMCQSchema } from '../lib/validations';

/**
 * **Feature: cekatan, Property 2: MCQ Validation Correctness**
 * **Validates: Requirements 1.4, 3.2**
 *
 * For any MCQ input data:
 * - If stem is empty, validation SHALL reject
 * - If options has fewer than 2 elements, validation SHALL reject
 * - If correct_index is negative or >= options.length, validation SHALL reject
 * - If all constraints are satisfied, validation SHALL accept
 */
describe('Property 2: MCQ Validation Correctness', () => {
  // Generator for valid UUID
  const validUuidArb = fc.uuid();

  // Generator for valid non-empty strings
  const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 200 });

  // Generator for valid MCQ options (array of non-empty strings, min 2 elements)
  const validOptionsArb = fc.array(nonEmptyStringArb, { minLength: 2, maxLength: 6 });

  test('rejects empty stem', () => {
    fc.assert(
      fc.property(
        validUuidArb,
        validOptionsArb,
        (deckId, options) => {
          const correctIndex = Math.floor(Math.random() * options.length);
          const result = createMCQSchema.safeParse({
            deckId,
            stem: '',
            options,
            correctIndex,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('stem'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects options with fewer than 2 elements', () => {
    // Generator for options with 0 or 1 element
    const insufficientOptionsArb = fc.oneof(
      fc.constant([]),
      fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 1 })
    );

    fc.assert(
      fc.property(
        validUuidArb,
        nonEmptyStringArb,
        insufficientOptionsArb,
        (deckId, stem, options) => {
          const result = createMCQSchema.safeParse({
            deckId,
            stem,
            options,
            correctIndex: 0,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('options'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects negative correct_index', () => {
    const negativeIndexArb = fc.integer({ min: -1000, max: -1 });

    fc.assert(
      fc.property(
        validUuidArb,
        nonEmptyStringArb,
        validOptionsArb,
        negativeIndexArb,
        (deckId, stem, options, correctIndex) => {
          const result = createMCQSchema.safeParse({
            deckId,
            stem,
            options,
            correctIndex,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('correctIndex'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects correct_index >= options.length', () => {
    fc.assert(
      fc.property(
        validUuidArb,
        nonEmptyStringArb,
        validOptionsArb,
        (deckId, stem, options) => {
          // Generate an index that is out of bounds (>= options.length)
          const outOfBoundsIndex = options.length + Math.floor(Math.random() * 10);
          const result = createMCQSchema.safeParse({
            deckId,
            stem,
            options,
            correctIndex: outOfBoundsIndex,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => issue.path.includes('correctIndex'))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('accepts valid MCQ input when all constraints are satisfied', () => {
    fc.assert(
      fc.property(
        validUuidArb,
        nonEmptyStringArb,
        validOptionsArb,
        fc.option(fc.string({ maxLength: 500 })),
        (deckId, stem, options, explanation) => {
          // Generate a valid correct_index within bounds
          const correctIndex = Math.floor(Math.random() * options.length);
          const result = createMCQSchema.safeParse({
            deckId,
            stem,
            options,
            correctIndex,
            explanation: explanation ?? undefined,
          });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects options containing empty strings', () => {
    fc.assert(
      fc.property(
        validUuidArb,
        nonEmptyStringArb,
        fc.array(nonEmptyStringArb, { minLength: 1, maxLength: 5 }),
        (deckId, stem, validOptions) => {
          // Insert an empty string into the options
          const optionsWithEmpty = [...validOptions, ''];
          const result = createMCQSchema.safeParse({
            deckId,
            stem,
            options: optionsWithEmpty,
            correctIndex: 0,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some((issue) => 
              issue.path.includes('options') || issue.path[0] === 'options'
            )).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
