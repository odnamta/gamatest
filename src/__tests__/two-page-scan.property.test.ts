import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { combinePageTexts, type PageTextEntry } from '../lib/pdf-text-extraction';

/**
 * **Feature: v6.6-scanner-polish, Property 3: Two-Page Scan Combines Both Pages**
 * **Validates: Requirements 2.2**
 * 
 * For any PDF document and current page P where P < numPages,
 * when "Include Next Page" is checked and Scan Page is triggered,
 * the text passed to the batch draft pipeline SHALL contain content from both page P and page P+1.
 */
describe('Property 3: Two-Page Scan Combines Both Pages', () => {
  test('Combined text contains content from both pages', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.string({ minLength: 10, maxLength: 200 }),
        fc.integer({ min: 1, max: 50 }),
        (text1, text2, pageNumber) => {
          const pages: PageTextEntry[] = [
            { pageNumber, text: text1 },
            { pageNumber: pageNumber + 1, text: text2 },
          ];
          
          const combined = combinePageTexts(pages);
          
          // Both texts should be present
          expect(combined).toContain(text1);
          expect(combined).toContain(text2);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Combined text preserves page order', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (text1, text2, pageNumber) => {
          const pages: PageTextEntry[] = [
            { pageNumber, text: text1 },
            { pageNumber: pageNumber + 1, text: text2 },
          ];
          
          const combined = combinePageTexts(pages);
          
          // First page text should appear before second page text
          const text1Index = combined.indexOf(text1);
          const text2Index = combined.indexOf(text2);
          expect(text1Index).toBeLessThan(text2Index);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Combined text includes page separator for second page', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.string({ minLength: 5, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (text1, text2, pageNumber) => {
          const pages: PageTextEntry[] = [
            { pageNumber, text: text1 },
            { pageNumber: pageNumber + 1, text: text2 },
          ];
          
          const combined = combinePageTexts(pages);
          
          // Should contain separator with second page number
          expect(combined).toContain(`--- Page ${pageNumber + 1} ---`);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Combined text length is greater than individual texts', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (text1, text2, pageNumber) => {
          const pages: PageTextEntry[] = [
            { pageNumber, text: text1 },
            { pageNumber: pageNumber + 1, text: text2 },
          ];
          
          const combined = combinePageTexts(pages);
          
          // Combined should be longer than either individual text
          expect(combined.length).toBeGreaterThan(text1.length);
          expect(combined.length).toBeGreaterThan(text2.length);
          
          // Combined should include both texts plus separator
          expect(combined.length).toBeGreaterThanOrEqual(text1.length + text2.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
