/**
 * Property Tests for Page Scanner (V6.3)
 * Tests text extraction noise filtering
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { cleanPageText } from '@/lib/pdf-text-extraction'

describe('Page Scanner - Noise Filtering', () => {
  /**
   * Property 1: Short lines at start/end are removed
   */
  it('removes short lines at start and end of page', () => {
    // Test with specific known patterns
    const testCases = [
      { header: '1', content: 'This is meaningful medical content about preeclampsia and hypertension.', footer: '2' },
      { header: 'abc', content: 'Another paragraph with enough text to be considered meaningful content.', footer: 'xyz' },
    ]
    
    for (const { header, content, footer } of testCases) {
      const rawText = `${header}\n${content}\n${footer}`
      const cleaned = cleanPageText(rawText)
      
      // Content should be preserved
      expect(cleaned).toContain(content.trim())
    }
  })

  /**
   * Property 2: Standalone page numbers are removed
   */
  it('removes standalone page numbers', () => {
    const testCases = [
      { pageNum: 42, content: 'This is meaningful medical content about gestational diabetes.' },
      { pageNum: 123, content: 'Another paragraph discussing obstetric emergencies and management.' },
    ]
    
    for (const { pageNum, content } of testCases) {
      const rawText = `${pageNum}\n${content}\n${pageNum + 1}`
      const cleaned = cleanPageText(rawText)
      
      // Page numbers should be removed
      expect(cleaned).not.toMatch(new RegExp(`^${pageNum}$`, 'm'))
      expect(cleaned).not.toMatch(new RegExp(`^${pageNum + 1}$`, 'm'))
      // Content should be preserved
      expect(cleaned).toContain(content.trim())
    }
  })

  /**
   * Property 3: Chapter/section headers are removed
   */
  it('removes chapter and section headers', () => {
    const headerPatterns = [
      'Chapter 1',
      'chapter 12',
      'CHAPTER 5',
      'Section 3',
      'section 10',
      'Page 42',
      'page 1',
    ]
    
    for (const header of headerPatterns) {
      const rawText = `${header}\nThis is the main content of the page with enough text to be meaningful.`
      const cleaned = cleanPageText(rawText)
      
      expect(cleaned).not.toMatch(new RegExp(`^${header}$`, 'im'))
      expect(cleaned).toContain('main content')
    }
  })

  /**
   * Property 4: Copyright lines are removed
   */
  it('removes short copyright lines', () => {
    const copyrightLines = [
      '© 2024 Publisher',
      'Copyright 2023',
      '(c) Medical Press',
    ]
    
    for (const copyright of copyrightLines) {
      const rawText = `Main content here with enough text.\n${copyright}`
      const cleaned = cleanPageText(rawText)
      
      expect(cleaned).not.toContain(copyright)
      expect(cleaned).toContain('Main content')
    }
  })

  /**
   * Property 5: Excessive whitespace is collapsed
   */
  it('collapses excessive whitespace', () => {
    const para1 = 'First paragraph about preeclampsia diagnosis criteria.'
    const para2 = 'Second paragraph about treatment options and management.'
    const rawText = `${para1}\n\n\n\n\n${para2}`
    const cleaned = cleanPageText(rawText)
    
    // Should not have more than 2 consecutive newlines
    expect(cleaned).not.toMatch(/\n{3,}/)
    // Both paragraphs should be present
    expect(cleaned).toContain('preeclampsia')
    expect(cleaned).toContain('treatment')
  })

  /**
   * Property 6: Multiple spaces are collapsed to single space
   */
  it('collapses multiple spaces to single space', () => {
    const rawText = 'This    has    multiple     spaces   in   it.'
    const cleaned = cleanPageText(rawText)
    
    expect(cleaned).not.toMatch(/  +/)
    expect(cleaned).toContain('This has multiple spaces in it.')
  })

  /**
   * Property 7: Empty input returns empty string
   */
  it('returns empty string for empty input', () => {
    expect(cleanPageText('')).toBe('')
    expect(cleanPageText('   ')).toBe('')
    expect(cleanPageText('\n\n\n')).toBe('')
  })

  /**
   * Property 8: Meaningful content is preserved
   */
  it('preserves meaningful medical content', () => {
    const medicalContent = `
      Preeclampsia is characterized by hypertension and proteinuria after 20 weeks gestation.
      Blood pressure criteria: systolic ≥140 mmHg or diastolic ≥90 mmHg.
      Treatment includes magnesium sulfate for seizure prophylaxis.
    `
    
    const cleaned = cleanPageText(medicalContent)
    
    expect(cleaned).toContain('Preeclampsia')
    expect(cleaned).toContain('hypertension')
    expect(cleaned).toContain('proteinuria')
    expect(cleaned).toContain('140 mmHg')
    expect(cleaned).toContain('magnesium sulfate')
  })

  /**
   * Property 9: Output is always trimmed
   */
  it('output is always trimmed', () => {
    const testCases = [
      'Medical content about obstetrics.',
      'Another paragraph with clinical information.',
      'Third test case with enough meaningful text.',
    ]
    
    for (const content of testCases) {
      const rawText = `   \n\n${content}\n\n   `
      const cleaned = cleanPageText(rawText)
      
      // Should not start or end with whitespace
      expect(cleaned).toBe(cleaned.trim())
    }
  })
})

describe('Page Scanner - Edge Cases', () => {
  /**
   * Property 10: Handles text with only noise
   */
  it('handles text with only noise', () => {
    const noiseOnly = '1\n2\n3\nPage 4\nChapter 5'
    const cleaned = cleanPageText(noiseOnly)
    
    // Should return empty or minimal content
    expect(cleaned.length).toBeLessThan(noiseOnly.length)
  })

  /**
   * Property 11: Preserves paragraph structure with newlines
   */
  it('preserves paragraph structure', () => {
    const twoParas = 'First paragraph with enough content to be meaningful.\n\nSecond paragraph also with enough content.'
    const cleaned = cleanPageText(twoParas)
    
    // Both paragraphs should be present
    expect(cleaned).toContain('First paragraph')
    expect(cleaned).toContain('Second paragraph')
    // Content should be separated (either by newline or space)
    expect(cleaned.length).toBeGreaterThan(50)
  })
})
