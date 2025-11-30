/**
 * PDF Text Extraction Utilities
 * V6.3: Page Scanner - Extract and clean text from PDF pages
 */

import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Extract raw text content from a specific PDF page.
 * Uses PDF.js text content API via react-pdf's document proxy.
 */
export async function extractPageText(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  if (pageNumber < 1 || pageNumber > pdfDocument.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}`)
  }

  const page = await pdfDocument.getPage(pageNumber)
  const textContent = await page.getTextContent()
  
  // Concatenate text items, preserving line breaks where items have different y positions
  let lastY: number | null = null
  const lines: string[] = []
  let currentLine = ''

  for (const item of textContent.items) {
    if ('str' in item) {
      const textItem = item as { str: string; transform: number[] }
      const y = textItem.transform[5] // Y position from transform matrix
      
      // If Y position changed significantly, start a new line
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim())
        }
        currentLine = textItem.str
      } else {
        // Same line - add space if needed
        if (currentLine && !currentLine.endsWith(' ') && !textItem.str.startsWith(' ')) {
          currentLine += ' '
        }
        currentLine += textItem.str
      }
      lastY = y
    }
  }
  
  // Don't forget the last line
  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }

  return lines.join('\n')
}

/**
 * Clean extracted page text by removing noise (headers, footers, page numbers).
 * Preserves paragraph structure for AI processing.
 */
export function cleanPageText(rawText: string): string {
  const lines = rawText.split('\n')
  
  // Filter out noise lines
  const cleanedLines = lines.filter((line, index, arr) => {
    const trimmed = line.trim()
    
    // Skip empty lines (but we'll add them back for paragraph breaks)
    if (!trimmed) return false
    
    // Skip very short lines at start/end (likely headers/footers)
    const isNearStart = index < 3
    const isNearEnd = index >= arr.length - 3
    if ((isNearStart || isNearEnd) && trimmed.length < 5) {
      return false
    }
    
    // Skip standalone page numbers
    if (/^\d+$/.test(trimmed)) {
      return false
    }
    
    // Skip common header/footer patterns
    if (/^(chapter|section|page)\s*\d+$/i.test(trimmed)) {
      return false
    }
    
    // Skip copyright lines
    if (/copyright|©|\(c\)/i.test(trimmed) && trimmed.length < 100) {
      return false
    }
    
    return true
  })

  // Join lines, collapsing multiple spaces
  let result = cleanedLines.join('\n')
  
  // Clean up excessive whitespace while preserving paragraph breaks
  result = result.replace(/\n{3,}/g, '\n\n')
  result = result.replace(/[ \t]+/g, ' ')
  
  return result.trim()
}

/**
 * Extract and clean text from a PDF page in one step.
 * Convenience function for the Page Scanner feature.
 */
export async function extractCleanPageText(
  pdfDocument: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  const rawText = await extractPageText(pdfDocument, pageNumber)
  return cleanPageText(rawText)
}
