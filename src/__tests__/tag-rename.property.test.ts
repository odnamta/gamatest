/**
 * Property-Based Tests for Tag Rename and Auto-Format
 * V9.5: Data Hygiene - Rename conflict detection and auto-formatting
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { toTitleCase } from '@/lib/string-utils'

/**
 * Since renameTag and autoFormatTags are server actions that require database access,
 * we test the underlying logic through pure functions and simulate the conflict detection.
 */

// Simulate the conflict detection logic used in renameTag
function detectConflict(
  newName: string,
  existingTags: Array<{ id: string; name: string }>,
  currentTagId: string
): { conflict: true; existingTagId: string; existingTagName: string } | null {
  const trimmedName = newName.trim()
  const conflictingTag = existingTags.find(
    t => t.id !== currentTagId && t.name.toLowerCase() === trimmedName.toLowerCase()
  )
  
  if (conflictingTag) {
    return {
      conflict: true,
      existingTagId: conflictingTag.id,
      existingTagName: conflictingTag.name,
    }
  }
  return null
}

// Simulate the auto-format collision detection logic
function simulateAutoFormat(
  tags: Array<{ id: string; name: string }>
): { updated: string[]; skipped: Array<{ tagId: string; tagName: string; reason: string }> } {
  const formattedNames = new Map<string, string>()
  const skipped: Array<{ tagId: string; tagName: string; reason: string }> = []
  const updated: string[] = []

  for (const tag of tags) {
    const formatted = toTitleCase(tag.name)
    const formattedLower = formatted.toLowerCase()

    // Skip if already formatted
    if (tag.name === formatted) {
      formattedNames.set(formattedLower, tag.id)
      continue
    }

    // Check collision with existing tag
    const existingTagWithName = tags.find(
      t => t.id !== tag.id && t.name.toLowerCase() === formattedLower
    )

    if (existingTagWithName) {
      skipped.push({
        tagId: tag.id,
        tagName: tag.name,
        reason: `Would collide with existing tag "${existingTagWithName.name}"`,
      })
      continue
    }

    // Check collision with another tag being formatted
    if (formattedNames.has(formattedLower)) {
      skipped.push({
        tagId: tag.id,
        tagName: tag.name,
        reason: `Would collide after formatting`,
      })
      continue
    }

    formattedNames.set(formattedLower, tag.id)
    updated.push(tag.id)
  }

  return { updated, skipped }
}

