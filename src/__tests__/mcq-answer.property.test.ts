import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { determineMCQAnswer } from '../lib/mcq-answer';

/**
 * **Feature: cekatan, Property 4: MCQ Answer Correctness Mapping**
 * **Validates: Requirements 2.4, 2.5**
 *
 * For any MCQ with correct_index C and for any selected_index S:
 * - If S equals C, the answer is correct and SHALL map to SRS rating 3 (Good)
 * - If S does not equal C, the answer is incorrect and SHALL map to SRS rating 1 (Again)
 */
describe('Property 4: MCQ Answer Correctness Mapping', () => {
  // Generator for valid option indices (non-negative integers)
  const validIndexArb = fc.nat({ max: 10 });

  test('correct answer (selectedIndex === correctIndex) maps to SRS rating 3 (Good)', () => {
    fc.assert(
      fc.property(
        validIndexArb,
        (correctIndex) => {
          // When selected equals correct
          const result = determineMCQAnswer({
            selectedIndex: correctIndex,
            correctIndex,
          });

          expect(result.isCorrect).toBe(true);
          expect(result.srsRating).toBe(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('incorrect answer (selectedIndex !== correctIndex) maps to SRS rating 1 (Again)', () => {
    fc.assert(
      fc.property(
        validIndexArb,
        validIndexArb,
        (selectedIndex, correctIndex) => {
          // Only test when indices are different
          fc.pre(selectedIndex !== correctIndex);

          const result = determineMCQAnswer({
            selectedIndex,
            correctIndex,
          });

          expect(result.isCorrect).toBe(false);
          expect(result.srsRating).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isCorrect is true if and only if selectedIndex equals correctIndex', () => {
    fc.assert(
      fc.property(
        validIndexArb,
        validIndexArb,
        (selectedIndex, correctIndex) => {
          const result = determineMCQAnswer({
            selectedIndex,
            correctIndex,
          });

          // isCorrect should be true iff indices match
          expect(result.isCorrect).toBe(selectedIndex === correctIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('srsRating is always either 1 or 3', () => {
    fc.assert(
      fc.property(
        validIndexArb,
        validIndexArb,
        (selectedIndex, correctIndex) => {
          const result = determineMCQAnswer({
            selectedIndex,
            correctIndex,
          });

          expect([1, 3]).toContain(result.srsRating);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('srsRating is 3 iff isCorrect is true', () => {
    fc.assert(
      fc.property(
        validIndexArb,
        validIndexArb,
        (selectedIndex, correctIndex) => {
          const result = determineMCQAnswer({
            selectedIndex,
            correctIndex,
          });

          // srsRating should be 3 iff isCorrect is true
          if (result.isCorrect) {
            expect(result.srsRating).toBe(3);
          } else {
            expect(result.srsRating).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
