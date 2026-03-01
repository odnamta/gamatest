/**
 * V12: MCQ Quality Scanner
 * 
 * Pure TypeScript module for regex-based analysis of raw MCQ text chunks.
 * Compares source text structure vs AI-generated drafts to detect discrepancies.
 * 
 * **Feature: v12-quality-scanner-unified-editor**
 * **Requirements: FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5**
 * 
 * CONSTRAINTS:
 * - Pure module: NO React, NO Supabase imports
 * - Advisory only: Never blocks draft creation
 * - Fail soft: Returns empty result on errors, never throws
 */

import { logger } from '@/lib/logger'

// ============================================
// Type Definitions
// ============================================

/**
 * Issue severity levels for quality problems
 */
export type MCQIssueSeverity = 'low' | 'medium' | 'high'

/**
 * Issue codes for categorizing quality problems
 */
export type MCQIssueCode =
  | 'MISSING_OPTIONS'
  | 'EXTRA_OPTIONS'
  | 'MISSING_QUESTIONS'
  | 'UNUSUAL_FORMAT'

/**
 * Single issue descriptor
 */
export interface MCQIssue {
  code: MCQIssueCode
  severity: MCQIssueSeverity
  message: string
}

/**
 * Per-question scan result
 */
export interface ScannedQuestion {
  index: number
  rawText: string
  rawOptionLetters: string[]
  rawOptionCount: number
  issues: MCQIssue[]
}

/**
 * Full scan result for a text chunk
 */
export interface QualityScanResult {
  rawQuestionCount: number
  questions: ScannedQuestion[]
  globalIssues: MCQIssue[]
}

// ============================================
// Regex Patterns (Lange-style priority)
// ============================================

/**
 * Question detection patterns
 * Matches: "1.", "2)", "3 )", "Q1.", "Q2)"
 */
const QUESTION_PATTERNS = [
  /^(\d+)[).]\s*/gm,        // "1.", "2)", "3 )"
  /^Q(\d+)[).]?\s*/gim,     // "Q1.", "Q2)", "Q3"
]

/**
 * Option detection patterns
 * Matches: "A.", "B)", "(A)", "(B)", lowercase variants
 */
const OPTION_PATTERNS = [
  /^([A-E])[).]\s+/gm,      // "A.", "B)", "C )"
  /^\(([A-E])\)\s+/gm,      // "(A)", "(B)"
  /^([a-e])[).]\s+/gm,      // "a.", "b)" (lowercase)
  /^\(([a-e])\)\s+/gm,      // "(a)", "(b)" (lowercase)
]

// ============================================
// Core Scanner Functions
// ============================================

/**
 * Detects question boundaries in text using regex patterns.
 * Returns array of { index, startPos, number } for each detected question.
 */
function detectQuestionBoundaries(text: string): Array<{ index: number; startPos: number; questionNumber: number }> {
  const boundaries: Array<{ index: number; startPos: number; questionNumber: number }> = []
  const seenPositions = new Set<number>()

  for (const pattern of QUESTION_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const startPos = match.index
      // Avoid duplicates from overlapping patterns
      if (!seenPositions.has(startPos)) {
        seenPositions.add(startPos)
        const questionNumber = parseInt(match[1], 10)
        boundaries.push({ index: boundaries.length, startPos, questionNumber })
      }
    }
  }

  // Sort by position in text
  boundaries.sort((a, b) => a.startPos - b.startPos)
  
  // Re-index after sorting
  return boundaries.map((b, i) => ({ ...b, index: i }))
}

/**
 * Extracts option letters from a text segment.
 * Returns array of detected option letters (uppercase).
 */
function extractOptionLetters(text: string): string[] {
  const letters: string[] = []
  const seenLetters = new Set<string>()

  for (const pattern of OPTION_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const letter = match[1].toUpperCase()
      if (!seenLetters.has(letter)) {
        seenLetters.add(letter)
        letters.push(letter)
      }
    }
  }

  // Sort alphabetically
  return letters.sort()
}

/**
 * Main scanner function: analyzes raw MCQ text chunk.
 * 
 * @param text - Raw text chunk to scan
 * @returns QualityScanResult with detected questions and options
 * 
 * **Requirements: FR-1.2, FR-1.3, FR-1.4**
 */
