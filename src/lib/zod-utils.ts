import type { ZodError } from 'zod'

/**
 * Format Zod validation errors into a single human-readable string.
 * Groups by field, e.g.: "email: Required; password: Must be at least 8 characters"
 */
export function formatZodErrors(error: ZodError): string {
  return error.issues
    .map(issue => `${String(issue.path[0] ?? 'input')}: ${issue.message}`)
    .join('; ')
}
