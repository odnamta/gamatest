# Design Document: V9.3 - The Batch Tagger

## Overview

V9.3 addresses the auto-tagging timeout issue by implementing a client-side orchestration loop that processes cards in small chunks, and lays the foundation for multi-discipline support by integrating deck subjects into the AI classification pipeline.

The solution follows the established `useAutoScan` pattern for client-side loops with progress tracking, adapted for the simpler use case of iterating over a list of card IDs rather than PDF pages.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  CardList.tsx                                                    │
│  ├── BulkActionsBar (triggers auto-tag)                         │
│  └── AutoTagProgressModal (new component)                       │
│      ├── Progress bar with chunk status                         │
│      ├── Cancel button (stops new chunks)                       │
│      └── Close button (enabled on complete)                     │
├─────────────────────────────────────────────────────────────────┤
│                     Hook Layer                                   │
├─────────────────────────────────────────────────────────────────┤
│  useAutoTag (new hook)                                          │
│  ├── Chunks card IDs into batches of 3                          │
│  ├── Sequential processing with progress state                  │
│  ├── Aggregates results across chunks                           │
│  └── Supports cancellation                                      │
├─────────────────────────────────────────────────────────────────┤
│                   Server Action Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  autoTagCards (modified)                                        │
│  ├── Hard limit: max 5 cards per call                           │
│  ├── Parallel OpenAI calls via Promise.all                      │
│  └── Subject-aware prompt generation                            │
├─────────────────────────────────────────────────────────────────┤
│                    Database Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  deck_templates.subject (existing column)                       │
│  └── Default: 'Obstetrics & Gynecology'                         │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. New Component: `AutoTagProgressModal`

Location: `src/components/tags/AutoTagProgressModal.tsx`

```typescript
interface AutoTagProgressModalProps {
  isOpen: boolean
  isProcessing: boolean
  currentChunk: number
  totalChunks: number
  taggedCount: number
  skippedCount: number
  error?: string
  onCancel: () => void
  onClose: () => void
}
```

Features:
- Non-dismissible during processing (no click-outside or Escape)
- Progress bar showing chunk progress
- Real-time counts of tagged/skipped cards
- Cancel button to stop processing (allows current chunk to finish)
- Close button enabled only when complete

### 2. New Hook: `useAutoTag`

Location: `src/hooks/use-auto-tag.ts`

```typescript
interface UseAutoTagOptions {
  onChunkComplete?: (chunkIndex: number, result: ChunkResult) => void
  onComplete?: (totalTagged: number, totalSkipped: number) => void
  onError?: (error: string) => void
}

interface UseAutoTagReturn {
  // State
  isTagging: boolean
  currentChunk: number
  totalChunks: number
  taggedCount: number
  skippedCount: number
  error: string | null
  
  // Controls
  startTagging: (cardIds: string[], deckId: string) => Promise<void>
  cancel: () => void
  reset: () => void
}

interface ChunkResult {
  ok: boolean
  taggedCount: number
  skippedCount: number
  error?: string
}
```

Behavior:
- Splits card IDs into chunks of 3
- Processes chunks sequentially (await each before next)
- Aggregates tagged/skipped counts
- Supports cancellation between chunks
- Continues on chunk failure, reports partial success

### 3. Modified: `autoTagCards` Server Action

Location: `src/actions/tag-actions.ts`

Changes:
- Add hard limit: reject if `cardIds.length > 5`
- Process cards in parallel using `Promise.all`
- Accept `subject` parameter for context-aware prompting
- Update system prompt to include subject

```typescript
export async function autoTagCards(
  cardIds: string[],
  subject?: string  // New parameter
): Promise<AutoTagResult>
```

### 4. Modified: `CardList.tsx`

Changes:
- Replace direct `autoTagCards` call with `useAutoTag` hook
- Add `AutoTagProgressModal` component
- Pass deck subject to tagging flow

## Data Models

### Existing: `deck_templates` Table

The `subject` column already exists (added in V9.1):

```sql
-- Already in schema
ALTER TABLE deck_templates 
ADD COLUMN subject TEXT DEFAULT 'Obstetrics & Gynecology';
```

No migration needed - the column exists and `EditableDeckSubject` component is already functional.

