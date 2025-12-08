/**
 * V11.5: Content Staging Metrics
 * Helper functions for QA metrics display during bulk import.
 * 
 * **Feature: v11.5-global-study-stabilization**
 * **Validates: Requirements 11.2, 11.3, 11.5**
 * 
 * V11.6: Added normalizeStem for duplicate detection
 * **Feature: v11.6-bulk-import-reliability**
 */

/**
 * QA metrics data structure for import sessions.
 */
export interface QAMetrics {
  detectedCount: number
  createdCount: number
  missingNumbers: number[]
}

/**
 * Formats QA metrics for display in the import UI.
 * 
 * Format: "Detected X · Created Y · Missing: Z"
 * When complete: "Detected X · Created X · Complete ✓"
 * 
 * @param metrics - The QA metrics to format
 * @returns Formatted string for display
 * 
 * **Property 15: QA Metrics Formatting**
 */
export function formatQAMetrics(metrics: QAMetrics): string {
  const { detectedCount, createdCount, missingNumbers } = metrics
  
  const detectedPart = `Detected ${detectedCount}`
  const createdPart = `Created ${createdCount}`
  
  if (missingNumbers.length === 0 && detectedCount === createdCount) {
    return `${detectedPart} · ${createdPart} · Complete ✓`
  }
  
  if (missingNumbers.length > 0) {
    const missingList = missingNumbers.slice(0, 10).join(', ')
    const suffix = missingNumbers.length > 10 ? '...' : ''
    return `${detectedPart} · ${createdPart} · Missing: ${missingList}${suffix}`
  }
  
  return `${detectedPart} · ${createdPart}`
}

/**
 * Calculates missing question numbers from detected vs created.
 * 
 * @param detectedNumbers - Array of detected question numbers
 * @param createdNumbers - Array of created question numbers
 * @returns Array of missing question numbers
 */
export function calculateMissingNumbers(
  detectedNumbers: number[],
  createdNumbers: number[]
): number[] {
  const createdSet = new Set(createdNumbers)
  return detectedNumbers.filter((n) => !createdSet.has(n)).sort((a, b) => a - b)
}

/**
 * Creates QAMetrics from detected and created question numbers.
 * 
 * @param detectedNumbers - Array of detected question numbers
 * @param createdNumbers - Array of created question numbers
 * @returns QAMetrics object
 */
export function createQAMetrics(
  detectedNumbers: number[],
  createdNumbers: number[]
): QAMetrics {
  return {
    detectedCount: detectedNumbers.length,
    createdCount: createdNumbers.length,
    missingNumbers: calculateMissingNumbers(detectedNumbers, createdNumbers),
  }
}

/**
 * Checks if QA metrics indicate a complete import.
 * 
 * @param metrics - The QA metrics to check
 * @returns true if all detected questions were created
 */
export function isImportComplete(metrics: QAMetrics): boolean {
  return (
    metrics.missingNumbers.length === 0 &&
    metrics.detectedCount === metrics.createdCount &&
    metrics.detectedCount > 0
  )
}

/**
 * V11.6: Normalizes a stem for duplicate detection.
 * Lowercase, trim, collapse whitespace. Conservative with punctuation.
 * 
 * Used for duplicate detection within same deck + import_session.
 * 
 * @param stem - The question stem to normalize
 * @returns Normalized stem string
 * 
 * **Feature: v11.6-bulk-import-reliability**
 * **Validates: Requirements 6.1**
 */
export function normalizeStem(stem: string): string {
  return stem
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Collapse whitespace
}
