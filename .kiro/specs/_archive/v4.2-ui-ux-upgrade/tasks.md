# Implementation Plan – V4.2 UI/UX Upgrade Pack

## Feature Set A: MCQ Editor UI Overhaul

- [x] 1. Improve MCQ form in EditCardForm
  - [x] 1.1 Add dynamic option management
    - Add "Add Option" button (visible when < 5 options)
    - Add "Remove" (×) button on each option (visible when > 2 options)
    - Adjust correctIndex when removing options above it
    - _Req: A.2, A.3_
  - [x] 1.2 Implement keyboard shortcuts
    - Enter in option field → add new option below (if < 5)
    - Cmd/Ctrl+Enter anywhere → submit form
    - _Req: A.4, A.5_
  - [x] 1.3 Add mobile floating save button
    - Fixed position button at bottom-right on mobile (< 640px)
    - Use sm:hidden to hide on desktop
    - _Req: A.6_
  - [x] 1.4 Polish form spacing
    - Consistent gap-3 between option rows
    - Improve label font-medium styling
    - Ensure explanation textarea expands gracefully (min-h, resize-y)
    - _Req: A.1, A.7_

## Feature Set B: Duplicate Card

- [x] 2. Implement card duplication
  - [x] 2.1 Add duplicateCard server action
    - Add to `src/actions/card-actions.ts`
    - Fetch original card with ownership check
    - Create new card with new UUID (Supabase generates)
    - Append " (copy)" to stem (MCQ) or front (flashcard)
    - Copy all other fields including SM-2 defaults for new card
    - _Req: B.2, B.3, B.4_
  - [x] 2.2 Add Duplicate button to CardListItem
    - Add Copy icon button between Edit and Delete
    - Pass onDuplicate callback prop
    - _Req: B.1_
  - [x] 2.3 Wire up duplication in CardList
    - Add handleDuplicate function
    - Call duplicateCard action
    - Show success toast: "Card duplicated"
    - Show error toast on failure
    - router.refresh() on success
    - _Req: B.5, B.6_

## Feature Set C: Deck Bulk Actions

- [x] 3. Implement bulk selection
  - [x] 3.1 Add selection state to CardList
    - Add `selectedIds: Set<string>` state
    - Add toggleSelection, selectAll, clearSelection functions
    - _Req: C.1_
  - [x] 3.2 Add checkbox to CardListItem
    - Add checkbox input on left side
    - Add `isSelected` and `onToggleSelect` props
    - Visual feedback for selected state (bg highlight)
    - _Req: C.1_

- [x] 4. Implement bulk actions UI
  - [x] 4.1 Create BulkActionsBar component
    - Location: `src/components/cards/BulkActionsBar.tsx`
    - Props: selectedCount, onDelete, onMove, onExport, onClear
    - Sticky top positioning, blue-50 background
    - Show only when selectedCount > 0
    - _Req: C.2, C.3_
  - [x] 4.2 Wire BulkActionsBar in CardList
    - Render above card list when selections exist
    - Pass handlers for each action
    - _Req: C.2_

- [x] 5. Implement bulk delete
  - [x] 5.1 Add bulkDeleteCards server action
    - Input: cardIds array
    - Verify ownership of all cards via deck join
    - Delete all in single query
    - Return { ok: true, count } or error
    - _Req: C.4, C.5_
  - [x] 5.2 Wire bulk delete in CardList
    - Show confirmation: "Delete X cards?"
    - Call bulkDeleteCards
    - Toast: "X cards deleted"
    - Clear selection, refresh
    - _Req: C.4, C.5_

- [x] 6. Implement bulk move
  - [x] 6.1 Add bulkMoveCards server action
    - Input: cardIds array, targetDeckId
    - Verify ownership of source cards and target deck
    - Update deck_id for all cards
    - Return { ok: true, count } or error
    - _Req: C.6, C.7_
  - [x] 6.2 Create DeckSelector component
    - Location: `src/components/cards/DeckSelector.tsx`
    - Fetch user's decks (exclude current)
    - Dropdown or modal UI
    - _Req: C.6_
  - [x] 6.3 Wire bulk move in CardList
    - Show DeckSelector on "Move to..." click
    - Call bulkMoveCards with selected deck
    - Toast: "X cards moved to {deck}"
    - Clear selection, refresh
    - _Req: C.6, C.7_

- [x] 7. Implement bulk export
  - [x] 7.1 Add export handler in CardList
    - Filter cards by selectedIds
    - Build JSON array with card data
    - Create Blob and trigger download
    - Filename: {deckTitle}-export.json
    - _Req: C.8, C.9_

## Feature Set D: Premium UI Polish

- [x] 8. Apply visual polish
  - [x] 8.1 Update CardListItem styling
    - Change rounded-lg to rounded-xl
    - Add hover:shadow-md transition
    - _Req: D.1, D.5_
  - [x] 8.2 Add card list dividers
    - Wrap list in divide-y divide-slate-100 dark:divide-slate-700/50
    - Adjust card item padding if needed
    - _Req: D.4_
  - [x] 8.3 Verify color consistency
    - Audit primary buttons use blue-600 hover:blue-700
    - Secondary text uses slate-600 dark:slate-400
    - _Req: D.6_

## Feature Set E: Duplicate Card Bugfix (v4.2.1)

- [x] 10. Fix NOT NULL constraint error when duplicating MCQ cards
  - [x] 10.1 Update duplicateCard server action
    - Add `front` and `back` fields to MCQ card duplication
    - MCQ cards use empty strings for front/back (matching createMCQAction)
    - Ensure all NOT NULL columns are populated
    - _Req: B.2, B.3, B.4_
  - [x] 10.2 Add property tests for card duplication
    - Create `src/__tests__/duplicate-card.property.test.ts`
    - Test MCQ duplication produces valid card with non-null front/back
    - Test flashcard duplication copies front/back with "(copy)" suffix
    - Test duplicated card has fresh SM-2 scheduling defaults
    - _Req: B.2, B.3, B.4_

## Final Checkpoint

- [x] 11. Testing and review
  - [x] 11.1 Manual testing
    - Test MCQ form: add/remove options, keyboard shortcuts
    - Test duplicate card for both MCQ and flashcard
    - Test bulk select, delete, move, export
    - Test on mobile viewport (320px, 375px)
    - Verify all toasts work
    - _Req: All_
  - [x] 11.2 Final review
    - Run npm run build
    - Verify no console errors
    - Commit + push changes
