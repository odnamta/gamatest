/**
 * V11: Matching Set Detector
 * 
 * Detects matching-style question blocks in source text.
 * A matching block has labeled options (A., B., C.) followed by numbered questions.
 * Validates: Requirements 8.1
 */

import type { MatchingBlock } from '@/types/database'

/**
 * Regex pattern for labeled options (A., B., C., etc.)
 */
const OPTION_LABEL_PATTERN = /^([A-Z])[.)]\s*(.+)$/gm

/**
 * Regex pattern for numbered questions in matching sets
 */
const MATCHING_QUESTION_PATTERN = /^(\d+)[.)]\s*(.+)$/gm

/**
 * Detects matching-style question blocks in the given text
 * 
 * A matching block is identified when:
 * 1. There's a contiguous set of labeled options (A., B., C., D., E.)
 * 2. Followed by numbered questions that reference those options
 * 
 * @param text - The source text to scan
 * @returns Array of detected matching blocks
 */
export function detectMatchingBlocks(text: string): MatchingBlock[] {
  const blocks: MatchingBlock[] = []
  
  // Split text into paragraphs/sections
  const sections = text.split(/\n{2,}/)
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    
    // Look for option blocks (A., B., C., etc.)
    const optionMatches = findOptionBlock(section)
    
    if (optionMatches && optionMatches.labels.length >= 2) {
      // Look for questions in the same or next section
      const questionSection = sections[i + 1] || section
      const questions = findQuestionNumbers(questionSection)
      
      if (questions.length > 0) {
        blocks.push({
          optionLabels: optionMatches.labels,
          optionTexts: optionMatches.texts,
          questionNumbers: questions,
          rawText: section + (sections[i + 1] ? '\n\n' + sections[i + 1] : ''),
        })
        
        // Skip the next section if we used it for questions
        if (sections[i + 1] && findQuestionNumbers(sections[i + 1]).length > 0) {
          i++
        }
      }
    }
  }
  
  return blocks
}

/**
 * Finds labeled options in a text section
 */
function findOptionBlock(text: string): { labels: string[]; texts: string[] } | null {
  const labels: string[] = []
  const texts: string[] = []
  
  // Reset regex
  OPTION_LABEL_PATTERN.lastIndex = 0
  
  let match: RegExpExecArray | null
  while ((match = OPTION_LABEL_PATTERN.exec(text)) !== null) {
    labels.push(match[1])
    texts.push(match[2].trim())
  }
  
  // Check if we have a valid sequence (A, B, C, ...)
  if (labels.length >= 2 && isValidOptionSequence(labels)) {
    return { labels, texts }
  }
  
  return null
}

/**
 * Checks if option labels form a valid sequence (A, B, C, ...)
 */
function isValidOptionSequence(labels: string[]): boolean {
  if (labels.length === 0) return false
  
  // Check if labels are consecutive letters starting from A
  const expectedLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, labels.length).split('')
  return labels.every((label, i) => label === expectedLabels[i])
}

/**
 * Finds question numbers in a text section
 */
function findQuestionNumbers(text: string): number[] {
  const numbers: number[] = []
  
  // Reset regex
  MATCHING_QUESTION_PATTERN.lastIndex = 0
  
  let match: RegExpExecArray | null
  while ((match = MATCHING_QUESTION_PATTERN.exec(text)) !== null) {
    const num = parseInt(match[1], 10)
    if (!isNaN(num) && num > 0) {
      numbers.push(num)
    }
  }
  
  return numbers.sort((a, b) => a - b)
}

/**
 * Checks if a text block looks like a matching set
 * 
 * @param text - Text to check
 * @returns true if the text appears to be a matching set
 */
export function isMatchingSetBlock(text: string): boolean {
  const blocks = detectMatchingBlocks(text)
  return blocks.length > 0
}

/**
 * Extracts common options from a matching block for AI prompt
 * 
 * @param block - The matching block
 * @returns Formatted options string for AI prompt
 */
export function formatMatchingOptionsForPrompt(block: MatchingBlock): string {
  return block.optionLabels
    .map((label, i) => `${label}. ${block.optionTexts[i]}`)
    .join('\n')
}

/**
 * Creates metadata for AI prompt when processing a matching block
 * 
 * @param block - The matching block
 * @returns Metadata object for AI prompt
 */
export function createMatchingBlockMetadata(block: MatchingBlock): {
  isMatchingSet: true
  commonOptions: string[]
  questionNumbers: number[]
  optionLabels: string[]
} {
  return {
    isMatchingSet: true,
    commonOptions: block.optionTexts,
    questionNumbers: block.questionNumbers,
    optionLabels: block.optionLabels,
  }
}
