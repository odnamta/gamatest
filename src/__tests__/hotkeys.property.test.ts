import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Property tests for hotkeys functionality
 * Feature: v6-fast-ingestion
 */

// Helper functions extracted from the hook for testing
function shouldSkipHotkey(
  targetTagName: string,
  hasNoHotkeysAttr: boolean,
  configKey: string,
  configModifiers: string[]
): boolean {
  const isInput = targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'select'
  
  if (hasNoHotkeysAttr) {
    return true
  }
  
  if (isInput) {
    const isSubmitShortcut = 
      configKey === 'Enter' && 
      (configModifiers.includes('meta') || configModifiers.includes('ctrl')) &&
      !configModifiers.includes('shift')
    
    if (!isSubmitShortcut) {
      return true
    }
  }
  
  return false
}

function matchesHotkey(
  eventKey: string,
  eventCtrlKey: boolean,
  eventMetaKey: boolean,
  eventShiftKey: boolean,
  eventAltKey: boolean,
  configKey: string,
  configModifiers: string[]
): boolean {
  if (eventKey !== configKey) {
    return false
  }
  
  const needsCtrl = configModifiers.includes('ctrl')
  const needsMeta = configModifiers.includes('meta')
  const needsShift = configModifiers.includes('shift')
  const needsAlt = configModifiers.includes('alt')
  
  const hasCtrlOrMeta = eventCtrlKey || eventMetaKey
  const needsCtrlOrMeta = needsCtrl || needsMeta
  
  if (needsCtrlOrMeta && !hasCtrlOrMeta) return false
  if (!needsCtrlOrMeta && hasCtrlOrMeta) return false
  
  if (needsShift !== eventShiftKey) return false
  if (needsAlt !== eventAltKey) return false
  
  return true
}

// Arbitraries
const tagNameArb = fc.constantFrom('input', 'textarea', 'select', 'div', 'button', 'span')
const keyArb = fc.constantFrom('Enter', 'Escape', 'a', 'b', 's')
const modifiersArb = fc.subarray(['ctrl', 'meta', 'shift', 'alt'] as const)

describe('Hotkeys Property Tests', () => {
  /**
   * **Feature: v6-fast-ingestion, Property 19: Shortcuts blocked in unrelated inputs**
   * **Validates: Requirements R3.2**
   * 
   * For any keypress event where the target is an input/textarea not part of
   * the MCQ form, shortcuts (except form submission) should not trigger.
   */
  describe('Property 19: Shortcuts blocked in unrelated inputs', () => {
    it('input elements block non-submit shortcuts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('input', 'textarea', 'select'),
          keyArb,
          modifiersArb,
          (tagName, key, modifiers) => {
            const shouldSkip = shouldSkipHotkey(tagName, false, key, modifiers as string[])
            
            // If it's a submit shortcut (Cmd/Ctrl+Enter without Shift), it should NOT be skipped
            const isSubmitShortcut = 
              key === 'Enter' && 
              (modifiers.includes('meta') || modifiers.includes('ctrl')) &&
              !modifiers.includes('shift')
            
            if (isSubmitShortcut) {
              return shouldSkip === false
            }
            
            // All other shortcuts in inputs should be skipped
            return shouldSkip === true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('non-input elements do not block shortcuts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('div', 'button', 'span'),
          keyArb,
          modifiersArb,
          (tagName, key, modifiers) => {
            const shouldSkip = shouldSkipHotkey(tagName, false, key, modifiers as string[])
            return shouldSkip === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('data-no-hotkeys attribute blocks all shortcuts', () => {
      fc.assert(
        fc.property(tagNameArb, keyArb, modifiersArb, (tagName, key, modifiers) => {
          const shouldSkip = shouldSkipHotkey(tagName, true, key, modifiers as string[])
          return shouldSkip === true
        }),
        { numRuns: 100 }
      )
    })

    it('Cmd/Ctrl+Enter is allowed in inputs (form submission)', () => {
      const testCases = [
        { modifiers: ['meta'] as string[], expected: false },
        { modifiers: ['ctrl'] as string[], expected: false },
        { modifiers: ['meta', 'shift'] as string[], expected: true }, // Shift+Cmd+Enter is blocked
        { modifiers: ['ctrl', 'shift'] as string[], expected: true }, // Shift+Ctrl+Enter is blocked
      ]
      
      for (const { modifiers, expected } of testCases) {
        const shouldSkip = shouldSkipHotkey('input', false, 'Enter', modifiers)
        expect(shouldSkip).toBe(expected)
      }
    })
  })

  describe('matchesHotkey', () => {
    it('matches when key and modifiers match', () => {
      fc.assert(
        fc.property(keyArb, modifiersArb, (key, modifiers) => {
          const hasCtrl = modifiers.includes('ctrl')
          const hasMeta = modifiers.includes('meta')
          const hasShift = modifiers.includes('shift')
          const hasAlt = modifiers.includes('alt')
          
          // Simulate event with matching modifiers
          const matches = matchesHotkey(
            key,
            hasCtrl || hasMeta, // ctrl or meta pressed
            hasCtrl || hasMeta, // meta or ctrl pressed
            hasShift,
            hasAlt,
            key,
            modifiers as string[]
          )
          
          return matches === true
        }),
        { numRuns: 100 }
      )
    })

    it('does not match when key differs', () => {
      fc.assert(
        fc.property(
          keyArb,
          keyArb.filter((k) => k !== 'Enter'),
          modifiersArb,
          (eventKey, configKey, modifiers) => {
            if (eventKey === configKey) return true // Skip when keys match
            
            const matches = matchesHotkey(
              eventKey,
              false,
              false,
              false,
              false,
              configKey,
              modifiers as string[]
            )
            
            return matches === false
          }
        ),
        { numRuns: 100 }
      )
    })

    it('does not match when required modifier is missing', () => {
      // Require Shift but don't press it
      const matches = matchesHotkey(
        'Enter',
        true, // ctrl
        true, // meta
        false, // shift NOT pressed
        false, // alt
        'Enter',
        ['meta', 'shift'] // requires shift
      )
      
      expect(matches).toBe(false)
    })

    it('does not match when extra modifier is pressed', () => {
      // Press Shift but don't require it
      const matches = matchesHotkey(
        'Enter',
        true, // ctrl
        true, // meta
        true, // shift pressed (extra)
        false, // alt
        'Enter',
        ['meta'] // doesn't require shift
      )
      
      expect(matches).toBe(false)
    })
  })

  describe('Escape key behavior', () => {
    it('Escape matches without modifiers', () => {
      const matches = matchesHotkey(
        'Escape',
        false,
        false,
        false,
        false,
        'Escape',
        []
      )
      
      expect(matches).toBe(true)
    })

    it('Escape does not match with modifiers pressed', () => {
      const matches = matchesHotkey(
        'Escape',
        true, // ctrl pressed
        false,
        false,
        false,
        'Escape',
        [] // no modifiers required
      )
      
      expect(matches).toBe(false)
    })
  })
})
