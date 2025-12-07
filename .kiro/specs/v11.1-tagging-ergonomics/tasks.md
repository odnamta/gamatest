# Implementation Plan

## Summary

V11.1 enhances tagging workflows with:
- Floating Bulk Action Bar for batch operations
- TagSelector with "Create at Top" UX
- Virtual Source badges from `book_sources`
- Unified FilterBar with Source section
- Sticky import context in localStorage

**Key Constraint:** Do NOT create tags to represent Sources. `book_sources` and `card_templates.book_source_id` are the single source of truth.

---

- [x] 1. Enhanced TagSelector with Create at Top
  - [x] 1.1 Add search input to TagSelector
    - Add `searchQuery` state to TagSelector component
    - Add search input field at top of dropdown
    - Filter displayed tags by search query (case-insensitive)
    - _Requirements: 2.3_

  - [x] 1.2 Implement Create option logic
    - Add `shouldShowCreateOption` computed value
    - Show Create option when: query non-empty AND no exact match (case-insensitive)
    - Hide Create option when: query empty OR matches existing tag
    - _Requirements: 2.1, 2.5_

  - [x] 1.3 Pin Create option at top of dropdown
    - Render Create option BEFORE filtered tag list
    - Style with Plus icon and "Create '<query>' tag" text
    - Add visual distinction (border-bottom, different background)
    - _Requirements: 2.1, 2.4_

  - [x] 1.4 Implement keyboard navigation for Create
    - Track highlighted option index (Create = 0 when visible)
    - Enter key on Create option: create tag and select it
    - Arrow keys navigate through options
    - _Requirements: 2.2_

  - [x] 1.5 Write property tests for Create option
    - **Property 3: Create Option Position**
    - **Property 4: Create Option Suppression**
    - **Validates: Requirements 2.1, 2.3, 2.5**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Virtual Source Badge Display
  - [x] 3.1 Create SourceBadge component
    - Create `src/components/cards/SourceBadge.tsx`
    - Blue badge with BookOpen icon and title
    - Visually distinct from topic tags (blue color scheme)
    - _Requirements: 3.2, 3.3_

  - [x] 3.2 Update deck page query to join book_sources
    - Modify `getDeckWithCards` or equivalent action
    - LEFT JOIN book_sources on card_templates.book_source_id
    - Return book_source title with each card
    - _Requirements: 3.2_

  - [x] 3.3 Integrate SourceBadge into CardListItem
    - Check for `card.book_source` in CardListItem
    - Render SourceBadge before topic tags when present
    - Do NOT render when book_source is null
    - _Requirements: 3.2, 3.5_

  - [x] 3.4 Write property tests for Source badge
    - **Property 5: Source Badge Presence**
    - **Property 6: Source Badge Absence**
    - **Property 7: No Tag Creation for Source Badge**
    - **Validates: Requirements 3.2, 3.4, 3.5**

- [x] 4. Unified FilterBar with Source Section
  - [x] 4.1 Extend FilterBar props for source filtering
    - Add `availableSources`, `selectedSourceIds`, `onSourcesChange` props
    - Make source props optional for backwards compatibility
    - _Requirements: 4.1, 6.1_

  - [x] 4.2 Add Source filter section to FilterBar
    - Add "By Source" section with BookOpen icon
    - List distinct sources as filter buttons
    - Toggle selection on click
    - _Requirements: 4.1, 4.2_

  - [x] 4.3 Compute available sources from cards
    - In CardList, extract distinct book_sources from cards
    - Pass to FilterBar as availableSources
    - _Requirements: 4.2_

  - [x] 4.4 Implement source filtering logic in CardList
    - Add `filterSourceIds` state
    - Filter cards by book_source_id when source filter active
    - Combine with existing tag filter using AND logic
    - _Requirements: 4.3, 4.5, 4.6_

  - [x] 4.5 Write property tests for source filtering
    - **Property 8: Source Filter Distinct Sources**
    - **Property 9: Source Filter Correctness**
    - **Property 10: Combined Filter AND Logic**
    - **Validates: Requirements 4.2, 4.3, 4.5, 4.6**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Bulk Action Bar Enhancements
  - [x] 6.1 Verify floating behavior of BulkActionsBar
    - Ensure BulkActionsBar uses `fixed bottom-4` positioning
    - Verify it appears when selectedCount > 0
    - Verify it disappears when selection cleared
    - _Requirements: 1.1_

  - [x] 6.2 Verify Add Tag button and modal flow
    - Confirm "Add Tag" button exists in BulkActionsBar
    - Confirm clicking opens BulkTagModal
    - Confirm modal uses enhanced TagSelector
    - _Requirements: 1.2, 1.3_

  - [x] 6.3 Test bulk tagging with 50+ cards
    - Verify bulkAddTagToCards handles large batches
    - Confirm batching in chunks of 100 (existing logic)
    - Verify no timeout or lag with 50+ cards
    - _Requirements: 1.4, 1.5_

  - [x] 6.4 Write property tests for bulk tagging
    - **Property 1: Bulk Action Bar Visibility**
    - **Property 2: Bulk Tag Application Completeness**
    - **Validates: Requirements 1.1, 1.4**

- [x] 7. Sticky Import Session Context
  - [x] 7.1 Create import context storage utilities
    - Create `src/lib/import-context-storage.ts`
    - Implement `getImportContext(deckId)` function
    - Implement `setImportContext(deckId, context)` function
    - Implement `clearImportContext(deckId)` function
    - Use deck-scoped localStorage key: `specialize:import-context:{deckId}`
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 7.2 Integrate storage into ImportSetupPanel
    - Load initial context from localStorage on mount
    - Save context to localStorage on changes
    - Handle bookSourceId, chapterId persistence
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 7.3 Integrate storage into session tags hook
    - Update `useSessionTags` hook to use import context storage
    - Persist sessionTagIds alongside book/chapter
    - Restore on page load
    - _Requirements: 5.3, 5.4_

  - [x] 7.4 Handle deck changes appropriately
    - Clear or update context when deck changes
    - Ensure no cross-deck pollution
    - _Requirements: 5.5, 5.6_

  - [x] 7.5 Write property tests for import context
    - **Property 11: Import Context Persistence**
    - **Property 12: Import Context Restoration**
    - **Property 13: Import Context Deck Scoping**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**

- [x] 8. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