### Chunking Algorithm

```typescript
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

// Example: chunkArray([1,2,3,4,5,6,7], 3) => [[1,2,3], [4,5,6], [7]]
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Chunking produces correct sizes
*For any* array of card IDs, chunking with size 3 SHALL produce chunks where all chunks except possibly the last have exactly 3 elements, and the last chunk has 1-3 elements.
**Validates: Requirements 1.1**

### Property 2: Sequential chunk processing order
*For any* sequence of chunks, processing SHALL complete chunk N before starting chunk N+1, ensuring no concurrent chunk processing.
**Validates: Requirements 1.2**

### Property 3: Progress state accuracy
*For any* tagging operation with N total chunks, after processing M chunks, the progress state SHALL report currentChunk as M and totalChunks as N.
**Validates: Requirements 1.3**

### Property 4: Result aggregation correctness
*For any* sequence of chunk results, the final taggedCount SHALL equal the sum of all individual chunk taggedCounts, and skippedCount SHALL equal the sum of all individual chunk skippedCounts.
**Validates: Requirements 1.4**

### Property 5: Partial success on chunk failures
*For any* tagging operation where some chunks fail, the remaining chunks SHALL still be processed and their results included in the final counts.
**Validates: Requirements 1.5**

### Property 6: Chunk limit validation - reject oversized
*For any* call to autoTagCards with more than 5 card IDs, the function SHALL return an error without processing any cards.
**Validates: Requirements 2.1**

### Property 7: Chunk limit validation - accept valid sizes
*For any* call to autoTagCards with 1-5 card IDs, the function SHALL process all provided cards.
**Validates: Requirements 2.2**

### Property 8: Result shape correctness
*For any* successful autoTagCards call, the result SHALL contain taggedCount and skippedCount fields where taggedCount + skippedCount equals the number of input cards.
**Validates: Requirements 2.4**

### Property 9: Subject persistence round-trip
*For any* deck and valid subject value, updating the subject and then fetching the deck SHALL return the same subject value.
**Validates: Requirements 3.3**

### Property 10: Subject included in AI prompt
*For any* deck subject, the generated AI system prompt SHALL contain that subject string.
**Validates: Requirements 3.4, 4.1**

### Property 11: Progress display accuracy
*For any* tagging operation in progress, the displayed progress text SHALL accurately reflect the current chunk number and total chunks.
**Validates: Requirements 5.3**

### Property 12: Cancellation stops new chunks
*For any* tagging operation that is cancelled, no new chunks SHALL be sent to the server after cancellation, though the current in-flight chunk may complete.
**Validates: Requirements 5.5**

## Error Handling

### Client-Side (useAutoTag)
- Network errors: Catch and report, continue with next chunk
- Server errors: Log error, increment skipped count, continue
- Cancellation: Set flag, allow current chunk to complete, stop loop

### Server-Side (autoTagCards)
- Input validation: Return error immediately if > 5 cards
- Auth errors: Return error, don't process
- OpenAI errors: Catch per-card, mark as skipped, continue with others
- Database errors: Return error with partial results if possible

## Testing Strategy

### Property-Based Testing (fast-check)

The following properties will be tested using fast-check:

1. **Chunking function** - Pure function, easy to test with arbitrary arrays
2. **Progress state machine** - Test state transitions with arbitrary chunk sequences
3. **Result aggregation** - Test sum correctness with arbitrary result arrays
4. **Chunk limit validation** - Test boundary conditions (0, 1, 5, 6, 100 cards)
5. **Prompt generation** - Test subject inclusion with arbitrary subject strings

### Unit Tests

1. **AutoTagProgressModal** - Render states, button enablement
2. **useAutoTag hook** - State transitions, cancellation behavior
3. **autoTagCards** - Input validation, error handling

### Integration Tests

1. **End-to-end tagging flow** - Select cards → Start → Progress → Complete
2. **Cancellation flow** - Start → Cancel → Verify partial results
3. **Error recovery** - Simulate chunk failures, verify continuation

### Test Configuration

- Property tests: 100 iterations minimum per property
- Use fast-check for property-based testing (already in project)
- Tag each property test with: `**Feature: v9.3-batch-tagger, Property {N}: {description}**`
