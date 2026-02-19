import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { validatePdfFile } from '../lib/pdf-validation';

/**
 * **Feature: cekatan, Property 14: PDF Upload Validation**
 * **Validates: Requirements 8.4**
 *
 * For any file upload:
 * - If the file is not a PDF (by MIME type or extension), the upload SHALL be rejected
 * - If the file exceeds the maximum size limit, the upload SHALL be rejected
 */
describe('Property 14: PDF Upload Validation', () => {
  // Maximum file size: 50MB
  const MAX_FILE_SIZE = 50 * 1024 * 1024;

  // Valid PDF MIME type
  const VALID_MIME_TYPE = 'application/pdf';

  // Generator for valid PDF filenames
  const validPdfFilenameArb = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => !s.includes('.') && s.length > 0)
    .map(name => `${name}.pdf`);

  // Generator for invalid file extensions (non-PDF)
  const invalidExtensionArb = fc.oneof(
    fc.constant('.txt'),
    fc.constant('.doc'),
    fc.constant('.docx'),
    fc.constant('.jpg'),
    fc.constant('.png'),
    fc.constant('.exe'),
    fc.constant('.zip'),
    fc.constant('.html'),
    fc.constant('.js'),
    fc.constant('')
  );

  // Generator for invalid MIME types (non-PDF)
  const invalidMimeTypeArb = fc.oneof(
    fc.constant('text/plain'),
    fc.constant('application/msword'),
    fc.constant('image/jpeg'),
    fc.constant('image/png'),
    fc.constant('application/zip'),
    fc.constant('text/html'),
    fc.constant('application/javascript'),
    fc.constant('application/octet-stream')
  );

  // Generator for valid file sizes (within limit)
  const validFileSizeArb = fc.integer({ min: 1, max: MAX_FILE_SIZE });

  // Generator for invalid file sizes (exceeds limit)
  const invalidFileSizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 2 });

  test('rejects files with non-PDF extensions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
        invalidExtensionArb,
        validFileSizeArb,
        (baseName, extension, fileSize) => {
          const fileName = `${baseName}${extension}`;
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Only PDF files are allowed');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects files with non-PDF MIME types', () => {
    fc.assert(
      fc.property(
        validPdfFilenameArb,
        invalidMimeTypeArb,
        validFileSizeArb,
        (fileName, mimeType, fileSize) => {
          const result = validatePdfFile(fileName, mimeType, fileSize);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Only PDF files are allowed');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects files exceeding maximum size limit', () => {
    fc.assert(
      fc.property(
        validPdfFilenameArb,
        invalidFileSizeArb,
        (fileName, fileSize) => {
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize);
          
          expect(result.valid).toBe(false);
          expect(result.error).toContain('exceeds maximum size');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects empty files (size = 0)', () => {
    fc.assert(
      fc.property(
        validPdfFilenameArb,
        (fileName) => {
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, 0);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('File is empty');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('accepts valid PDF files with correct extension, MIME type, and size', () => {
    fc.assert(
      fc.property(
        validPdfFilenameArb,
        validFileSizeArb,
        (fileName, fileSize) => {
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('handles case-insensitive PDF extension', () => {
    const caseVariantExtensions = ['.PDF', '.Pdf', '.pDf', '.pdF'];
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
        fc.constantFrom(...caseVariantExtensions),
        validFileSizeArb,
        (baseName, extension, fileSize) => {
          const fileName = `${baseName}${extension}`;
          const result = validatePdfFile(fileName, VALID_MIME_TYPE, fileSize);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rejects files with both invalid extension and MIME type', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('.')),
        invalidExtensionArb,
        invalidMimeTypeArb,
        validFileSizeArb,
        (baseName, extension, mimeType, fileSize) => {
          const fileName = `${baseName}${extension}`;
          const result = validatePdfFile(fileName, mimeType, fileSize);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('Only PDF files are allowed');
        }
      ),
      { numRuns: 100 }
    );
  });
});
