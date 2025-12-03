/**
 * String Utilities
 * V9.5: Pure functions for string manipulation
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

/**
 * Convert a string to Title Case.
 * - Capitalizes the first letter of each word
 * - Lowercases all other characters
 * - Trims leading/trailing whitespace
 * - Collapses multiple spaces to single space
 * - Returns empty string for whitespace-only input
 *
 * @param input - The string to convert
 * @returns The Title Case version of the string
 *
 * @example
 * toTitleCase('pelvic floor') // 'Pelvic Floor'
 * toTitleCase('  multiple   spaces  ') // 'Multiple Spaces'
 * toTitleCase('ALREADY CAPS') // 'Already Caps'
 * toTitleCase('   ') // ''
 */
export function toTitleCase(input: string): string {
  // Trim and collapse multiple spaces
  const normalized = input.trim().replace(/\s+/g, ' ')

  // Return empty string for whitespace-only input
  if (normalized === '') {
    return ''
  }

  // Split into words, capitalize first letter of each, lowercase rest
  return normalized
    .split(' ')
    .map(word => {
      if (word.length === 0) return ''
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Check if a string is empty or contains only whitespace.
 *
 * @param input - The string to check
 * @returns True if the string is empty or whitespace-only
 */
export function isWhitespaceOnly(input: string): boolean {
  return input.trim() === ''
}
