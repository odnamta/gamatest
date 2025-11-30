import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { mergeTagsWithDeduplication, hasTagDuplicates } from '../lib/tag-utils';

/**
 * **Feature: v6.6-scanner-polish, Property 6: Tag Deduplication is Case-Insensitive**
 * **Validates: Requirements 7.3**
 * 
 * For any set of session tags and AI tags, when merged,
 * the result SHALL contain no case-insensitive duplicates
 * (e.g., "Preeclampsia" and "preeclampsia" should not both appear).
 */
describe('Property 6: Tag Deduplication is Case-Insensitive', () => {
  test('Merged tags have no case-insensitive duplicates', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
        (sessionTags, aiTags) => {
          const merged = mergeTagsWithDeduplication(sessionTags, aiTags);
          
          // Check for case-insensitive duplicates in result
          const lowerTags = merged.map(t => t.toLowerCase());
          const uniqueLower = new Set(lowerTags);
          
          expect(lowerTags.length).toBe(uniqueLower.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Session tags take precedence over AI tags', () => {
    fc.assert(
      fc.property(
        // Use alphanumeric strings to avoid whitespace-only edge cases
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/),
        (tagBase) => {
          // Create session tag with one casing
          const sessionTag = tagBase.charAt(0).toUpperCase() + tagBase.slice(1).toLowerCase();
          // Create AI tag with different casing
          const aiTag = tagBase.toLowerCase();
          
          const merged = mergeTagsWithDeduplication([sessionTag], [aiTag]);
          
          // Should only have one tag
          expect(merged.length).toBe(1);
          // Should preserve session tag casing
          expect(merged[0]).toBe(sessionTag);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('All session tags are preserved', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        (sessionTags, aiTags) => {
          // Deduplicate session tags first
          const uniqueSessionTags = [...new Set(sessionTags.map(t => t.trim()).filter(t => t))];
          const uniqueSessionLower = [...new Set(uniqueSessionTags.map(t => t.toLowerCase()))];
          
          const merged = mergeTagsWithDeduplication(sessionTags, aiTags);
          
          // All unique session tags should be in result
          for (const tag of uniqueSessionLower) {
            const found = merged.some(m => m.toLowerCase() === tag);
            expect(found).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('AI tags not in session are added', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 3 }),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
        (sessionTags, aiTags) => {
          const merged = mergeTagsWithDeduplication(sessionTags, aiTags);
          const sessionLower = new Set(sessionTags.map(t => t.trim().toLowerCase()).filter(t => t));
          
          // AI tags not in session should be in result
          for (const aiTag of aiTags) {
            const trimmed = aiTag.trim();
            if (trimmed && !sessionLower.has(trimmed.toLowerCase())) {
              const found = merged.some(m => m.toLowerCase() === trimmed.toLowerCase());
              expect(found).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Empty arrays return empty result', () => {
    const merged = mergeTagsWithDeduplication([], []);
    expect(merged).toEqual([]);
  });

  test('Whitespace-only tags are filtered out', () => {
    const merged = mergeTagsWithDeduplication(['  ', '\t'], ['   ', '\n']);
    expect(merged).toEqual([]);
  });

  test('hasTagDuplicates detects case-insensitive duplicates', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (tag) => {
          const upper = tag.toUpperCase();
          const lower = tag.toLowerCase();
          
          // Same tag with different casing should be detected as duplicate
          expect(hasTagDuplicates([upper], [lower])).toBe(true);
          expect(hasTagDuplicates([lower], [upper])).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('hasTagDuplicates returns false for distinct tags', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (tag1, tag2) => {
          // Only test when tags are actually different
          if (tag1.toLowerCase() !== tag2.toLowerCase()) {
            expect(hasTagDuplicates([tag1], [tag2])).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
