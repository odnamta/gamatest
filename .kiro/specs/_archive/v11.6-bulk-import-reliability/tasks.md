# Implementation Plan

## Epic 1: Manage Drafts Workspace per Deck

- [x] 1. Backend: List draft MCQs per deck
  - [x] 1.1 Define DraftCardSummary type centrally
    - Add to `src/types/actions.ts`
    - Include: id, questionNumber, stem, tags, importSessionId, createdAt
    - Reuse in server action and DeckDraftsPanel component
    - _Requirements: 1.2_

  - [x] 1.2 Implement getDeckDrafts server action
    - Add to `src/actions/batch-mcq-actions.ts`
    - Use withUser + ActionResultV2 pattern
    - Query card_templates where status='draft' and deck_template_id matches
    - Join with card_template_tags and tags for tag data
    - Order by question_number ASC NULLS LAST, then created_at ASC, then id ASC
    - Verified via Supabase MCP: question_number, import_session_id, status columns exist
    - Return DraftCardSummary[] 
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.3 Write property test for draft filtering
    - Create `src/__tests__/bulk-drafts-flow.property.test.ts`
    - **Property 1: Draft Filtering - Status and Deck Match**
    - Generate random card templates with various statuses and deck IDs
    - Verify only status='draft' cards for correct deck are returned
    - **Validates: Requirements 1.1**

  - [x] 1.4 Write property test for draft ordering
    - **Property 2: Draft Ordering - Question Number then Created At**
    - Generate drafts with various question_numbers and timestamps
    - Verify ordering is question_number ASC NULLS LAST, then created_at ASC
    - **Validates: Requirements 1.4**

- [x] 2. UI: Drafts panel inside deck view
  - [x] 2.1 Create DeckDraftsPanel component
    - Create `src/components/decks/DeckDraftsPanel.tsx`
    - Props: deckId, isAuthor, onRefresh
    - Fetch drafts via getDeckDrafts on mount
    - Display draft count in header
    - Show loading and empty states
    - _Requirements: 2.1, 2.5_

  - [x] 2.2 Implement draft list display
    - Table layout for desktop: question #, stem (truncated), tags, checkbox
    - Stacked card layout for mobile (375px breakpoint)
    - Use existing TagBadge component for tag chips
    - Stem truncated to 1-2 lines with CSS line-clamp
    - _Requirements: 2.2, 2.3_

  - [x] 2.3 Add bulk selection UI
    - Per-row checkboxes for each draft
    - "Select all visible" checkbox in header
    - Track selected IDs in component state
    - Show selected count in footer
    - _Requirements: 2.4_

  - [x] 2.4 Integrate DeckDraftsPanel into deck page
    - Update `src/app/(app)/decks/[deckId]/page.tsx`
    - Show DeckDraftsPanel for authors when drafts exist
    - Pass isAuthor prop from existing logic
    - _Requirements: 2.1_

- [x] 3. Bulk publish/archive from drafts
  - [x] 3.1 Implement bulkPublishDrafts server action
    - Add to `src/actions/batch-mcq-actions.ts`
    - Use withUser + ActionResultV2 pattern
    - Verify user is author of all cards
    - Update status to 'published' for all card IDs
    - Return { ok: true, data: { updatedCount } }
    - _Requirements: 3.1_

  - [x] 3.2 Implement bulkArchiveDrafts server action
    - Same pattern as bulkPublishDrafts
    - Update status to 'archived' for all card IDs
    - _Requirements: 3.2_

  - [x] 3.3 Add bulk action buttons to DeckDraftsPanel
    - "Publish Selected" and "Archive Selected" buttons
    - Disabled when no selection
    - Show confirmation dialog before action
    - Refresh panel after successful action
    - _Requirements: 3.3, 3.4_

  - [x] 3.4 Write property test for bulk publish
    - **Property 3: Bulk Publish Transitions All Selected**
    - Generate random draft IDs, call bulkPublishDrafts
    - Verify all selected cards have status='published'
    - Verify non-selected cards unchanged
    - **Validates: Requirements 3.1**

  - [x] 3.5 Write property test for bulk archive
    - **Property 4: Bulk Archive Transitions All Selected**
    - Same pattern as 3.4 but for 'archived' status
    - **Validates: Requirements 3.2**

