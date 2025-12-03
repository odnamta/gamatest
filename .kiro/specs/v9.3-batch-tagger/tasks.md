# Implementation Plan

## Feature 1: Server Action Optimization

- [x] 1. Harden autoTagCards with chunk limit and parallel processing
  - [x] 1.1 Add input validation to reject arrays > 5 cards
    - Add check at start of `autoTagCards`: if `cardIds.length > 5`, return `{ ok: false, error: 'Maximum 5 cards per request' }`
    - _Requirements: 2.1_
  - [x] 1.2 Write property test for chunk limit validation
    - **Property 6: Chunk limit validation - reject oversized**
    - **Validates: Requirements 2.1**
  - [x] 1.3 Refactor to process cards in parallel with Promise.all
    - Replace sequential loop with `Promise.all` for OpenAI calls
    - Each card gets its own classification call
    - Aggregate results after all promises resolve
    - _Requirements: 2.2, 2.3_
  - [x] 1.4 Write property test for valid chunk processing
    - **Property 7: Chunk limit validation - accept valid sizes**
    - **Validates: Requirements 2.2**
  - [x] 1.5 Add subject parameter to autoTagCards
    - Add optional `subject?: string` parameter
    - Update system prompt: "You are an expert in [SUBJECT]..."
    - Fall back to 'Obstetrics & Gynecology' if not provided
    - _Requirements: 3.4, 4.1_
  - [x] 1.6 Write property test for subject in prompt
    - **Property 10: Subject included in AI prompt**
    - **Validates: Requirements 3.4, 4.1**
  - [x] 1.7 Write property test for result shape
    - **Property 8: Result shape correctness**
    - **Validates: Requirements 2.4**

## Feature 2: Client-Side Orchestration

- [x] 2. Create chunking utility function
  - [x] 2.1 Implement chunkArray helper in src/lib/batch-utils.ts
    - Pure function: `chunkArray<T>(array: T[], size: number): T[][]`
    - Handle edge cases: empty array, size larger than array
    - _Requirements: 1.1_
  - [x] 2.2 Write property test for chunking correctness
    - **Property 1: Chunking produces correct sizes**
    - **Validates: Requirements 1.1**

- [x] 3. Checkpoint - Ensure all tests pass
  - All v9.3 tests pass (15/15). One pre-existing test failure in tag-persistence.property.test.ts unrelated to v9.3.

- [x] 4. Create useAutoTag hook
  - [x] 4.1 Create src/hooks/use-auto-tag.ts with state management
    - State: isTagging, currentChunk, totalChunks, taggedCount, skippedCount, error
    - Refs for cancellation flag
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 4.2 Implement startTagging function with sequential chunk processing
    - Split cardIds into chunks of 3
    - Loop through chunks, await each autoTagCards call
    - Update progress state after each chunk
    - Check cancellation flag before each chunk
    - _Requirements: 1.2, 1.3_
  - [x] 4.3 Write property test for sequential processing
    - **Property 2: Sequential chunk processing order**
    - **Validates: Requirements 1.2**
  - [x] 4.4 Write property test for progress state accuracy
    - **Property 3: Progress state accuracy**
    - **Validates: Requirements 1.3**
  - [x] 4.5 Implement result aggregation
    - Sum taggedCount and skippedCount across all chunk results
    - Handle partial failures gracefully
    - _Requirements: 1.4, 1.5_
  - [x] 4.6 Write property test for result aggregation
    - **Property 4: Result aggregation correctness**
    - **Validates: Requirements 1.4**
  - [x] 4.7 Write property test for partial success
    - **Property 5: Partial success on chunk failures**
    - **Validates: Requirements 1.5**
  - [x] 4.8 Implement cancel function
    - Set cancellation flag
    - Allow current in-flight chunk to complete
    - Stop loop after current chunk
    - _Requirements: 5.5_
  - [x] 4.9 Write property test for cancellation behavior
    - **Property 12: Cancellation stops new chunks**
    - **Validates: Requirements 5.5**

- [x] 5. Checkpoint - Ensure all tests pass
  - All v9.3 tests pass (15/15).

## Feature 3: Progress Modal UI

- [x] 6. Create AutoTagProgressModal component
  - [x] 6.1 Create src/components/tags/AutoTagProgressModal.tsx
    - Modal overlay with progress bar
    - Display: "Processing batch X of Y..."
    - Show running totals: tagged count, skipped count
    - _Requirements: 5.1, 5.3_
  - [x] 6.2 Write property test for progress display
    - **Property 11: Progress display accuracy**
    - **Validates: Requirements 5.3**
  - [x] 6.3 Implement non-dismissible behavior during processing
    - Disable click-outside dismiss when isProcessing=true
    - Disable Escape key dismiss when isProcessing=true
    - _Requirements: 1.6, 5.2_
  - [x] 6.4 Add Cancel and Close buttons with correct enablement
    - Cancel button: visible during processing, calls onCancel
    - Close button: enabled only when !isProcessing
    - _Requirements: 5.4, 5.5_

## Feature 4: Integration

- [x] 7. Integrate useAutoTag into CardList
  - [x] 7.1 Replace direct autoTagCards call with useAutoTag hook
    - Import and initialize useAutoTag hook
    - Pass deck subject from props (need to add to CardList props)
    - _Requirements: 1.1, 1.2, 3.4_
  - [x] 7.2 Add AutoTagProgressModal to CardList render
    - Connect modal props to useAutoTag state
    - Wire up onCancel and onClose handlers
    - _Requirements: 5.1_
  - [x] 7.3 Update DeckDetailsPage to pass subject to CardList
    - Add `deckSubject` prop to CardList
    - Pass `deckTemplate.subject` from page
    - _Requirements: 3.4_

- [x] 8. Checkpoint - Ensure all tests pass
  - All v9.3 tests pass (15/15).

## Feature 5: Subject Integration Verification

- [x] 9. Verify subject flow end-to-end
  - [x] 9.1 Verify EditableDeckSubject persists correctly
    - EditableDeckSubject component already exists and persists to database
    - Subject is passed from DeckDetailsPage to CardList via deckSubject prop
    - _Requirements: 3.2, 3.3_
  - [x] 9.2 Write property test for subject persistence
    - **Property 9: Subject persistence round-trip**
    - **Validates: Requirements 3.3**
  - [x] 9.3 Verify subject flows through to AI prompt
    - Subject is passed to autoTagCards and included in system prompt
    - System prompt includes: "You are an expert in ${effectiveSubject}"
    - _Requirements: 4.1, 4.2_

- [x] 10. Final Checkpoint - Ensure all tests pass
  - All v9.3 tests pass (17/17). One pre-existing test failure in tag-persistence.property.test.ts unrelated to v9.3.
