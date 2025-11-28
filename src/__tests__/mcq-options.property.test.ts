import { describe, test, expect } from 'vitest';
import fc from 'fast-check';

/**
 * **Feature: cellines-obgyn-prep-v2, Property 1: MCQ Options Round-Trip Consistency**
 * **Validates: Requirements 1.2**
 *
 * For any valid options array (array of non-empty strings with length >= 2),
 * serializing to JSONB and deserializing back SHALL produce an identical array.
 */
describe('Property 1: MCQ Options Round-Trip Consistency', () => {
  // Generator for valid MCQ options (array of non-empty strings, min 2 elements)
  const mcqOptionsArb = fc.array(
    fc.string({ minLength: 1, maxLength: 200 }),
    { minLength: 2, maxLength: 6 }
  );

  test('options round-trip preserves data through JSON serialization', () => {
    fc.assert(
      fc.property(mcqOptionsArb, (options) => {
        // Simulate JSONB serialization (what PostgreSQL does)
        const serialized = JSON.stringify(options);
        const deserialized = JSON.parse(serialized) as string[];

        // Verify round-trip consistency
        expect(deserialized).toEqual(options);
        expect(deserialized.length).toBe(options.length);

        // Verify each element is preserved exactly
        for (let i = 0; i < options.length; i++) {
          expect(deserialized[i]).toBe(options[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  test('options with special characters survive round-trip', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 200 }),
          { minLength: 2, maxLength: 6 }
        ),
        (options) => {
          const serialized = JSON.stringify(options);
          const deserialized = JSON.parse(serialized) as string[];

          expect(deserialized).toEqual(options);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('options with varying lengths survive round-trip', () => {
    // Generator with varying option counts and lengths
    const varyingOptionsArb = fc.array(
      fc.string({ minLength: 1, maxLength: 500 }),
      { minLength: 2, maxLength: 10 }
    );

    fc.assert(
      fc.property(varyingOptionsArb, (options) => {
        const serialized = JSON.stringify(options);
        const deserialized = JSON.parse(serialized) as string[];

        expect(deserialized).toEqual(options);
      }),
      { numRuns: 100 }
    );
  });
});


import {
  getOptionLabel,
  addOption,
  removeOption,
  getOptionLabels,
  adjustCorrectIndexAfterRemoval,
} from '../lib/mcq-options';

/**
 * **Feature: v3.1-bugfix-ux-polish, Property 5: Option Array Labeling Invariant**
 * **Validates: Requirements 6.2, 6.3**
 * 
 * For any sequence of add and remove operations on the options array, the resulting
 * options SHALL always be labeled sequentially as A, B, C, D, E, F... corresponding
 * to indices 0, 1, 2, 3, 4, 5... with no gaps or duplicates.
 */
describe('Property 5: Option Array Labeling Invariant', () => {
  test('getOptionLabel returns correct letter for valid indices', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 25 }),
        (index) => {
          const label = getOptionLabel(index);
          const expectedLabel = String.fromCharCode(65 + index);
          expect(label).toBe(expectedLabel);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('getOptionLabel returns empty string for invalid indices', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: -1 }),
          fc.integer({ min: 26, max: 1000 })
        ),
        (index) => {
          const label = getOptionLabel(index);
          expect(label).toBe('');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Labels are always sequential A, B, C... for any options array', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 2, maxLength: 10 }),
        (options) => {
          const labels = getOptionLabels(options);
          
          // Verify sequential labeling
          for (let i = 0; i < labels.length; i++) {
            expect(labels[i]).toBe(String.fromCharCode(65 + i));
          }
          
          // Verify no gaps
          expect(labels.length).toBe(options.length);
          
          // Verify no duplicates
          const uniqueLabels = new Set(labels);
          expect(uniqueLabels.size).toBe(labels.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('addOption maintains sequential labeling', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 2, maxLength: 9 }),
        (options) => {
          const newOptions = addOption(options, 10);
          
          if (options.length < 10) {
            expect(newOptions.length).toBe(options.length + 1);
          } else {
            expect(newOptions.length).toBe(options.length);
          }
          
          // Labels should still be sequential
          const labels = getOptionLabels(newOptions);
          for (let i = 0; i < labels.length; i++) {
            expect(labels[i]).toBe(String.fromCharCode(65 + i));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('removeOption maintains sequential labeling', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 3, maxLength: 10 }),
        fc.nat(),
        (options, indexSeed) => {
          const removeIndex = indexSeed % options.length;
          const newOptions = removeOption(options, removeIndex, 2);
          
          if (options.length > 2) {
            expect(newOptions.length).toBe(options.length - 1);
          } else {
            expect(newOptions.length).toBe(options.length);
          }
          
          // Labels should still be sequential after removal
          const labels = getOptionLabels(newOptions);
          for (let i = 0; i < labels.length; i++) {
            expect(labels[i]).toBe(String.fromCharCode(65 + i));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('addOption respects maximum limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 15 }),
        fc.integer({ min: 2, max: 15 }),
        (optionCount, maxOptions) => {
          const options = Array(optionCount).fill('');
          const newOptions = addOption(options, maxOptions);
          
          if (optionCount >= maxOptions) {
            expect(newOptions.length).toBe(optionCount);
          } else {
            expect(newOptions.length).toBe(optionCount + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('removeOption respects minimum limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 5 }),
        (optionCount, minOptions) => {
          const options = Array(optionCount).fill('');
          const newOptions = removeOption(options, 0, minOptions);
          
          if (optionCount <= minOptions) {
            expect(newOptions.length).toBe(optionCount);
          } else {
            expect(newOptions.length).toBe(optionCount - 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('adjustCorrectIndexAfterRemoval maintains valid index', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.nat(),
        fc.nat(),
        (optionCount, correctSeed, removeSeed) => {
          const correctIndex = correctSeed % optionCount;
          const removeIndex = removeSeed % optionCount;
          const newLength = optionCount - 1;
          
          const adjustedIndex = adjustCorrectIndexAfterRemoval(
            correctIndex,
            removeIndex,
            newLength
          );
          
          // Adjusted index should always be valid
          expect(adjustedIndex).toBeGreaterThanOrEqual(0);
          expect(adjustedIndex).toBeLessThan(newLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Sequence of add/remove operations maintains labeling invariant', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constant({ type: 'add' as const }),
            fc.record({ type: fc.constant('remove' as const), index: fc.nat() })
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (operations) => {
          let options = ['A', 'B', 'C', 'D']; // Start with 4 options
          
          for (const op of operations) {
            if (op.type === 'add') {
              options = addOption(options, 10);
            } else {
              const removeIndex = op.index % options.length;
              options = removeOption(options, removeIndex, 2);
            }
          }
          
          // After all operations, labels should still be sequential
          const labels = getOptionLabels(options);
          for (let i = 0; i < labels.length; i++) {
            expect(labels[i]).toBe(String.fromCharCode(65 + i));
          }
          
          // Should have between 2 and 10 options
          expect(options.length).toBeGreaterThanOrEqual(2);
          expect(options.length).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
