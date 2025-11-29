/**
 * PDF State Persistence Helpers
 * Stores and retrieves PDF viewer state from localStorage
 * Requirements: V5 Feature Set 3 - Req 3.1-3.4
 */

const PDF_PAGE_PREFIX = 'pdf_page_'

/**
 * Save the current page number for a PDF file
 */
export function savePdfPage(fileId: string, page: number): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(`${PDF_PAGE_PREFIX}${fileId}`, String(page))
    }
  } catch {
    // localStorage unavailable, silently fail
  }
}

/**
 * Get the saved page number for a PDF file
 * Returns 1 if no saved state or localStorage unavailable
 */
export function getPdfPage(fileId: string): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(`${PDF_PAGE_PREFIX}${fileId}`)
      if (saved) {
        const page = parseInt(saved, 10)
        if (!isNaN(page) && page >= 1) {
          return page
        }
      }
    }
  } catch {
    // localStorage unavailable, return default
  }
  return 1
}

/**
 * Clear the saved page for a PDF file
 */
export function clearPdfPage(fileId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(`${PDF_PAGE_PREFIX}${fileId}`)
    }
  } catch {
    // localStorage unavailable, silently fail
  }
}

/**
 * Clear all saved PDF pages (useful for cleanup)
 */
export function clearAllPdfPages(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const keys = Object.keys(localStorage)
      for (const key of keys) {
        if (key.startsWith(PDF_PAGE_PREFIX)) {
          localStorage.removeItem(key)
        }
      }
    }
  } catch {
    // localStorage unavailable, silently fail
  }
}
