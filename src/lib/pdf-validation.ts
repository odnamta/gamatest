import { z } from 'zod'

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024

// Allowed MIME types for PDF
const ALLOWED_MIME_TYPES = ['application/pdf']

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.pdf']

// Validation schema for source creation
export const createSourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  deckId: z.string().uuid('Invalid deck ID').optional(),
})

export type CreateSourceInput = z.infer<typeof createSourceSchema>

/**
 * Validates that a file is a PDF based on MIME type and extension.
 * Requirements: 8.4
 */
export function validatePdfFile(
  fileName: string,
  mimeType: string,
  fileSize: number
): { valid: boolean; error?: string } {
  // Check file extension
  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'Only PDF files are allowed' }
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: 'Only PDF files are allowed' }
  }

  // Check file size
  if (fileSize > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)} MB` }
  }

  if (fileSize <= 0) {
    return { valid: false, error: 'File is empty' }
  }

  return { valid: true }
}
