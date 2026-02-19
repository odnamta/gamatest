/**
 * V11.1: Import Context Storage
 * 
 * Persists import session context (book source, chapter, session tags) in localStorage.
 * Context is scoped to deck ID to prevent cross-deck pollution.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

export interface ImportContext {
  bookSourceId: string | null
  chapterId: string | null
  sessionTagIds: string[]
}

const STORAGE_KEY_PREFIX = 'cekatan:import-context:'

/**
 * Get the localStorage key for a deck's import context
 */
export function getStorageKey(deckId: string): string {
  return `${STORAGE_KEY_PREFIX}${deckId}`
}

/**
 * Get the import context for a deck from localStorage
 * Returns default empty context if not found or on error
 */
export function getImportContext(deckId: string): ImportContext {
  if (typeof window === 'undefined') {
    return { bookSourceId: null, chapterId: null, sessionTagIds: [] }
  }

  try {
    const key = getStorageKey(deckId)
    const stored = localStorage.getItem(key)
    if (!stored) {
      return { bookSourceId: null, chapterId: null, sessionTagIds: [] }
    }
    
    const parsed = JSON.parse(stored)
    
    // Validate structure
    return {
      bookSourceId: typeof parsed.bookSourceId === 'string' ? parsed.bookSourceId : null,
      chapterId: typeof parsed.chapterId === 'string' ? parsed.chapterId : null,
      sessionTagIds: Array.isArray(parsed.sessionTagIds) ? parsed.sessionTagIds : [],
    }
  } catch (error) {
    console.warn('Failed to parse import context from localStorage:', error)
    return { bookSourceId: null, chapterId: null, sessionTagIds: [] }
  }
}

/**
 * Set the import context for a deck in localStorage
 */
export function setImportContext(deckId: string, context: ImportContext): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = getStorageKey(deckId)
    localStorage.setItem(key, JSON.stringify(context))
  } catch (error) {
    console.warn('Failed to save import context to localStorage:', error)
  }
}

/**
 * Update a single field in the import context
 */
export function updateImportContext(
  deckId: string,
  updates: Partial<ImportContext>
): void {
  const current = getImportContext(deckId)
  setImportContext(deckId, { ...current, ...updates })
}

/**
 * Clear the import context for a deck
 */
export function clearImportContext(deckId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const key = getStorageKey(deckId)
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Failed to clear import context from localStorage:', error)
  }
}

/**
 * Clear all import contexts (useful for testing or reset)
 */
export function clearAllImportContexts(): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear all import contexts:', error)
  }
}
