/**
 * V11: Question Number Detector
 * 
 * Detects question numbering patterns in source text for QA validation.
 * Validates: Requirements 7.1
 */

import type { QuestionNumberDetectionResult } from '@/types/database'

/**
 * Regex patterns for detecting question numbers
 */
const QUESTION_PATTERNS = [
  // Pattern: "1." "2." "3." (period-terminated at start of line or after whitespace)
  { pattern: /(?:^|\s)(\d+)\.\s/gm, name: 'period' },
  // Pattern: "1)" "2)" "3)" (parenthesis-terminated)
  { pattern: /(?:^|\s)(\d+)\)\s/gm, name: 'parenthesis' },
  // Pattern: "Q1" "Q2" "Q3" (Q-prefixed)
  { pattern: /\bQ(\d+)\b/gi, name: 'Q-prefix' },
  // Pattern: "Question 1" "Question 2" (word-prefixed)
  { pattern: /\bQuestion\s+(\d+)\b/gi, name: 'Question-prefix' },
]

/**
 * Detects question numbers in the given text
 * 
 * @param text - The source text to scan
 * @returns Detection result with found numbers and patterns used
 */
export function detectQuestionNumbers(text: string): QuestionNumberDetectionResult {
  const detectedNumbers = new Set<number>()
  const patternsFound = new Set<string>()

  for (const { pattern, name } of QUESTION_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0
    
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const num = parseInt(match[1], 10)
      if (!isNaN(num) && num > 0) {
        detectedNumbers.add(num)
        patternsFound.add(name)
      }
    }
  }

  // Sort numbers for consistent output
  const sortedNumbers = Array.from(detectedNumbers).sort((a, b) => a - b)

  return {
    detectedNumbers: sortedNumbers,
    patterns: Array.from(patternsFound),
  }
}

/**
 * Calculates missing question numbers by comparing detected vs saved
 * 
 * @param detected - Question numbers detected in source text
 * @param saved - Question numbers actually saved to database
 * @returns Array of missing question numbers (detected but not saved)
 */
export function calculateMissingNumbers(
  detected: number[],
  saved: number[]
): number[] {
  const savedSet = new Set(saved)
  return detected.filter(num => !savedSet.has(num)).sort((a, b) => a - b)
}

/**
 * Generates a sequence of expected question numbers
 * Useful when source has sequential numbering
 * 
 * @param start - Starting number (default 1)
 * @param count - Number of questions expected
 * @returns Array of sequential numbers
 */
export function generateExpectedSequence(count: number, start = 1): number[] {
  return Array.from({ length: count }, (_, i) => start + i)
}

/**
 * Finds gaps in a sequence of question numbers
 * 
 * @param numbers - Array of question numbers
 * @returns Array of missing numbers in the sequence
 */
export function findSequenceGaps(numbers: number[]): number[] {
  if (numbers.length === 0) return []
  
  const sorted = [...numbers].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const gaps: number[] = []
  
  const numberSet = new Set(sorted)
  for (let i = min; i <= max; i++) {
    if (!numberSet.has(i)) {
      gaps.push(i)
    }
  }
  
  return gaps
}
