import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { mcqDraftSchema } from '../lib/mcq-draft-schema';

/**
 * **Feature: v6.6-scanner-polish, Property 5: Single Draft Includes Tags**
 * **Validates: Requirements 7.1**
 * 
 * For any successful call to draftMCQFromText, the returned draft object
 * SHALL include a `tags` array (possibly empty) using the same format as batch drafts.
 */
describe('Property 5: Single Draft Includes Tags', () => {
  test('mcqDraftSchema accepts drafts with tags array', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 3 }),
        (stem, options, correctIndex, explanation, tags) => {
          // Ensure correctIndex is valid for the options array
          const validCorrectIndex = Math.min(correctIndex, options.length - 1);
          
          const draft = {
            stem,
            options,
            correct_index: validCorrectIndex,
            explanation,
            tags,
          };
          
          const result = mcqDraftSchema.safeParse(draft);
          expect(result.success).toBe(true);
          
          if (result.success) {
            expect(result.data.tags).toEqual(tags);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('mcqDraftSchema accepts drafts without tags (optional field)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 0, max: 4 }),
        fc.string({ minLength: 10, maxLength: 200 }),
        (stem, options, correctIndex, explanation) => {
          const validCorrectIndex = Math.min(correctIndex, options.length - 1);
          
          const draft = {
            stem,
            options,
            correct_index: validCorrectIndex,
            explanation,
            // No tags field
          };
          
          const result = mcqDraftSchema.safeParse(draft);
          expect(result.success).toBe(true);
          
          if (result.success) {
            expect(result.data.tags).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('mcqDraftSchema accepts empty tags array', () => {
    const draft = {
      stem: 'What is the most common cause of postpartum hemorrhage?',
      options: ['Uterine atony', 'Retained placenta', 'Cervical laceration', 'Coagulopathy'],
      correct_index: 0,
      explanation: 'Uterine atony is the most common cause, accounting for 70-80% of cases.',
      tags: [],
    };
    
    const result = mcqDraftSchema.safeParse(draft);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  test('Tags array preserves order and content', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 3 }),
        (tags) => {
          const draft = {
            stem: 'Test question stem for property testing',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correct_index: 0,
            explanation: 'Test explanation for the correct answer',
            tags,
          };
          
          const result = mcqDraftSchema.safeParse(draft);
          expect(result.success).toBe(true);
          
          if (result.success) {
            expect(result.data.tags).toEqual(tags);
            expect(result.data.tags?.length).toBe(tags.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Schema allows 2-5 options (V6.6 flexibility)', () => {
    // Test with 2 options
    const draft2 = {
      stem: 'Is this a yes or no question?',
      options: ['Yes', 'No'],
      correct_index: 0,
      explanation: 'The answer is yes because...',
      tags: ['BinaryQuestion'],
    };
    expect(mcqDraftSchema.safeParse(draft2).success).toBe(true);

    // Test with 5 options
    const draft5 = {
      stem: 'Which of the following is correct?',
      options: ['A', 'B', 'C', 'D', 'E'],
      correct_index: 2,
      explanation: 'C is correct because...',
      tags: ['MultipleChoice'],
    };
    expect(mcqDraftSchema.safeParse(draft5).success).toBe(true);

    // Test with 1 option (should fail)
    const draft1 = {
      stem: 'Only one option?',
      options: ['Only'],
      correct_index: 0,
      explanation: 'This should fail validation',
      tags: [],
    };
    expect(mcqDraftSchema.safeParse(draft1).success).toBe(false);

    // Test with 6 options (should fail)
    const draft6 = {
      stem: 'Too many options?',
      options: ['A', 'B', 'C', 'D', 'E', 'F'],
      correct_index: 0,
      explanation: 'This should fail validation',
      tags: [],
    };
    expect(mcqDraftSchema.safeParse(draft6).success).toBe(false);
  });
});
