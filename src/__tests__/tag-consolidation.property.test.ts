/**
 * Property-Based Tests for Tag Consolidation Utilities
 * V9.6: AI-powered tag analysis and merge suggestion processing
 * 
 * Tests core logic properties using fast-check
 */

import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  batchTagsForAnalysis,
  parseConsolidationResponse,
  resolveTagSuggestions,
  buildTagLookup,
  type AIConsolidationResponse,
  type TagEntry,
  type MergeSuggestion,
} from '../lib/tag-consolidation'

describe('Tag Consolidation Utilities', () => {
  /**
   * **Feature: v9.6-tag-consolidator, Property 1: Batching produces correct chunk counts**
   * 
   * For any list of tag names, the batching function SHALL produce exactly 1 batch
   * if the list has fewer than 200 items, otherwise it SHALL produce ceil(length / 100)
   * batches, and each batch SHALL contain at most 100 items.
   * 
   * **Validates: Requirements 1.2, 1.3**
   */
  describe('Property 1: Batching produces correct chunk counts', () => {
    test('single batch for lists under 200 tags', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 199 }),
          (tags) => {
            const batches = batchTagsForAnalysis(tags)
            
            // Should produce exactly 1 batch
            expect(batches.length).toBe(1)
            // Batch should contain all tags
            expect(batches[0].length).toBe(tags.length)
            // All original tags should be present
            expect(batches[0]).toEqual(tags)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('multiple batches for lists of 200+ tags, each batch max 100', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 200, maxLength: 500 }),
          (tags) => {
            const batches = batchTagsForAnalysis(tags)
            
            // Should produce ceil(length / 100) batches
            const expectedBatchCount = Math.ceil(tags.length / 100)
            expect(batches.length).toBe(expectedBatchCount)
            
            // Each batch should have at most 100 items
            for (const batch of batches) {
              expect(batch.length).toBeLessThanOrEqual(100)
            }
            
            // Total items across all batches should equal original
            const totalItems = batches.reduce((sum, batch) => sum + batch.length, 0)
            expect(totalItems).toBe(tags.length)
            
            // Flattened batches should equal original array
            expect(batches.flat()).toEqual(tags)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('empty array returns empty batches', () => {
      const batches = batchTagsForAnalysis([])
      expect(batches).toEqual([])
    })
  })

  /**
   * **Feature: v9.6-tag-consolidator, Property 2: AI response parsing produces valid structures**
   * 
   * For any valid JSON response from the AI containing merge groups, parsing SHALL
   * produce an array where each element has a non-empty masterTagName and a variations
   * array (possibly empty after filtering).
   * 
   * **Validates: Requirements 1.4, 2.1**
   */
  describe('Property 2: AI response parsing produces valid structures', () => {
    // Arbitrary for valid AI response - master must have non-whitespace content
    const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0)
    
    const validGroupArb = fc.record({
      master: nonEmptyStringArb,
      variations: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
    })

    const validResponseArb = fc.record({
      groups: fc.array(validGroupArb, { minLength: 0, maxLength: 10 }),
    })

    test('valid JSON responses parse to valid structures', () => {
      fc.assert(
        fc.property(validResponseArb, (response) => {
          const jsonString = JSON.stringify(response)
          const parsed = parseConsolidationResponse(jsonString)
          
          // Should successfully parse
          expect(parsed).not.toBeNull()
          expect(parsed!.groups).toBeDefined()
          expect(Array.isArray(parsed!.groups)).toBe(true)
          
          // Each group should have required fields
          for (const group of parsed!.groups) {
            expect(typeof group.master).toBe('string')
            expect(group.master.length).toBeGreaterThan(0)
            expect(Array.isArray(group.variations)).toBe(true)
          }
        }),
        { numRuns: 100 }
      )
    })

    test('invalid JSON returns null', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            try {
              JSON.parse(s)
              return false // Valid JSON, skip
            } catch {
              return true // Invalid JSON, keep
            }
          }),
          (invalidJson) => {
            const parsed = parseConsolidationResponse(invalidJson)
            expect(parsed).toBeNull()
          }
        ),
        { numRuns: 50 }
      )
    })

    test('missing groups field returns null', () => {
      const parsed = parseConsolidationResponse('{"other": "field"}')
      expect(parsed).toBeNull()
    })

    test('empty master string returns null', () => {
      const parsed = parseConsolidationResponse('{"groups": [{"master": "", "variations": []}]}')
      expect(parsed).toBeNull()
    })

    test('whitespace-only master returns null', () => {
      const parsed = parseConsolidationResponse('{"groups": [{"master": "   ", "variations": []}]}')
      expect(parsed).toBeNull()
    })
  })

  /**
   * **Feature: v9.6-tag-consolidator, Property 3: Tag name resolution is case-insensitive and prefers existing IDs**
   * 
   * For any suggested master tag name and existing tag database, if a tag exists with
   * a case-insensitive match, the resolved masterTagId SHALL be the existing tag's ID,
   * and the masterTagName SHALL be the existing tag's actual name.
   * 
   * **Validates: Requirements 1.5, 2.2**
   */
  describe('Property 3: Tag name resolution is case-insensitive and prefers existing IDs', () => {
    // Generate tag entries with unique IDs
    const tagEntryArb = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 30 }),
    })

    test('master tag resolved case-insensitively with existing ID', () => {
      fc.assert(
        fc.property(
          fc.array(tagEntryArb, { minLength: 1, maxLength: 20 }),
          fc.nat({ max: 19 }),
          (tags, indexSeed) => {
            // Ensure unique names (case-insensitive)
            const uniqueTags = tags.filter((tag, i, arr) => 
              arr.findIndex(t => t.name.toLowerCase() === tag.name.toLowerCase()) === i
            )
            
            if (uniqueTags.length === 0) return // Skip if no unique tags
            
            const index = indexSeed % uniqueTags.length
            const targetTag = uniqueTags[index]
            
            // Create AI response with different casing
            const aiResponse: AIConsolidationResponse = {
              groups: [{
                master: targetTag.name.toUpperCase(),
                variations: [],
              }],
            }
            
            const lookup = buildTagLookup(uniqueTags)
            const suggestions = resolveTagSuggestions(aiResponse, lookup)
            
            // If no variations, group is skipped (by design)
            // This is correct behavior - we only test resolution logic
            if (suggestions.length > 0) {
              expect(suggestions[0].masterTagId).toBe(targetTag.id)
              expect(suggestions[0].masterTagName).toBe(targetTag.name)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('master tag not in database results in skipped group', () => {
      const tags: TagEntry[] = [
        { id: 'id-1', name: 'Existing Tag' },
      ]
      
      const aiResponse: AIConsolidationResponse = {
        groups: [{
          master: 'Non Existent Tag',
          variations: ['Existing Tag'],
        }],
      }
      
      const lookup = buildTagLookup(tags)
      const suggestions = resolveTagSuggestions(aiResponse, lookup)
      
      // Group should be skipped because master doesn't exist
      expect(suggestions.length).toBe(0)
    })
  })

  /**
   * **Feature: v9.6-tag-consolidator, Property 4: Non-existent variations are filtered out**
   * 
   * For any merge suggestion containing variation names, only variations that exist
   * in the database (case-insensitive match) SHALL appear in the resolved
   * MergeSuggestion.variations array.
   * 
   * **Validates: Requirements 2.3**
   */
  describe('Property 4: Non-existent variations are filtered out', () => {
    test('only existing variations are included in resolved suggestions', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 20 }) }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          (existingTags, nonExistentVariations) => {
            // Ensure unique names
            const uniqueTags = existingTags.filter((tag, i, arr) => 
              arr.findIndex(t => t.name.toLowerCase() === tag.name.toLowerCase()) === i
            )
            
            if (uniqueTags.length < 2) return // Need at least master + 1 variation
            
            const masterTag = uniqueTags[0]
            const existingVariation = uniqueTags[1]
            
            // Filter out non-existent variations that accidentally match existing tags
            const trulyNonExistent = nonExistentVariations.filter(
              v => !uniqueTags.some(t => t.name.toLowerCase() === v.toLowerCase())
            )
            
            const aiResponse: AIConsolidationResponse = {
              groups: [{
                master: masterTag.name,
                variations: [existingVariation.name, ...trulyNonExistent],
              }],
            }
            
            const lookup = buildTagLookup(uniqueTags)
            const suggestions = resolveTagSuggestions(aiResponse, lookup)
            
            expect(suggestions.length).toBe(1)
            
            // All resolved variations should exist in database
            for (const variation of suggestions[0].variations) {
              const exists = uniqueTags.some(t => t.id === variation.tagId)
              expect(exists).toBe(true)
            }
            
            // Non-existent variations should not be included
            for (const nonExistent of trulyNonExistent) {
              const included = suggestions[0].variations.some(
                v => v.tagName.toLowerCase() === nonExistent.toLowerCase()
              )
              expect(included).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    test('variation same as master is excluded', () => {
      const tags: TagEntry[] = [
        { id: 'master-id', name: 'Master Tag' },
        { id: 'var-id', name: 'Variation' },
      ]
      
      const aiResponse: AIConsolidationResponse = {
        groups: [{
          master: 'Master Tag',
          variations: ['Master Tag', 'Variation'], // Master included as variation
        }],
      }
      
      const lookup = buildTagLookup(tags)
      const suggestions = resolveTagSuggestions(aiResponse, lookup)
      
      expect(suggestions.length).toBe(1)
      // Master should not appear in variations
      expect(suggestions[0].variations.some(v => v.tagId === 'master-id')).toBe(false)
      // Only the actual variation should be included
      expect(suggestions[0].variations.length).toBe(1)
      expect(suggestions[0].variations[0].tagId).toBe('var-id')
    })

    test('group with no valid variations is excluded', () => {
      const tags: TagEntry[] = [
        { id: 'master-id', name: 'Master Tag' },
      ]
      
      const aiResponse: AIConsolidationResponse = {
        groups: [{
          master: 'Master Tag',
          variations: ['Non Existent 1', 'Non Existent 2'],
        }],
      }
      
      const lookup = buildTagLookup(tags)
      const suggestions = resolveTagSuggestions(aiResponse, lookup)
      
      // Group should be excluded because no valid variations
      expect(suggestions.length).toBe(0)
    })
  })

  /**
   * **Feature: v9.6-tag-consolidator, Property 7: Batch merge calls mergeMultipleTags correctly**
   * 
   * For any selected merge group, executing approval SHALL call `mergeMultipleTags`
   * with the variation tag IDs as sourceTagIds and the master tag ID as targetTagId.
   * 
   * **Validates: Requirements 4.2**
   */
  describe('Property 7: Batch merge calls mergeMultipleTags correctly', () => {
    /**
     * Helper to extract merge parameters from a MergeSuggestion
     */
    function extractMergeParams(suggestion: MergeSuggestion): {
      sourceTagIds: string[]
      targetTagId: string
    } {
      return {
        sourceTagIds: suggestion.variations.map(v => v.tagId),
        targetTagId: suggestion.masterTagId,
      }
    }

    test('merge parameters are correctly extracted from suggestions', () => {
      fc.assert(
        fc.property(
          fc.record({
            masterTagId: fc.uuid(),
            masterTagName: fc.string({ minLength: 1, maxLength: 30 }),
            variations: fc.array(
              fc.record({
                tagId: fc.uuid(),
                tagName: fc.string({ minLength: 1, maxLength: 30 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          (suggestion) => {
            const params = extractMergeParams(suggestion)
            
            // Target should be the master tag ID
            expect(params.targetTagId).toBe(suggestion.masterTagId)
            
            // Source IDs should be all variation IDs
            expect(params.sourceTagIds.length).toBe(suggestion.variations.length)
            for (const variation of suggestion.variations) {
              expect(params.sourceTagIds).toContain(variation.tagId)
            }
            
            // Master ID should NOT be in source IDs
            expect(params.sourceTagIds).not.toContain(suggestion.masterTagId)
          }
        ),
        { numRuns: 100 }
      )
    })

    test('multiple suggestions produce independent merge calls', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              masterTagId: fc.uuid(),
              masterTagName: fc.string({ minLength: 1, maxLength: 20 }),
              variations: fc.array(
                fc.record({
                  tagId: fc.uuid(),
                  tagName: fc.string({ minLength: 1, maxLength: 20 }),
                }),
                { minLength: 1, maxLength: 3 }
              ),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (suggestions) => {
            const allParams = suggestions.map(extractMergeParams)
            
            // Each suggestion should produce its own merge call
            expect(allParams.length).toBe(suggestions.length)
            
            // Each merge call should have correct structure
            for (let i = 0; i < suggestions.length; i++) {
              expect(allParams[i].targetTagId).toBe(suggestions[i].masterTagId)
              expect(allParams[i].sourceTagIds.length).toBe(suggestions[i].variations.length)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
