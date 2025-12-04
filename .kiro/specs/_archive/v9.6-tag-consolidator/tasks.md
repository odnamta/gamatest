# Implementation Plan

- [x] 1. Create tag consolidation utility functions
  - [x] 1.1 Create `src/lib/tag-consolidation.ts` with batching function
    - Implement `batchTagsForAnalysis(tags: string[]): string[][]`
    - Return single batch if < 200 tags, otherwise chunks of 100
    - _Requirements: 1.2, 1.3_
  - [x] 1.2 Write property test for batching logic
    - **Property 1: Batching produces correct chunk counts**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 1.3 Implement `parseConsolidationResponse` function
    - Parse AI JSON response into structured format
    - Handle malformed JSON gracefully
    - _Requirements: 1.4, 2.1_
  - [x] 1.4 Write property test for JSON parsing
    - **Property 2: AI response parsing produces valid structures**
    - **Validates: Requirements 1.4, 2.1**
  - [x] 1.5 Implement `resolveTagSuggestions` function
    - Map AI suggestions to database tag IDs
    - Case-insensitive matching, prefer existing tag IDs for master
    - Filter out non-existent variations
    - _Requirements: 1.5, 2.2, 2.3_
  - [x] 1.6 Write property test for tag resolution
    - **Property 3: Tag name resolution is case-insensitive and prefers existing IDs**
    - **Property 4: Non-existent variations are filtered out**
    - **Validates: Requirements 1.5, 2.2, 2.3**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create analyzeTagConsolidation server action
  - [x] 3.1 Add types for consolidation results in `src/actions/admin-tag-actions.ts`
    - Define `MergeSuggestion`, `AnalyzeTagConsolidationResult` interfaces
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Implement `analyzeTagConsolidation` server action
    - Fetch all tags (name and id) for current user
    - Batch tags using `batchTagsForAnalysis` if needed
    - Build OpenAI prompt for synonym/typo detection
    - Call OpenAI API (gpt-4o-mini for cost efficiency)
    - Parse response and resolve to database IDs
    - Return structured suggestions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.3_
  - [x] 3.3 Write property test for merge execution parameters
    - **Property 7: Batch merge calls mergeMultipleTags correctly**
    - **Validates: Requirements 4.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create Smart Cleanup UI component
  - [x] 5.1 Create `src/components/tags/SmartCleanupTab.tsx`
    - Add "Analyze Tags" button with loading state
    - Display empty state when no suggestions
    - _Requirements: 3.2, 3.5_
  - [x] 5.2 Implement merge group list rendering
    - Render each suggestion group with checkbox
    - Show master tag prominently, variations listed below
    - _Requirements: 3.3, 3.4_
  - [x] 5.3 Write property test for merge group rendering
    - **Property 5: Merge group rendering includes all components**
    - **Validates: Requirements 3.3, 3.4**
  - [x] 5.4 Implement selection state and approve button
    - Track selected groups with checkboxes
    - Enable "Approve Selected" when >= 1 group selected
    - _Requirements: 4.1_
  - [x] 5.5 Write property test for selection state
    - **Property 6: Selection enables approval button**
    - **Validates: Requirements 4.1**

- [x] 6. Implement batch merge execution
  - [x] 6.1 Add batch merge handler in SmartCleanupTab
    - Loop through selected groups
    - Call `mergeMultipleTags` for each group
    - Handle partial failures, continue processing
    - Show success/error toast with counts
    - Clear suggestions and refresh on completion
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [x] 6.2 Write property test for partial failure handling
    - **Property 8: Partial failure continues processing**
    - **Validates: Requirements 4.5**

- [x] 7. Integrate Smart Cleanup tab into Tag Manager
  - [x] 7.1 Update TagManager.tsx with tab navigation
    - Add tab buttons: "Manage Tags" | "Smart Cleanup"
    - Conditionally render existing content or SmartCleanupTab
    - Pass `onMergeComplete` callback to refresh tags
    - _Requirements: 3.1_

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

