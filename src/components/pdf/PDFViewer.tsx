'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw, FileText } from 'lucide-react'
import { savePdfPage, getPdfPage } from '@/lib/pdf-state'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Only import TextLayer CSS - we disable AnnotationLayer to prevent
// visual corruption from highlight annotations in some PDFs (e.g., LANGE QnA)
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker - use unpkg CDN with exact version
// pdfjs-dist v5+ uses /build/pdf.worker.min.mjs path
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  fileUrl: string
  fileId: string
  onTextSelect?: (text: string, position: { x: number; y: number }) => void
  /** V6.3: Callback when user clicks "Scan Full Page" button */
  onScanPage?: (pdfDocument: PDFDocumentProxy, pageNumber: number) => void
  /** V6.3: Whether page scan is in progress */
  isScanning?: boolean
  /** V6.6: Include next page in scan */
  includeNextPage?: boolean
  /** V6.6: Callback when include next page changes */
  onIncludeNextPageChange?: (value: boolean) => void
  /** V6.6: Callback to append next page text */
  onAppendNextPage?: (pdfDocument: PDFDocumentProxy, nextPageNumber: number) => void
  /** V6.6: Whether append is in progress */
  isAppending?: boolean
}

/**
 * PDFViewer - Integrated PDF viewer with text selection support
 * Requirements: V5 Feature Set 2 - Req 2.1-2.4
 * V6.3: Added Page Scanner support
 * 
 * IMPORTANT: Do NOT apply global CSS to canvas elements or .react-pdf__Page.
 * The text layer alignment depends on react-pdf controlling the canvas size.
 * Use the `width` prop on <Page> for responsive sizing instead of CSS overrides.
 */
export function PDFViewer({ 
  fileUrl, 
  fileId, 
  onTextSelect,
  onScanPage,
  isScanning = false,
  includeNextPage = false,
  onIncludeNextPageChange,
  onAppendNextPage,
  isAppending = false,
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)
  const [numPages, setNumPages] = useState<number>(0)
  // Initialize to 1 to avoid hydration mismatch (localStorage only available on client)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  // V6.3: Store PDF document reference for page scanning
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null)

  // Measure container width for responsive PDF sizing
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateWidth = () => {
      // Subtract padding (16px each side) for proper fit
      const width = container.clientWidth - 32
      setContainerWidth(width > 0 ? width : undefined)
    }

    updateWidth()

    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  // Load saved page from localStorage on mount and when fileId changes
  // This runs only on client to avoid hydration mismatch
  useEffect(() => {
    const savedPage = getPdfPage(fileId)
    setPageNumber(savedPage)
  }, [fileId])

  // Reset state when fileUrl changes
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    setNumPages(0)
  }, [fileUrl])

  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    setNumPages(pdf.numPages)
    setPdfDocument(pdf)
    setIsLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    console.error('PDF load error:', err)
    setError(err.message || 'Failed to load PDF')
    setIsLoading(false)
  }, [])

  const handleRetry = useCallback(() => {
    setError(null)
    setIsLoading(true)
    setRetryKey(prev => prev + 1)
  }, [])

  const goToPrevPage = () => {
    if (pageNumber > 1) {
      const newPage = pageNumber - 1
      setPageNumber(newPage)
      savePdfPage(fileId, newPage)
    }
  }

  const goToNextPage = () => {
    if (pageNumber < numPages) {
      const newPage = pageNumber + 1
      setPageNumber(newPage)
      savePdfPage(fileId, newPage)
    }
  }

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const text = selection.toString().trim()
    if (!text) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    onTextSelect?.(text, {
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }, [onTextSelect])

  // V6.3: Handle "Scan Full Page" button click
  const handleScanPage = useCallback(() => {
    if (pdfDocument && onScanPage) {
      onScanPage(pdfDocument, pageNumber)
    }
  }, [pdfDocument, pageNumber, onScanPage])

  // V6.6: Handle "Append Next Page" button click
  const handleAppendNextPage = useCallback(() => {
    if (pdfDocument && onAppendNextPage && pageNumber < numPages) {
      onAppendNextPage(pdfDocument, pageNumber + 1)
    }
  }, [pdfDocument, pageNumber, numPages, onAppendNextPage])

  // V6.6: Check if on last page (for disabling controls)
  const isOnLastPage = pageNumber >= numPages

  // Guard: no fileUrl provided
  if (!fileUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-100 dark:bg-slate-800/50 rounded-lg">
        <AlertCircle className="w-8 h-8 text-slate-400" />
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No PDF file selected</p>
      </div>
    )
  }

  // Error state with retry
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">Cannot load PDF</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center max-w-xs">{error}</p>
        <button
          onClick={handleRetry}
          className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* PDF Document container - use ref for width measurement */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4"
        onMouseUp={handleTextSelection}
      >
        <Document
          key={retryKey}
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Loading PDF...</p>
            </div>
          }
          error={
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">Failed to load PDF</p>
              <button
                onClick={handleRetry}
                className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          }
        >
          {/* Render Page with explicit width for proper text layer alignment */}
          {!isLoading && numPages > 0 && containerWidth && (
            <Page
              pageNumber={pageNumber}
              width={containerWidth}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              loading={
                <div className="flex items-center justify-center min-h-[400px]">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              }
            />
          )}
        </Document>
      </div>

      {/* Navigation controls */}
      {!isLoading && numPages > 0 && (
        <div className="flex items-center justify-between py-3 border-t border-slate-200 dark:border-slate-700 px-2">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[100px] text-center">
              Page {pageNumber} of {numPages}
            </span>
            
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* V6.6: Append Next Page button */}
          {onAppendNextPage && (
            <button
              onClick={handleAppendNextPage}
              disabled={isAppending || !pdfDocument || isOnLastPage}
              className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              aria-label="Append next page text"
              title={isOnLastPage ? 'Already on last page' : 'Append text from next page'}
            >
              {isAppending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Appending...</span>
                </>
              ) : (
                <>
                  <span className="text-base">➕</span>
                  <span className="hidden sm:inline">Append Next</span>
                </>
              )}
            </button>
          )}

          {/* V6.3: Scan Full Page button with V6.6 Include Next Page checkbox */}
          {onScanPage && (
            <div className="flex items-center gap-2">
              {/* V6.6: Include Next Page checkbox */}
              {onIncludeNextPageChange && (
                <label 
                  className={`flex items-center gap-1.5 text-xs ${isOnLastPage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={isOnLastPage ? 'No next page available' : 'Include text from next page in scan'}
                >
                  <input
                    type="checkbox"
                    checked={includeNextPage}
                    onChange={(e) => onIncludeNextPageChange(e.target.checked)}
                    disabled={isOnLastPage}
                    className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="hidden sm:inline text-slate-600 dark:text-slate-400">+1 Page</span>
                </label>
              )}
              
              <button
                onClick={handleScanPage}
                disabled={isScanning || !pdfDocument}
                className="flex items-center gap-2 px-3 py-2 min-h-[44px] text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                aria-label="Scan full page for MCQs"
                title="Extract all text from this page and generate MCQs"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Scanning...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Scan Page</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
