import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { combinePageTexts, isLastPage, type PageTextEntry } from '../lib/pdf-text-extraction';

/**
 * **Feature: v6.6-scanner-polish, Property 1: Page Text Concatenation Format**
 * **Validates: Requirements 1.2, 2.3**
 * 
 * For any two page texts and their page numbers, when combined using combinePageTexts,
 * the result SHALL contain the separator `\n\n--- Page X ---\n` where X is the second page number.
 */
describe('Property 1: Page Text Concatenation Format', () => {
  test('Single page returns text without separator', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 100 }),
        (text, pageNumber) => {
          const pages: PageTextEntry[] = [{ pageNumber, text }];
          const result = combinePageTexts(pages);
          
          expect(result).toBe(text);
          expect(result).not.toContain('--- Page');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Two pages include separator with correct page number', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.integer({ min: 1, max: 50 }),
        (text1, text2, startPage) => {
          const pages: PageTextEntry[] = [
            { pageNumber: startPage, text: text1 },
            { pageNumber: startPage + 1, text: text2 },
          ];
          const result = combinePageTexts(pages);
          
          // Should contain the separator with the second page number
          const expectedSeparator = `\n\n--- Page ${startPage + 1} ---\n`;
          expect(result).toContain(expectedSeparator);
          
          // Should contain both texts
          expect(result).toContain(text1);
          expect(result).toContain(text2);
          
          // First text should come before separator
          const separatorIndex = result.indexOf(expectedSeparator);
          expect(result.indexOf(text1)).toBeLessThan(separatorIndex);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Multiple pages have separators for each subsequent page', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 1, max: 20 }),
        (texts, startPage) => {
          const pages: PageTextEntry[] = texts.map((text, index) => ({
            pageNumber: startPage + index,
            text,
          }));
          
          const result = combinePageTexts(pages);
          
          // First page should not have a separator before it
          expect(result.startsWith(`--- Page`)).toBe(false);
          
          // Each subsequent page should have a separator
          for (let i = 1; i < pages.length; i++) {
            const expectedSeparator = `--- Page ${startPage + i} ---`;
            expect(result).toContain(expectedSeparator);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Pages are sorted by page number before combining', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (text1, text2) => {
          // Use unique markers to ensure we can find each text distinctly
          const markedText1 = `[PAGE1]${text1}`;
          const markedText2 = `[PAGE2]${text2}`;
          
          // Pass pages in reverse order
          const pages: PageTextEntry[] = [
            { pageNumber: 2, text: markedText2 },
            { pageNumber: 1, text: markedText1 },
          ];
          
          const result = combinePageTexts(pages);
          
          // markedText1 (page 1) should come before markedText2 (page 2)
          const text1Index = result.indexOf(markedText1);
          const text2Index = result.indexOf(markedText2);
          expect(text1Index).toBeLessThan(text2Index);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Empty pages array returns empty string', () => {
    const result = combinePageTexts([]);
    expect(result).toBe('');
  });
});

/**
 * **Feature: v6.6-scanner-polish, Property 2: Last Page Boundary Disables Controls**
 * **Validates: Requirements 1.4, 2.4**
 * 
 * For any PDF document with N pages, when currentPage equals N,
 * both the "Append Next Page" button and "Include Next Page" checkbox SHALL be disabled.
 */
describe('Property 2: Last Page Boundary Disables Controls', () => {
  // Mock PDFDocumentProxy for testing
  const createMockPdfDocument = (numPages: number) => ({
    numPages,
  } as { numPages: number });

  test('isLastPage returns true when on last page', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (numPages) => {
          const mockDoc = createMockPdfDocument(numPages);
          
          // On the last page
          expect(isLastPage(mockDoc as unknown as Parameters<typeof isLastPage>[0], numPages)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isLastPage returns false when not on last page', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        fc.integer({ min: 1, max: 99 }),
        (numPages, currentPage) => {
          // Ensure currentPage is less than numPages
          const validCurrentPage = Math.min(currentPage, numPages - 1);
          const mockDoc = createMockPdfDocument(numPages);
          
          expect(isLastPage(mockDoc as unknown as Parameters<typeof isLastPage>[0], validCurrentPage)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isLastPage returns true when page exceeds numPages', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 10 }),
        (numPages, extra) => {
          const mockDoc = createMockPdfDocument(numPages);
          
          // Page number exceeds total pages
          expect(isLastPage(mockDoc as unknown as Parameters<typeof isLastPage>[0], numPages + extra)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
