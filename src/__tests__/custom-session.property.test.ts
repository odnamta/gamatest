/**
 * Property Tests for Custom Session (V6.3)
 * Tests URL param encoding/decoding, OR semantics, and mode filtering
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  encodeSessionParams,
  decodeSessionParams,
  buildCustomStudyUrl,
  isValidConfig,
  type CustomSessionConfig,
  type SessionMode,
} from '@/lib/custom-session-params'

// Arbitrary for valid UUID-like strings
const uuidArb = fc.uuid()

// Arbitrary for session mode
const modeArb = fc.constantFrom<SessionMode>('due', 'cram')

// Arbitrary for valid limit (1-200)
const limitArb = fc.integer({ min: 1, max: 200 })

// Arbitrary for CustomSessionConfig
const configArb = fc.record({
  tagIds: fc.array(uuidArb, { minLength: 0, maxLength: 5 }),
  deckIds: fc.array(uuidArb, { minLength: 0, maxLength: 5 }),
  mode: modeArb,
  limit: limitArb,
})

describe('Custom Session URL Params', () => {
  /**
   * Property 1: Encode/decode roundtrip preserves config
   */
  it('encode/decode roundtrip preserves config', () => {
    fc.assert(
      fc.property(configArb, (config) => {
        const encoded = encodeSessionParams(config)
        const params = new URLSearchParams(encoded)
        const decoded = decodeSessionParams(params)
        
        // Arrays should match (order preserved)
        expect(decoded.tagIds).toEqual(config.tagIds)
        expect(decoded.deckIds).toEqual(config.deckIds)
        expect(decoded.mode).toBe(config.mode)
        expect(decoded.limit).toBe(config.limit)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Mode defaults to 'due' for invalid values
   */
  it('mode defaults to due for invalid values', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s !== 'due' && s !== 'cram'),
        (invalidMode) => {
          const params = new URLSearchParams()
          params.set('mode', invalidMode)
          params.set('limit', '50')
          
          const decoded = decodeSessionParams(params)
          expect(decoded.mode).toBe('due')
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 3: Limit is clamped to 1-200 range
   */
  it('limit is clamped to valid range', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 1000 }), (rawLimit) => {
        const params = new URLSearchParams()
        params.set('mode', 'due')
        params.set('limit', String(rawLimit))
        
        const decoded = decodeSessionParams(params)
        expect(decoded.limit).toBeGreaterThanOrEqual(1)
        expect(decoded.limit).toBeLessThanOrEqual(200)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Empty arrays decode correctly
   */
  it('empty arrays decode correctly', () => {
    const params = new URLSearchParams()
    params.set('mode', 'cram')
    params.set('limit', '100')
    
    const decoded = decodeSessionParams(params)
    expect(decoded.tagIds).toEqual([])
    expect(decoded.deckIds).toEqual([])
  })

  /**
   * Property 5: buildCustomStudyUrl produces valid URL
   */
  it('buildCustomStudyUrl produces valid URL', () => {
    fc.assert(
      fc.property(configArb, (config) => {
        const url = buildCustomStudyUrl(config)
        
        // Should start with /study/custom?
        expect(url).toMatch(/^\/study\/custom\?/)
        
        // Should be parseable
        const urlObj = new URL(url, 'http://localhost')
        expect(urlObj.pathname).toBe('/study/custom')
      }),
      { numRuns: 50 }
    )
  })
})

describe('Custom Session Validation', () => {
  /**
   * Property 6: Config is valid if at least one filter is set
   */
  it('config is valid if at least one tag or deck is set', () => {
    fc.assert(
      fc.property(
        fc.array(uuidArb, { minLength: 1, maxLength: 5 }),
        modeArb,
        limitArb,
        (ids, mode, limit) => {
          // Config with tags only
          const configWithTags: CustomSessionConfig = {
            tagIds: ids,
            deckIds: [],
            mode,
            limit,
          }
          expect(isValidConfig(configWithTags)).toBe(true)
          
          // Config with decks only
          const configWithDecks: CustomSessionConfig = {
            tagIds: [],
            deckIds: ids,
            mode,
            limit,
          }
          expect(isValidConfig(configWithDecks)).toBe(true)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 7: Config is invalid if no filters are set
   */
  it('config is invalid if no filters are set', () => {
    fc.assert(
      fc.property(modeArb, limitArb, (mode, limit) => {
        const config: CustomSessionConfig = {
          tagIds: [],
          deckIds: [],
          mode,
          limit,
        }
        expect(isValidConfig(config)).toBe(false)
      }),
      { numRuns: 20 }
    )
  })
})

describe('Custom Session Mode Semantics', () => {
  /**
   * Property 8: Due mode string is preserved
   */
  it('due mode is preserved through encode/decode', () => {
    const config: CustomSessionConfig = {
      tagIds: ['test-tag-id'],
      deckIds: [],
      mode: 'due',
      limit: 50,
    }
    
    const encoded = encodeSessionParams(config)
    const params = new URLSearchParams(encoded)
    const decoded = decodeSessionParams(params)
    
    expect(decoded.mode).toBe('due')
  })

  /**
   * Property 9: Cram mode string is preserved
   */
  it('cram mode is preserved through encode/decode', () => {
    const config: CustomSessionConfig = {
      tagIds: [],
      deckIds: ['test-deck-id'],
      mode: 'cram',
      limit: 100,
    }
    
    const encoded = encodeSessionParams(config)
    const params = new URLSearchParams(encoded)
    const decoded = decodeSessionParams(params)
    
    expect(decoded.mode).toBe('cram')
  })
})