describe('Tag Rename Conflict Detection', () => {
  /**
   * **Feature: v9.5-data-hygiene, Property 6: Rename Conflict Detection**
   * *For any* rename operation where the new name (case-insensitive) matches
   * an existing tag, the system SHALL return a conflict response containing
   * the existing tag's ID.
   * **Validates: Requirements 1.4, 2.2**
   */
  it('Property 6: Rename Conflict Detection', () => {
    fc.assert(
      fc.property(
        // Generate a list of unique tag names
        fc.array(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), { minLength: 2, maxLength: 10 }),
        fc.nat({ max: 100 }),
        (tagNames, seed) => {
          // Create unique tags
          const uniqueNames = [...new Set(tagNames.map(n => n.trim()))]
          if (uniqueNames.length < 2) return // Need at least 2 tags

          const tags = uniqueNames.map((name, i) => ({
            id: `tag-${i}`,
            name,
          }))

          // Pick a tag to rename
          const tagToRename = tags[seed % tags.length]
          
          // Pick another tag's name as the new name (guaranteed conflict)
          const otherTags = tags.filter(t => t.id !== tagToRename.id)
          if (otherTags.length === 0) return
          
          const conflictTarget = otherTags[seed % otherTags.length]
          
          // Test with exact match
          const result1 = detectConflict(conflictTarget.name, tags, tagToRename.id)
          expect(result1).not.toBeNull()
          expect(result1?.conflict).toBe(true)
          expect(result1?.existingTagId).toBe(conflictTarget.id)

          // Test with different case (should still detect conflict)
          const result2 = detectConflict(conflictTarget.name.toUpperCase(), tags, tagToRename.id)
          expect(result2).not.toBeNull()
          expect(result2?.conflict).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('returns null when no conflict exists', () => {
    const tags = [
      { id: 'tag-1', name: 'Pelvic' },
      { id: 'tag-2', name: 'Obstetrics' },
    ]

    const result = detectConflict('Gynecology', tags, 'tag-1')
    expect(result).toBeNull()
  })

  it('allows renaming to same name (no conflict with self)', () => {
    const tags = [
      { id: 'tag-1', name: 'Pelvic' },
      { id: 'tag-2', name: 'Obstetrics' },
    ]

    // Renaming tag-1 to 'Pelvic' should not conflict with itself
    // (though in practice the server action would short-circuit this)
    const result = detectConflict('Pelvic', tags, 'tag-1')
    expect(result).toBeNull()
  })
})

describe('Auto-Format Collision Detection', () => {
  /**
   * **Feature: v9.5-data-hygiene, Property 3: Collision Detection Prevents Duplicates**
   * *For any* set of tags where auto-formatting would create a name collision,
   * the `autoFormatTags` function SHALL:
   * - Skip the colliding tag
   * - Include it in the skipped list with reason
   * - Not modify the original tag name
   * **Validates: Requirements 3.3, 4.2, 4.3**
   */
  it('Property 3: Collision Detection Prevents Duplicates', () => {
    fc.assert(
      fc.property(
        // Generate pairs of tags that would collide after formatting
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (tags) => {
          const result = simulateAutoFormat(tags)

          // Verify: no two updated tags would have the same formatted name
          const updatedFormattedNames = new Set<string>()
          for (const tagId of result.updated) {
            const tag = tags.find(t => t.id === tagId)
            if (tag) {
              const formatted = toTitleCase(tag.name).toLowerCase()
              expect(updatedFormattedNames.has(formatted)).toBe(false)
              updatedFormattedNames.add(formatted)
            }
          }

          // Verify: skipped tags have reasons
          for (const skipped of result.skipped) {
            expect(skipped.reason.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * **Feature: v9.5-data-hygiene, Property 4: Auto-Format Result Completeness**
   * *For any* execution of `autoFormatTags`, the result SHALL satisfy:
   * - Every tag is either updated, skipped, or was already formatted
   * **Validates: Requirements 4.5**
   */
  it('Property 4: Auto-Format Result Completeness', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (tags) => {
          const result = simulateAutoFormat(tags)

          // Count already formatted tags
          const alreadyFormatted = tags.filter(t => t.name === toTitleCase(t.name)).length

          // Verify completeness: updated + skipped + alreadyFormatted === total
          expect(result.updated.length + result.skipped.length + alreadyFormatted).toBe(tags.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('skips tags that would collide with existing formatted tags', () => {
    const tags = [
      { id: 'tag-1', name: 'Pelvic' }, // Already formatted
      { id: 'tag-2', name: 'pelvic' }, // Would collide with tag-1
    ]

    const result = simulateAutoFormat(tags)

    expect(result.updated).not.toContain('tag-2')
    expect(result.skipped.find(s => s.tagId === 'tag-2')).toBeDefined()
  })

  it('skips second tag when two tags would format to same name', () => {
    const tags = [
      { id: 'tag-1', name: 'PELVIC FLOOR' },
      { id: 'tag-2', name: 'pelvic floor' },
    ]

    const result = simulateAutoFormat(tags)

    // Both format to "Pelvic Floor" - first one gets updated, second gets skipped
    // Actually, first one formats and gets added to map, second one collides
    expect(result.updated.length + result.skipped.length).toBe(2)
    // At least one should be skipped due to collision
    expect(result.skipped.length).toBeGreaterThanOrEqual(1)
  })
})


describe('Edit Mode State Transitions', () => {
  /**
   * **Feature: v9.5-data-hygiene, Property 5: Edit Mode State Transitions**
   * *For any* EditableTagItem component:
   * - Clicking edit icon transitions to edit mode with current name as value
   * - Pressing Escape returns to display mode with original name unchanged
   * - Pressing Enter triggers save with current input value
   * **Validates: Requirements 1.1, 1.2, 1.3**
   */

  // State machine for edit mode
  type EditState = 
    | { mode: 'display' }
    | { mode: 'editing'; value: string; originalName: string }
    | { mode: 'saving'; value: string }

  type EditEvent = 
    | { type: 'CLICK_EDIT'; tagName: string }
    | { type: 'CHANGE_VALUE'; newValue: string }
    | { type: 'PRESS_ENTER' }
    | { type: 'PRESS_ESCAPE' }
    | { type: 'BLUR' }
    | { type: 'SAVE_SUCCESS' }
    | { type: 'SAVE_ERROR' }

  function editStateReducer(state: EditState, event: EditEvent): EditState {
    switch (state.mode) {
      case 'display':
        if (event.type === 'CLICK_EDIT') {
          return { mode: 'editing', value: event.tagName, originalName: event.tagName }
        }
        return state

      case 'editing':
        switch (event.type) {
          case 'CHANGE_VALUE':
            return { ...state, value: event.newValue }
          case 'PRESS_ESCAPE':
            return { mode: 'display' }
          case 'PRESS_ENTER':
          case 'BLUR':
            return { mode: 'saving', value: state.value }
          default:
            return state
        }

      case 'saving':
        switch (event.type) {
          case 'SAVE_SUCCESS':
            return { mode: 'display' }
          case 'SAVE_ERROR':
            return { mode: 'editing', value: state.value, originalName: state.value }
          default:
            return state
        }
    }
  }

  it('Property 5: Edit Mode State Transitions', () => {
    fc.assert(
      fc.property(
        // Generate a tag name
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        // Generate a sequence of events
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant('CLICK_EDIT' as const), tagName: fc.string({ minLength: 1, maxLength: 20 }) }),
            fc.record({ type: fc.constant('CHANGE_VALUE' as const), newValue: fc.string({ maxLength: 20 }) }),
            fc.constant({ type: 'PRESS_ENTER' as const }),
            fc.constant({ type: 'PRESS_ESCAPE' as const }),
            fc.constant({ type: 'BLUR' as const }),
            fc.constant({ type: 'SAVE_SUCCESS' as const }),
            fc.constant({ type: 'SAVE_ERROR' as const })
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (initialTagName, events) => {
          let state: EditState = { mode: 'display' }

          // Process events and verify invariants
          for (const event of events) {
            // Inject tag name for CLICK_EDIT events
            const processedEvent = event.type === 'CLICK_EDIT' 
              ? { ...event, tagName: initialTagName }
              : event

            const prevState = state
            state = editStateReducer(state, processedEvent)

            // Verify state transition invariants
            if (processedEvent.type === 'CLICK_EDIT' && prevState.mode === 'display') {
              // Clicking edit should transition to editing with current name
              expect(state.mode).toBe('editing')
              if (state.mode === 'editing') {
                expect(state.value).toBe(initialTagName)
                expect(state.originalName).toBe(initialTagName)
              }
            }

            if (processedEvent.type === 'PRESS_ESCAPE' && prevState.mode === 'editing') {
              // Escape should return to display mode
              expect(state.mode).toBe('display')
            }

            if ((processedEvent.type === 'PRESS_ENTER' || processedEvent.type === 'BLUR') && prevState.mode === 'editing') {
              // Enter/blur should trigger save
              expect(state.mode).toBe('saving')
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('clicking edit enters edit mode with current tag name', () => {
    const state: EditState = { mode: 'display' }
    const newState = editStateReducer(state, { type: 'CLICK_EDIT', tagName: 'Pelvic' })
    
    expect(newState.mode).toBe('editing')
    if (newState.mode === 'editing') {
      expect(newState.value).toBe('Pelvic')
      expect(newState.originalName).toBe('Pelvic')
    }
  })

  it('pressing Escape cancels edit and returns to display', () => {
    const state: EditState = { mode: 'editing', value: 'Modified', originalName: 'Original' }
    const newState = editStateReducer(state, { type: 'PRESS_ESCAPE' })
    
    expect(newState.mode).toBe('display')
  })

  it('pressing Enter triggers save', () => {
    const state: EditState = { mode: 'editing', value: 'New Name', originalName: 'Original' }
    const newState = editStateReducer(state, { type: 'PRESS_ENTER' })
    
    expect(newState.mode).toBe('saving')
    if (newState.mode === 'saving') {
      expect(newState.value).toBe('New Name')
    }
  })
})
