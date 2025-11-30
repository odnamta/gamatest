/**
 * V7.0: Auto-Scan Loop Hook
 * Client-side orchestrator for automated full-document MCQ extraction.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { extractCleanPageText, combinePageTexts } from '@/lib/pdf-text-extraction'
import { draftBatchMCQFromText, bulkCreateMCQV2 } from '@/actions/batch-mcq-actions'
import { toUIFormatArray } from '@/lib/batch-mcq-schema'
import type { AIMode } from '@/lib/ai-mode-storage'

// ============================================
// Types
// ============================================

export interface AutoScanStats {
  cardsCreated: number
  pagesProcessed: number
  errorsCount: number
}

export interface SkippedPage {
  pageNumber: number
  reason: string
}

export interface AutoScanState {
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: AutoScanStats
  skippedPages: SkippedPage[]
  consecutiveErrors: number
  lastUpdated: number
}

export interface UseAutoScanOptions {
  pdfDocument: PDFDocumentProxy | null
  deckId: string
  sourceId: string
  sessionTagNames: string[]
  aiMode: AIMode
  includeNextPage: boolean
  onPageComplete?: (page: number, cardsCreated: number) => void
  onError?: (page: number, error: string) => void
  onComplete?: (stats: AutoScanStats) => void
  onSafetyStop?: () => void
}

export interface UseAutoScanReturn {
  // State
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: AutoScanStats
  skippedPages: SkippedPage[]
  hasResumableState: boolean
  
  // Controls
  startScan: (startPage?: number) => void
  pauseScan: () => void
  stopScan: () => void
  resetScan: () => void
  
  // Export
  exportLog: () => void
}

// ============================================
// Constants
// ============================================

const SCAN_DELAY_MS = 1500 // 1.5 second delay between pages
const MAX_CONSECUTIVE_ERRORS = 3

// ============================================
// localStorage Helpers
// ============================================

function getStorageKey(deckId: string, sourceId: string): string {
  return `autoscan_state_${deckId}_${sourceId}`
}

export function saveAutoScanState(
  deckId: string,
  sourceId: string,
  state: AutoScanState
): void {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(deckId, sourceId)
    localStorage.setItem(key, JSON.stringify(state))
  } catch (err) {
    console.warn('[useAutoScan] Failed to save state to localStorage:', err)
  }
}

export function loadAutoScanState(
  deckId: string,
  sourceId: string
): AutoScanState | null {
  if (typeof window === 'undefined') return null
  try {
    const key = getStorageKey(deckId, sourceId)
    const stored = localStorage.getItem(key)
    if (!stored) return null
    return JSON.parse(stored) as AutoScanState
  } catch (err) {
    console.warn('[useAutoScan] Failed to load state from localStorage:', err)
    return null
  }
}

export function clearAutoScanState(deckId: string, sourceId: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = getStorageKey(deckId, sourceId)
    localStorage.removeItem(key)
  } catch (err) {
    console.warn('[useAutoScan] Failed to clear state from localStorage:', err)
  }
}

// ============================================
// Initial State
// ============================================

function getInitialStats(): AutoScanStats {
  return {
    cardsCreated: 0,
    pagesProcessed: 0,
    errorsCount: 0,
  }
}

function getInitialState(totalPages: number): AutoScanState {
  return {
    isScanning: false,
    currentPage: 1,
    totalPages,
    stats: getInitialStats(),
    skippedPages: [],
    consecutiveErrors: 0,
    lastUpdated: Date.now(),
  }
}

// ============================================
// Hook
// ============================================

export function useAutoScan(options: UseAutoScanOptions): UseAutoScanReturn {
  const {
    pdfDocument,
    deckId,
    sourceId,
    sessionTagNames,
    aiMode,
    includeNextPage,
    onPageComplete,
    onError,
    onComplete,
    onSafetyStop,
  } = options

  const totalPages = pdfDocument?.numPages ?? 0

  // State
  const [isScanning, setIsScanning] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [stats, setStats] = useState<AutoScanStats>(getInitialStats())
  const [skippedPages, setSkippedPages] = useState<SkippedPage[]>([])
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  const [hasResumableState, setHasResumableState] = useState(false)

  // Refs for latest values in async callbacks
  const isScanningRef = useRef(isScanning)
  const currentPageRef = useRef(currentPage)
  const consecutiveErrorsRef = useRef(consecutiveErrors)
  const statsRef = useRef(stats)
  const skippedPagesRef = useRef(skippedPages)

  // Keep refs in sync
  useEffect(() => { isScanningRef.current = isScanning }, [isScanning])
  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])
  useEffect(() => { consecutiveErrorsRef.current = consecutiveErrors }, [consecutiveErrors])
  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { skippedPagesRef.current = skippedPages }, [skippedPages])

  // Persist state on changes
  const persistState = useCallback(() => {
    if (!deckId || !sourceId) return
    const state: AutoScanState = {
      isScanning: isScanningRef.current,
      currentPage: currentPageRef.current,
      totalPages,
      stats: statsRef.current,
      skippedPages: skippedPagesRef.current,
      consecutiveErrors: consecutiveErrorsRef.current,
      lastUpdated: Date.now(),
    }
    saveAutoScanState(deckId, sourceId, state)
  }, [deckId, sourceId, totalPages])

  // Persist on state changes
  useEffect(() => {
    persistState()
  }, [isScanning, currentPage, stats, skippedPages, consecutiveErrors, persistState])

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (!deckId || !sourceId) return
    const saved = loadAutoScanState(deckId, sourceId)
    if (saved && saved.isScanning) {
      // There's a resumable state
      setHasResumableState(true)
      setCurrentPage(saved.currentPage)
      setStats(saved.stats)
      setSkippedPages(saved.skippedPages)
      setConsecutiveErrors(saved.consecutiveErrors)
    }
  }, [deckId, sourceId])

  // Process a single page
  const processPage = useCallback(async (pageNumber: number, isRetry = false): Promise<boolean> => {
    if (!pdfDocument || !isScanningRef.current) return false

    try {
      // Extract text
      let text = await extractCleanPageText(pdfDocument, pageNumber)
      
      // Include next page if enabled and not on last page
      if (includeNextPage && pageNumber < totalPages) {
        const nextPageText = await extractCleanPageText(pdfDocument, pageNumber + 1)
        text = combinePageTexts([
          { pageNumber, text },
          { pageNumber: pageNumber + 1, text: nextPageText },
        ])
      }

      if (!text || text.length < 50) {
        // Skip pages with insufficient text
        return true // Not an error, just nothing to process
      }

      // Call AI draft
      const draftResult = await draftBatchMCQFromText({
        deckId,
        text,
        defaultTags: sessionTagNames,
        mode: aiMode,
      })

      if (!draftResult.ok) {
        throw new Error(draftResult.error.message || 'AI draft failed')
      }

      if (draftResult.drafts.length === 0) {
        // No MCQs found, not an error
        return true
      }

      // Convert to UI format and save
      const uiDrafts = toUIFormatArray(draftResult.drafts)
      const cards = uiDrafts.map(draft => ({
        stem: draft.stem,
        options: draft.options,
        correctIndex: draft.correctIndex,
        explanation: draft.explanation,
        tagNames: draft.tagNames,
      }))

      const saveResult = await bulkCreateMCQV2({
        deckTemplateId: deckId,
        sessionTags: sessionTagNames,
        cards,
      })

      if (!saveResult.ok) {
        throw new Error(saveResult.error.message || 'Save failed')
      }

      // Update stats
      setStats(prev => ({
        ...prev,
        cardsCreated: prev.cardsCreated + saveResult.createdCount,
        pagesProcessed: prev.pagesProcessed + 1,
      }))

      onPageComplete?.(pageNumber, saveResult.createdCount)
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      
      if (!isRetry) {
        // Retry once
        console.log(`[useAutoScan] Retrying page ${pageNumber}...`)
        return processPage(pageNumber, true)
      }

      // Retry failed, mark as skipped
      setSkippedPages(prev => [...prev, { pageNumber, reason: errorMessage }])
      setStats(prev => ({ ...prev, errorsCount: prev.errorsCount + 1 }))
      onError?.(pageNumber, errorMessage)
      return false
    }
  }, [pdfDocument, deckId, sessionTagNames, aiMode, includeNextPage, totalPages, onPageComplete, onError])

  // Main scan loop iteration
  const runScanIteration = useCallback(async () => {
    if (!isScanningRef.current) return

    const page = currentPageRef.current

    // Check if we've finished
    if (page > totalPages) {
      setIsScanning(false)
      onComplete?.(statsRef.current)
      return
    }

    const success = await processPage(page)

    if (!isScanningRef.current) return // Stopped during processing

    if (success) {
      // Reset consecutive errors on success
      setConsecutiveErrors(0)
    } else {
      // Increment consecutive errors
      const newConsecutive = consecutiveErrorsRef.current + 1
      setConsecutiveErrors(newConsecutive)

      // Safety stop after 3 consecutive errors
      if (newConsecutive >= MAX_CONSECUTIVE_ERRORS) {
        console.warn('[useAutoScan] Safety stop: 3 consecutive errors')
        setIsScanning(false)
        onSafetyStop?.()
        return
      }
    }

    // Advance to next page
    setCurrentPage(prev => prev + 1)

    // Schedule next iteration
    setTimeout(runScanIteration, SCAN_DELAY_MS)
  }, [totalPages, processPage, onComplete, onSafetyStop])

  // Start scanning
  const startScan = useCallback((startPage = 1) => {
    if (!pdfDocument || totalPages === 0) return
    
    setIsScanning(true)
    setCurrentPage(startPage)
    setHasResumableState(false)
    
    if (startPage === 1) {
      // Fresh start - reset stats
      setStats(getInitialStats())
      setSkippedPages([])
      setConsecutiveErrors(0)
    }

    // Kick off the loop
    setTimeout(runScanIteration, 100)
  }, [pdfDocument, totalPages, runScanIteration])

  // Pause scanning (preserves state)
  const pauseScan = useCallback(() => {
    setIsScanning(false)
  }, [])

  // Stop scanning (preserves stats for review)
  const stopScan = useCallback(() => {
    setIsScanning(false)
  }, [])

  // Reset all state
  const resetScan = useCallback(() => {
    setIsScanning(false)
    setCurrentPage(1)
    setStats(getInitialStats())
    setSkippedPages([])
    setConsecutiveErrors(0)
    setHasResumableState(false)
    
    if (deckId && sourceId) {
      clearAutoScanState(deckId, sourceId)
    }
  }, [deckId, sourceId])

  // Export log as JSON
  const exportLog = useCallback(() => {
    const data = {
      skippedPages,
      stats,
      timestamp: new Date().toISOString(),
      deckId,
      sourceId,
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `autoscan-log-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [skippedPages, stats, deckId, sourceId])

  return {
    // State
    isScanning,
    currentPage,
    totalPages,
    stats,
    skippedPages,
    hasResumableState,
    
    // Controls
    startScan,
    pauseScan,
    stopScan,
    resetScan,
    
    // Export
    exportLog,
  }
}
