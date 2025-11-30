/**
 * Custom Session URL Parameter Utilities
 * V6.3: Encode/decode session configuration for URL params
 */

export type SessionMode = 'due' | 'cram'

export interface CustomSessionConfig {
  tagIds: string[]
  deckIds: string[]
  mode: SessionMode
  limit: number
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * Encode session configuration to URL search params.
 */
export function encodeSessionParams(config: CustomSessionConfig): string {
  const params = new URLSearchParams()
  
  if (config.tagIds.length > 0) {
    params.set('tags', config.tagIds.join(','))
  }
  
  if (config.deckIds.length > 0) {
    params.set('decks', config.deckIds.join(','))
  }
  
  params.set('mode', config.mode)
  params.set('limit', String(Math.min(config.limit, MAX_LIMIT)))
  
  return params.toString()
}

/**
 * Decode URL search params to session configuration.
 */
export function decodeSessionParams(searchParams: URLSearchParams): CustomSessionConfig {
  const tagsParam = searchParams.get('tags')
  const decksParam = searchParams.get('decks')
  const modeParam = searchParams.get('mode')
  const limitParam = searchParams.get('limit')
  
  return {
    tagIds: tagsParam ? tagsParam.split(',').filter(Boolean) : [],
    deckIds: decksParam ? decksParam.split(',').filter(Boolean) : [],
    mode: modeParam === 'cram' ? 'cram' : 'due',
    limit: Math.min(
      Math.max(1, parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      MAX_LIMIT
    ),
  }
}

/**
 * Build the custom study URL with encoded params.
 */
export function buildCustomStudyUrl(config: CustomSessionConfig): string {
  const params = encodeSessionParams(config)
  return `/study/custom?${params}`
}

/**
 * Validate that the config has at least one filter (tag or deck).
 */
export function isValidConfig(config: CustomSessionConfig): boolean {
  return config.tagIds.length > 0 || config.deckIds.length > 0
}