export function scanChunkForQuestionsAndOptions(text: string): QualityScanResult {
  // Fail soft: return empty result for invalid input
  if (!text || typeof text !== 'string') {
    return {
      rawQuestionCount: 0,
      questions: [],
      globalIssues: [],
    }
  }

  try {
    const boundaries = detectQuestionBoundaries(text)
    const questions: ScannedQuestion[] = []

    for (let i = 0; i < boundaries.length; i++) {
      const current = boundaries[i]
      const next = boundaries[i + 1]
      
      // Extract text segment for this question
      const startPos = current.startPos
      const endPos = next ? next.startPos : text.length
      const rawText = text.slice(startPos, endPos).trim()

      // Extract options from this segment
      const rawOptionLetters = extractOptionLetters(rawText)
      const rawOptionCount = rawOptionLetters.length

      questions.push({
        index: i,
        rawText,
        rawOptionLetters,
        rawOptionCount,
        issues: [], // Issues populated during comparison phase
      })
    }

    return {
      rawQuestionCount: questions.length,
      questions,
      globalIssues: [],
    }
  } catch (error) {
    // Fail soft: log and return empty result
    // Fail soft: structured log instead of bare console
    logger.warn('mcqQualityScanner.scanFailed', 'Scan failed, returning empty result')
    return {
      rawQuestionCount: 0,
      questions: [],
      globalIssues: [],
    }
  }
}

// ============================================
// Comparison Functions
// ============================================

/**
 * Compares scan result with AI drafts to derive quality issues.
 * 
 * @param scanResult - Result from scanChunkForQuestionsAndOptions
 * @param aiDraftCount - Number of drafts returned by AI
 * @param aiDraftOptionCounts - Array of option counts per AI draft
 * @returns Updated scan result with issues populated
 * 
 * **Requirements: FR-2.1, FR-2.2, FR-2.3**
 */
export function compareWithAIDrafts(
  scanResult: QualityScanResult,
  aiDraftCount: number,
  aiDraftOptionCounts: number[]
): QualityScanResult {
  const globalIssues: MCQIssue[] = []
  const updatedQuestions = [...scanResult.questions]

  // Check for missing questions (high severity)
  if (scanResult.rawQuestionCount > aiDraftCount) {
    const missing = scanResult.rawQuestionCount - aiDraftCount
    globalIssues.push({
      code: 'MISSING_QUESTIONS',
      severity: 'high',
      message: `Detected ${scanResult.rawQuestionCount} questions in source, but AI created only ${aiDraftCount} drafts (${missing} missing)`,
    })
  }

  // Compare options per question (best-effort index alignment)
  const compareCount = Math.min(updatedQuestions.length, aiDraftOptionCounts.length)
  
  for (let i = 0; i < compareCount; i++) {
    const question = updatedQuestions[i]
    const aiOptionCount = aiDraftOptionCounts[i]
    const rawOptionCount = question.rawOptionCount

    if (rawOptionCount > aiOptionCount) {
      // Missing options (high severity)
      question.issues.push({
        code: 'MISSING_OPTIONS',
        severity: 'high',
        message: `Source has ${rawOptionCount} options, AI draft has ${aiOptionCount} (${rawOptionCount - aiOptionCount} missing)`,
      })
    } else if (rawOptionCount < aiOptionCount && rawOptionCount > 0) {
      // Extra options (medium severity) - only flag if we detected some options
      question.issues.push({
        code: 'EXTRA_OPTIONS',
        severity: 'medium',
        message: `Source has ${rawOptionCount} options, AI draft has ${aiOptionCount} (${aiOptionCount - rawOptionCount} extra)`,
      })
    }
  }

  return {
    ...scanResult,
    questions: updatedQuestions,
    globalIssues,
  }
}

/**
 * Extracts issues for a specific draft index.
 * Returns empty array if index is out of bounds.
 */
export function getIssuesForDraft(
  scanResult: QualityScanResult,
  draftIndex: number
): MCQIssue[] {
  const issues: MCQIssue[] = []

  // Add global issues to first draft only
  if (draftIndex === 0) {
    issues.push(...scanResult.globalIssues)
  }

  // Add per-question issues if available
  const question = scanResult.questions[draftIndex]
  if (question) {
    issues.push(...question.issues)
  }

  return issues
}

/**
 * Checks if a scan result has any high-severity issues.
 */
export function hasHighSeverityIssues(scanResult: QualityScanResult): boolean {
  if (scanResult.globalIssues.some(i => i.severity === 'high')) {
    return true
  }
  return scanResult.questions.some(q => q.issues.some(i => i.severity === 'high'))
}

/**
 * Counts total issues by severity.
 */
export function countIssuesBySeverity(
  scanResult: QualityScanResult
): { high: number; medium: number; low: number } {
  const counts = { high: 0, medium: 0, low: 0 }

  for (const issue of scanResult.globalIssues) {
    counts[issue.severity]++
  }

  for (const question of scanResult.questions) {
    for (const issue of question.issues) {
      counts[issue.severity]++
    }
  }

  return counts
}
