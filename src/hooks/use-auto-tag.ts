'use client'

import { useState, useRef, useCallback } from 'react'
import { chunkArray } from '@/lib/batch-utils'
import { autoTagCards } from '@/actions/tag-actions'

/**
 * V9.3: useAutoTag Hook
 * Client-side orchestration for auto-tagging cards in chunks.
 * Prevents timeouts by processing cards in small batches sequentially.
 * 
 * Requirements: V9.3 1.1-1.6, 5.5
 * 
 * Property 2: Sequential chunk processing - chunk N completes before N+1 starts
 * Property 3: Progress state accuracy - currentChunk and totalChunks are accurate
 * Property 4: Result aggregation - final counts equal sum of chunk counts
 * Property 5: Partial success - continues on chunk failure
 * Property 12: Cancellation stops new chunks
 */

/** Result from a single chunk processing */
export interface ChunkResult {
  ok: boolean
  taggedCount: number
  skippedCount: number
  error?: string
}

/** Options for useAutoTag hook */
export interface UseAutoTagOptions {
  /** Called after each chunk completes */
  onChunkComplete?: (chunkIndex: number, result: ChunkResult) => void
  /** Called when all chunks complete */
  onComplete?: (totalTagged: number, totalSkipped: number) => void
  /** Called on error */
  onError?: (error: string) => void
}

/** Return type for useAutoTag hook */
export interface UseAutoTagReturn {
  // State
  isTagging: boolean
  currentChunk: number
  totalChunks: number
  taggedCount: number
  skippedCount: number
  error: string | null

  // Controls
  startTagging: (cardIds: string[], subject?: string) => Promise<void>
  cancel: () => void
  reset: () => void
}

/** Default chunk size for client-side processing */
const CHUNK_SIZE = 3

/**
 * Hook for auto-tagging cards with progress tracking and cancellation.
 * Splits card IDs into chunks of 3 and processes sequentially.
 */
export function useAutoTag(options: UseAutoTagOptions = {}): UseAutoTagReturn {
  const { onChunkComplete, onComplete, onError } = options

  // State
  const [isTagging, setIsTagging] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [taggedCount, setTaggedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Cancellation ref (survives re-renders)
  const cancelledRef = useRef(false)

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setIsTagging(false)
    setCurrentChunk(0)
    setTotalChunks(0)
    setTaggedCount(0)
    setSkippedCount(0)
    setError(null)
    cancelledRef.current = false
  }, [])

  /**
   * Cancel the current tagging operation.
   * Allows current in-flight chunk to complete, but stops new chunks.
   */
  const cancel = useCallback(() => {
    cancelledRef.current = true
  }, [])

  /**
   * Start tagging cards in chunks.
   * Processes sequentially with progress updates.
   * 
   * @param cardIds - Array of card IDs to tag
   * @param subject - Optional medical specialty for context
   */
  const startTagging = useCallback(
    async (cardIds: string[], subject?: string) => {
      if (cardIds.length === 0) {
        setError('No cards selected')
        onError?.('No cards selected')
        return
      }

      // Reset state
      reset()
      setIsTagging(true)
      cancelledRef.current = false

      // Split into chunks of 3
      const chunks = chunkArray(cardIds, CHUNK_SIZE)
      setTotalChunks(chunks.length)

      let runningTagged = 0
      let runningSkipped = 0

      // Process chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        // Check cancellation before starting new chunk
        if (cancelledRef.current) {
          break
        }

        const chunk = chunks[i]
        setCurrentChunk(i + 1)

        try {
          const result = await autoTagCards(chunk, subject)

          const chunkResult: ChunkResult = result.ok
            ? {
                ok: true,
                taggedCount: result.taggedCount,
                skippedCount: result.skippedCount,
              }
            : {
                ok: false,
                taggedCount: 0,
                skippedCount: chunk.length,
                error: result.error,
              }

          // Aggregate results
          runningTagged += chunkResult.taggedCount
          runningSkipped += chunkResult.skippedCount
          setTaggedCount(runningTagged)
          setSkippedCount(runningSkipped)

          // Notify callback
          onChunkComplete?.(i, chunkResult)
        } catch (err) {
          // On error, mark all cards in chunk as skipped and continue
          const errorMessage = err instanceof Error ? err.message : 'Unknown error'
          console.error(`Chunk ${i + 1} failed:`, errorMessage)

          const chunkResult: ChunkResult = {
            ok: false,
            taggedCount: 0,
            skippedCount: chunk.length,
            error: errorMessage,
          }

          runningSkipped += chunk.length
          setSkippedCount(runningSkipped)

          onChunkComplete?.(i, chunkResult)
          // Continue with next chunk (partial success behavior)
        }
      }

      // Complete
      setIsTagging(false)

      if (cancelledRef.current) {
        setError('Tagging cancelled')
      } else if (runningTagged === 0 && runningSkipped > 0) {
        const errorMsg = 'All cards failed to tag'
        setError(errorMsg)
        onError?.(errorMsg)
      }

      onComplete?.(runningTagged, runningSkipped)
    },
    [reset, onChunkComplete, onComplete, onError]
  )

  return {
    isTagging,
    currentChunk,
    totalChunks,
    taggedCount,
    skippedCount,
    error,
    startTagging,
    cancel,
    reset,
  }
}
