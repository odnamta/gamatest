/**
 * MCQ Options Utility Functions
 * Pure functions for managing dynamic MCQ option arrays.
 * 
 * Requirements: 6.2, 6.3
 */

/**
 * Converts a zero-based index to a letter label (A, B, C, D, E, F, G, H, I, J).
 * 
 * @param index - Zero-based index (0 = A, 1 = B, etc.)
 * @returns Letter label
 * 
 * Requirements: 6.2
 */
export function getOptionLabel(index: number): string {
  if (index < 0 || index > 25) {
    return ''
  }
  return String.fromCharCode(65 + index) // 65 is ASCII for 'A'
}

/**
 * Adds a new empty option to the options array.
 * 
 * @param options - Current options array
 * @param maxOptions - Maximum allowed options (default 10)
 * @returns New options array with empty string appended, or original if at max
 * 
 * Requirements: 6.2
 */
export function addOption(options: string[], maxOptions: number = 10): string[] {
  if (options.length >= maxOptions) {
    return options
  }
  return [...options, '']
}

/**
 * Removes an option at the specified index.
 * 
 * @param options - Current options array
 * @param index - Index to remove
 * @param minOptions - Minimum required options (default 2)
 * @returns New options array with item removed, or original if at min
 * 
 * Requirements: 6.3
 */
export function removeOption(options: string[], index: number, minOptions: number = 2): string[] {
  if (options.length <= minOptions) {
    return options
  }
  if (index < 0 || index >= options.length) {
    return options
  }
  return options.filter((_, i) => i !== index)
}

/**
 * Validates that options array has correct sequential labels.
 * This is a helper for testing - actual labels are computed on render.
 * 
 * @param options - Options array
 * @returns Array of labels that would be assigned
 */
export function getOptionLabels(options: string[]): string[] {
  return options.map((_, index) => getOptionLabel(index))
}

/**
 * Adjusts the correct answer index after an option is removed.
 * 
 * @param currentCorrectIndex - Current correct answer index
 * @param removedIndex - Index of the removed option
 * @param newOptionsLength - Length of options array after removal
 * @returns Adjusted correct index
 */
export function adjustCorrectIndexAfterRemoval(
  currentCorrectIndex: number,
  removedIndex: number,
  newOptionsLength: number
): number {
  // If removed index was before correct index, shift down
  if (removedIndex < currentCorrectIndex) {
    return currentCorrectIndex - 1
  }
  // If removed index was the correct index, clamp to valid range
  if (removedIndex === currentCorrectIndex) {
    return Math.min(currentCorrectIndex, newOptionsLength - 1)
  }
  // Otherwise, no change needed
  return currentCorrectIndex
}
