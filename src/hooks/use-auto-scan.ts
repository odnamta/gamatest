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
import {
  type AutoScanStats,
  type SkippedPage,
  type AutoScanState,
  saveAutoScanState,
  loadAutoScanState,
  clearAutoScanState,
} from '@/lib/auto-scan-storage'

// Re-export types for backwards compatibility
export type { AutoScanStats, SkippedPage, AutoScanState }
export { saveAutoScanState, loadAutoScanState, clearAutoScanState }

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
  onOffline?: () => void  // V7.1: Called when connection lost during scan
  /** V11.3: Import session ID for draft/publish workflow */
  importSessionId?: string
}

// V8.3: Page range interface for precision scanning
export interface ScanRange {
  startPage: number
  endPage: number
}

// V8.5: Options for startScan to clarify resume vs fresh start behavior
export interface StartScanOptions {
  startPage?: number
  isResuming?: boolean
}

export interface UseAutoScanReturn {
  // State
  isScanning: boolean
  currentPage: number
  totalPages: number
  stats: AutoScanStats
  skippedPages: SkippedPage[]
  hasResumableState: boolean
  canStart: boolean  // V7.1: true only when pdfDocument && deckId && sourceId are valid
  
  // Controls
  startFresh: () => void       // V7.2: Always starts from page 1, clears state
  resume: () => void           // V7.2: Continues from saved page, preserves stats
  startScan: (options?: StartScanOptions) => void  // V8.5: Updated to accept options object
  startRangeScan: (range: ScanRange) => void  // V8.3: Start scan with specific range
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
    onOffline,  // V7.1: Offline callback
    importSessionId,  // V11.3: Import session ID for draft/publish workflow
  } = options

  const totalPages = pdfDocument?.numPages ?? 0

  // State
  const [isScanning, setIsScanning] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [stats, setStats] = useState<AutoScanStats>(getInitialStats())
  const [skippedPages, setSkippedPages] = useState<SkippedPage[]>([])
  const [consecutiveErrors, setConsecutiveErrors] = useState(0)
  const [hasResumableState, setHasResumableState] = useState(false)
  // V8.3: End page for range scanning (defaults to totalPages)
  const [scanEndPage, setScanEndPage] = useState(totalPages)

  // Refs for latest values in async callbacks
  const isScanningRef = useRef(isScanning)
  const currentPageRef = useRef(currentPage)
  const consecutiveErrorsRef = useRef(consecutiveErrors)
  const statsRef = useRef(stats)
  const skippedPagesRef = useRef(skippedPages)
  const scanEndPageRef = useRef(scanEndPage)  // V8.3
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear pending timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Keep refs in sync
  useEffect(() => { isScanningRef.current = isScanning }, [isScanning])
  useEffect(() => { currentPageRef.current = currentPage }, [currentPage])
  useEffect(() => { consecutiveErrorsRef.current = consecutiveErrors }, [consecutiveErrors])
  useEffect(() => { statsRef.current = stats }, [stats])
  useEffect(() => { skippedPagesRef.current = skippedPages }, [skippedPages])
  useEffect(() => { scanEndPageRef.current = scanEndPage }, [scanEndPage])  // V8.3

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

  // V7.1: Offline detection - auto-pause when connection lost
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOffline = () => {
      if (isScanningRef.current) {
        // Connection lost, pausing scan
        setIsScanning(false)
        onOffline?.()  // V7.1: Notify page to show toast
      }
    }

    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('offline', handleOffline)
    }
  }, [onOffline])

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
        tagNames: draft.aiTags,  // V7.1: Fixed - MCQBatchDraftUI uses aiTags not tagNames
      }))

      // V11.3: Pass importSessionId for draft/publish workflow
      const saveResult = await bulkCreateMCQV2({
        deckTemplateId: deckId,
        sessionTags: sessionTagNames,
        cards,
        importSessionId,
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
        return processPage(pageNumber, true)
      }

      // Retry failed, mark as skipped
      setSkippedPages(prev => [...prev, { pageNumber, reason: errorMessage }])
      setStats(prev => ({ ...prev, errorsCount: prev.errorsCount + 1 }))
      onError?.(pageNumber, errorMessage)
      return false
    }
  }, [pdfDocument, deckId, sessionTagNames, aiMode, includeNextPage, totalPages, onPageComplete, onError, importSessionId])

  // Main scan loop iteration
  // V8.3: Updated to use scanEndPage instead of totalPages for range scanning
  const runScanIteration = useCallback(async () => {
    if (!isScanningRef.current) return

    const page = currentPageRef.current
    const endPage = scanEndPageRef.current  // V8.3: Use range end page

    // Check if we've finished
    if (page > endPage) {
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
        // Safety stop: 3 consecutive errors
        setIsScanning(false)
        onSafetyStop?.()
        return
      }
    }

    // Advance to next page
    setCurrentPage(prev => prev + 1)
    
    // V8.4: Persist state synchronously BEFORE scheduling next iteration
    // This ensures currentPage is saved immediately after successful processing
    // React's batched updates may delay the useEffect-based persist, so we call it explicitly
    currentPageRef.current = currentPageRef.current + 1
    persistState()

    // Schedule next iteration
    timeoutRef.current = setTimeout(runScanIteration, SCAN_DELAY_MS)
  }, [processPage, onComplete, onSafetyStop, persistState])

  // V7.2: Start fresh - always starts from page 1, clears all state
  const startFresh = useCallback(() => {
    if (!pdfDocument || totalPages === 0) return
    
    // Clear localStorage state
    if (deckId && sourceId) {
      clearAutoScanState(deckId, sourceId)
    }
    
    // Reset all state to initial values
    setCurrentPage(1)
    setStats(getInitialStats())
    setSkippedPages([])
    setConsecutiveErrors(0)
    setHasResumableState(false)
    setIsScanning(true)
    
    // Kick off the loop
    timeoutRef.current = setTimeout(runScanIteration, 100)
  }, [pdfDocument, totalPages, deckId, sourceId, runScanIteration])

  // V8.5: Start scanning with explicit isResuming flag
  // - isResuming === true: Use saved currentPage from state, preserve stats
  // - isResuming === false or undefined: Use startPage or default to 1, reset stats
  // V8.6: Added defensive localStorage check for resume mode
  const startScan = useCallback((options?: StartScanOptions) => {
    if (!pdfDocument || totalPages === 0) return
    
    const { startPage, isResuming } = options ?? {}
    
    // V8.5: Explicit isResuming flag determines behavior
    if (isResuming === true) {
      // V8.6: Defensive check - verify saved state exists before resuming
      const saved = loadAutoScanState(deckId, sourceId)
      if (!saved || !saved.isScanning) {
        // No valid saved state for resume, falling back to startFresh
        // Fall back to fresh start
        if (deckId && sourceId) {
          clearAutoScanState(deckId, sourceId)
        }
        setCurrentPage(1)
        setStats(getInitialStats())
        setSkippedPages([])
        setConsecutiveErrors(0)
        setHasResumableState(false)
        setIsScanning(true)
        setScanEndPage(totalPages)
        // V8.6: Sync refs before loop starts
        isScanningRef.current = true
        currentPageRef.current = 1
        timeoutRef.current = setTimeout(runScanIteration, 100)
        return
      }
      
      // Resume mode: Use saved currentPage, preserve stats
      // V8.6: Sync refs BEFORE setTimeout to prevent race conditions
      isScanningRef.current = true
      currentPageRef.current = saved.currentPage
      setIsScanning(true)
      setScanEndPage(totalPages)
      setHasResumableState(false)
      // Keep currentPage, stats, skippedPages, consecutiveErrors at their current values
    } else {
      // Fresh start mode: Use startPage or default to 1, reset stats
      const effectiveStartPage = startPage ?? 1

      // Clear localStorage state for fresh start
      if (deckId && sourceId) {
        clearAutoScanState(deckId, sourceId)
      }
      
      setIsScanning(true)
      setCurrentPage(effectiveStartPage)
      setScanEndPage(totalPages)
      setHasResumableState(false)
      setStats(getInitialStats())
      setSkippedPages([])
      setConsecutiveErrors(0)
      // V8.6: Sync refs before loop starts
      isScanningRef.current = true
      currentPageRef.current = effectiveStartPage
    }

    // Kick off the loop
    timeoutRef.current = setTimeout(runScanIteration, 100)
  }, [pdfDocument, totalPages, deckId, sourceId, runScanIteration])

  // V7.2: Resume - continues from saved page, preserves stats
  // V8.5: Now delegates to startScan with isResuming: true
  const resume = useCallback(() => {
    if (!pdfDocument || totalPages === 0) return
    
    // If no saved state, fall back to startFresh
    if (!hasResumableState) {
      startFresh()
      return
    }
    
    // V8.5: Delegate to startScan with explicit isResuming flag
    startScan({ isResuming: true })
  }, [pdfDocument, totalPages, hasResumableState, startFresh, startScan])

  // V8.3: Start scanning with specific page range
  const startRangeScan = useCallback((range: ScanRange) => {
    if (!pdfDocument || totalPages === 0) return
    
    // Validate range
    if (range.startPage < 1 || range.endPage > totalPages || range.startPage > range.endPage) {
      // Invalid range — skip
      return
    }
    
    // Clear localStorage state for fresh range scan
    if (deckId && sourceId) {
      clearAutoScanState(deckId, sourceId)
    }
    
    // Set up range scan
    setCurrentPage(range.startPage)
    setScanEndPage(range.endPage)
    setStats(getInitialStats())
    setSkippedPages([])
    setConsecutiveErrors(0)
    setHasResumableState(false)
    setIsScanning(true)
    
    // Kick off the loop
    timeoutRef.current = setTimeout(runScanIteration, 100)
  }, [pdfDocument, totalPages, deckId, sourceId, runScanIteration])

  // V7.2: Pause scanning - preserves state and persists immediately
  const pauseScan = useCallback(() => {
    setIsScanning(false)
    // V7.2: Persist state immediately so resume point is accurate
    // V8.4: Update ref before persist to ensure isScanning=false is saved
    isScanningRef.current = false
    persistState()
  }, [persistState])

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

  // V7.1: Compute canStart - prevents scan when IDs are missing
  const canStart = !!(pdfDocument && deckId && sourceId)

  return {
    // State
    isScanning,
    currentPage,
    totalPages,
    stats,
    skippedPages,
    hasResumableState,
    canStart,  // V7.1: true only when pdfDocument && deckId && sourceId are valid
    
    // Controls
    startFresh,  // V7.2: Always starts from page 1, clears state
    resume,      // V7.2: Continues from saved page, preserves stats
    startScan,   // Kept for backwards compatibility
    startRangeScan,  // V8.3: Start scan with specific range
    pauseScan,
    stopScan,
    resetScan,
    
    // Export
    exportLog,
  }
}