- [x] 4. Checkpoint - Ensure all tests pass

## Epic 2: Solidify bulkCreateMCQV2 Atomicity & Coverage

- [x] 5. Ensure atomic writes for bulkCreateMCQV2
  - [x] 5.1 Extract pure planner function from bulkCreateMCQV2
    - Create planBulkCreate function that takes validated input
    - Returns list of intended operations (cards, tags, links, progress)
    - Pure function with no side effects for easy testing
    - _Requirements: 4.1_

  - [x] 5.2 Add early validation before any writes
    - Validate all card data before starting inserts
    - Return error immediately if validation fails
    - Prevents partial writes from validation failures
    - _Requirements: 4.2_

  - [x] 5.3 Write property test for planner atomicity
    - **Property 5: Bulk Planner Atomicity**
    - Test the pure planner function (not DB writes)
    - If validation fails → returns "no operations"
    - If validation passes → returns complete, consistent set of operations
    - **Validates: Requirements 3.5, 4.1, 4.2**

- [x] 6. Implement duplicate protection
  - [x] 6.1 Create normalizeStem helper
    - Add to `src/lib/content-staging-metrics.ts`
    - Lowercase, trim, collapse whitespace (conservative with punctuation)
    - Export for reuse in implementation and tests
    - _Requirements: 6.1_

  - [x] 6.2 Add duplicate detection to bulkCreateMCQV2
    - Scope duplicates to: deck_template_id + import_session_id + normalizedStem
    - Before inserting, query existing cards matching deck + session
    - Compare normalized stems within that scope
    - Skip duplicates, track skippedCount
    - Return skippedCount in result
    - Do NOT dedupe across entire deck without session context
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.3 Write property test for duplicate detection
    - **Property 6: Duplicate Detection via Deck + Session + Normalized Stem**
    - Generate cards with duplicate stems (case/whitespace variations)
    - Model the deck + session + stem rule explicitly
    - Verify duplicates skipped only within same session
    - Verify non-duplicates created
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.2, 8.3, 8.4**

- [x] 7. Tighten missing-question detection
  - [x] 7.1 Centralize missing number calculation
    - Ensure calculateMissingNumbers in `src/lib/content-staging-metrics.ts` is the single source
    - Update any duplicate logic to use this helper
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Write property test for missing numbers
    - **Property 7: Missing Numbers Calculation Consistency**
    - Generate random detected and created arrays
    - Verify set difference is correct and sorted
    - Verify idempotency (same input = same output)
    - **Validates: Requirements 5.1, 5.2**

  - [x] 7.3 Write property test for complete status
    - **Property 8: Complete Status When No Missing**
    - Generate QAMetrics with no missing numbers
    - Verify formatQAMetrics includes "Complete ✓"
    - **Validates: Requirements 5.4**

- [x] 8. Checkpoint - Ensure all tests pass

## Epic 3: Autoscan Ergonomics & UX Clarity

- [x] 9. Guard rails for extraction failures
  - [x] 9.1 Improve error messages in BatchReviewPanel
    - Update `src/components/batch/BatchReviewPanel.tsx`
    - Show clear error messages for extraction failures
    - Include page/chunk identifiers when available
    - Ensure messages don't overflow on mobile
    - _Requirements: 7.1, 7.2, 7.4_

  - [x] 9.2 Add partial failure handling in ImportSetupPanel
    - Update `src/components/batch/ImportSetupPanel.tsx`
    - When extraction fails for some pages, show which failed
    - Suggest re-running specific chunks
    - _Requirements: 7.3_

- [x] 10. Clarify re-run vs append behavior
  - [x] 10.1 Add autoscan behavior hint to UI
    - Update `src/components/batch/BatchReviewPanel.tsx` or ImportSetupPanel
    - Show hint: "Re-running autoscan on the same chunk will skip exact duplicate questions automatically"
    - Hint must match actual duplicate rule (deck + session + normalizedStem)
    - _Requirements: 8.1_

  - [x] 10.2 Ensure consistent autoscan semantics
    - Duplicate protection (from 6.2) handles re-run case
    - Same chunk + same session = same result (idempotent via dedup)
    - No silent mode mixing - behavior is always "skip duplicates"
    - _Requirements: 8.2, 8.3, 8.4_

- [x] 11. Final Checkpoint - Ensure all tests pass
