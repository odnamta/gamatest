/**
 * Property-Based Tests for String Utilities
 * V9.5: Data Hygiene - Title Case formatting
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { toTitleCase, isWhitespaceOnly } from '@/lib/string-utils'

describe('toTitleCase', () => {
  /**
   * **Feature: v9.5-data-hygiene, Property 1: Title Case Formatting Correctness**
   * *For any* non-empty string input, `toTitleCase` SHALL return a string where:
   * - The first character of each word is uppercase
   * - All other characters in each word are lowercase
   * - No leading or trailing whitespace exists
   * - No consecutive spaces exist
   * **Validates: Requirements 5.1, 5.2, 5.3**
   */
  it('Property 1: Title Case Formatting Correctness', () => {
    fc.assert(
      fc.property(
        // Generate non-empty strings with at least one non-whitespace character
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (input) => {
          const result = toTitleCase(input)

          // Result should not be empty for non-whitespace input
          expect(result.length).toBeGreaterThan(0)

          // No leading or trailing whitespace
          expect(result).toBe(result.trim())

          // No consecutive spaces
          expect(result).not.toMatch(/\s{2,}/)

          // Each word should have first letter uppercase, rest lowercase
          const words = result.split(' ')
          for (const word of words) {
            if (word.length > 0) {
              // First character should be uppercase (if it's a letter)
              const firstChar = word.charAt(0)
              if (/[a-zA-Z]/.test(firstChar)) {
                expect(firstChar).toBe(firstChar.toUpperCase())
              }

              // Rest should be lowercase (if they are letters)
              const rest = word.slice(1)
              for (const char of rest) {
                if (/[a-zA-Z]/.test(char)) {
                  expect(char).toBe(char.toLowerCase())
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: v9.5-data-hygiene, Property 2: Whitespace Input Rejection**
   * *For any* string composed entirely of whitespace (including empty string),
   * `toTitleCase` SHALL return an empty string.
   * **Validates: Requirements 1.5, 2.3, 5.4**
   */
  it('Property 2: Whitespace Input Rejection', () => {
    fc.assert(
      fc.property(
        // Generate whitespace-only strings (spaces, tabs, newlines)
        fc.array(fc.constantFrom(' ', '\t', '\n', '\r')).map(arr => arr.join('')),
        (whitespaceInput) => {
          const result = toTitleCase(whitespaceInput)

          // Should return empty string for whitespace-only input
          expect(result).toBe('')
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns empty string for empty input', () => {
    expect(toTitleCase('')).toBe('')
  })

  it('handles single word correctly', () => {
    expect(toTitleCase('hello')).toBe('Hello')
    expect(toTitleCase('HELLO')).toBe('Hello')
    expect(toTitleCase('hElLo')).toBe('Hello')
  })

  it('handles multiple words correctly', () => {
    expect(toTitleCase('hello world')).toBe('Hello World')
    expect(toTitleCase('pelvic floor')).toBe('Pelvic Floor')
  })

  it('collapses multiple spaces', () => {
    expect(toTitleCase('hello   world')).toBe('Hello World')
    expect(toTitleCase('  multiple   spaces  ')).toBe('Multiple Spaces')
  })

  it('trims leading and trailing whitespace', () => {
    expect(toTitleCase('  hello  ')).toBe('Hello')
    expect(toTitleCase('\thello\n')).toBe('Hello')
  })

  it('handles numbers and special characters', () => {
    expect(toTitleCase('hello123')).toBe('Hello123')
    expect(toTitleCase('hello-world')).toBe('Hello-world')
  })
})

describe('isWhitespaceOnly', () => {
  it('returns true for empty string', () => {
    expect(isWhitespaceOnly('')).toBe(true)
  })

  it('returns true for whitespace-only strings', () => {
    expect(isWhitespaceOnly('   ')).toBe(true)
    expect(isWhitespaceOnly('\t\n')).toBe(true)
  })

  it('returns false for strings with non-whitespace characters', () => {
    expect(isWhitespaceOnly('hello')).toBe(false)
    expect(isWhitespaceOnly('  hello  ')).toBe(false)
  })
})
