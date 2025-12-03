/**
 * Batch Processing Utilities
 * V9.2: Helper functions for batch operations
 * V9.3: Added chunkArray for client-side orchestration
 * 
 * Requirements: 2.3 - Batch size limit for API calls
 * Requirements: V9.3 1.1 - Client-side chunking
 */

/**
 * Split an array into batches of a specified size.
 * 
 * @param items - Array of items to batch
 * @param batchSize - Maximum items per batch (default: 20)
 * @returns Array of batches
 */
export function batchArray<T>(items: T[], batchSize: number = 20): T[][] {
  if (items.length === 0) {
    return []
  }
  
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }
  return batches
}

/**
 * V9.3: Split an array into chunks of a specified size.
 * Alias for batchArray with clearer naming for client-side use.
 * 
 * Property 1: All chunks except possibly the last have exactly `size` elements.
 * Property 1: The last chunk has 1 to `size` elements.
 * 
 * @param array - Array of items to chunk
 * @param size - Maximum items per chunk (default: 3)
 * @returns Array of chunks
 * 
 * Requirements: V9.3 1.1 - Client-side chunking
 */
export function chunkArray<T>(array: T[], size: number = 3): T[][] {
  if (array.length === 0) {
    return []
  }
  
  if (size <= 0) {
    return []
  }
  
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Process items in batches with a callback function.
 * Useful for rate-limited API calls.
 * 
 * @param items - Array of items to process
 * @param batchSize - Maximum items per batch
 * @param processor - Async function to process each batch
 * @returns Combined results from all batches
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const batches = batchArray(items, batchSize)
  const results: R[] = []
  
  for (const batch of batches) {
    const batchResults = await processor(batch)
    results.push(...batchResults)
  }
  
  return results
}
