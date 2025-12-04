# Implementation Plan

## V9.1: The Commander

- [x] 1. Database Schema Extension
  - [x] 1.1 Create migration script for subject column
    - Create `scripts/migrate-v9.1-subject.sql`
    - Add `subject TEXT DEFAULT 'Obstetrics & Gynecology'` to `deck_templates`
    - Include backfill for existing rows with NULL subject
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 Update TypeScript types
    - Add `subject?: string` to `DeckTemplate` interface in `src/types/database.ts`
    - _Requirements: 5.4_

- [x] 2. Bulk Tagging Server Actions
  - [x] 2.1 Create `getAllCardIdsInDeck` action
    - Add to `src/actions/card-actions.ts`
    - Query all card_template IDs for a deck_template
    - Verify user is author before returning IDs
    - _Requirements: 1.4_
  - [x] 2.2 Create `bulkAddTagToCards` action
    - Add to `src/actions/tag-actions.ts`
    - Accept `cardIds: string[]` and `tagId: string`
    - Verify user is author of all cards via deck_template.author_id
    - Batch inserts in chunks of 100
    - Use `ON CONFLICT DO NOTHING` for idempotence
    - Return count of newly tagged cards
    - _Requirements: 2.3, 2.4, 2.6, 2.7_
  - [x] 2.3 Write property test for bulk tag batching
    - **Property 3: Bulk Tag Batching**
    - **Validates: Requirements 2.4**
  - [x] 2.4 Write property test for bulk tag idempotence
    - **Property 4: Bulk Tag Idempotence**
    - **Validates: Requirements 2.7**
  - [x] 2.5 Write property test for bulk tag authorization
    - **Property 8: Bulk Tag Authorization**
    - **Validates: Requirements 2.3, 2.6**

- [x] 3. Bulk Tagging UI Components
  - [x] 3.1 Create BulkTagModal component
    - Create `src/components/cards/BulkTagModal.tsx`
    - Display TagSelector for tag selection
    - Show count of cards to be tagged
    - Handle loading state during operation
    - Display success/error toast on completion
    - _Requirements: 2.1, 2.2, 2.5_
  - [x] 3.2 Enhance BulkActionsBar with Add Tag button
    - Add `onAddTag` prop to `BulkActionsBar`
    - Render "Add Tag" button when cards are selected
    - _Requirements: 2.1_
  - [x] 3.3 Enhance CardList with Select All in Deck
    - Add `selectAllInDeck` handler that calls `getAllCardIdsInDeck`
    - Add loading state for async selection
    - Update UI to show "Select All in Deck" option
    - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - [x] 3.4 Write property test for select all completeness
    - **Property 1: Select All Completeness**
    - **Validates: Requirements 1.1, 1.4**

- [x] 4. Checkpoint - Bulk Tagging Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Multi-Specialty AI Support
  - [x] 5.1 Update AI prompt builders with dynamic subject
    - Modify `getSystemPrompt` in `src/actions/ai-actions.ts`
    - Modify `getBatchSystemPrompt` in `src/actions/batch-mcq-actions.ts`
    - Replace hardcoded "obstetrics and gynecology" with `subject` parameter
    - Default to "Obstetrics & Gynecology" when subject is null/empty
    - _Requirements: 3.4, 3.5_
  - [x] 5.2 Update draftMCQFromText to accept subject
    - Add `subject?: string` to `DraftMCQInput` schema
    - Pass subject to system prompt builder
    - _Requirements: 3.4_
  - [x] 5.3 Update draftBatchMCQFromText to accept subject
    - Add `subject?: string` to `DraftBatchInput` schema
    - Pass subject to system prompt builder
    - _Requirements: 3.4_
  - [x] 5.4 Write property test for subject fallback
    - **Property 5: Subject Fallback**
    - **Validates: Requirements 3.3, 5.3**
  - [x] 5.5 Write property test for dynamic subject interpolation
    - **Property 6: Dynamic Subject Interpolation**
    - **Validates: Requirements 3.4, 3.5**

- [x] 6. Deck Subject UI
  - [x] 6.1 Add Subject field to deck creation form
    - Update deck creation UI to include Subject dropdown/input
    - Default to "Obstetrics & Gynecology"
    - Common options: OBGYN, Internal Medicine, Pediatrics, Surgery, etc.
    - _Requirements: 3.1_
  - [x] 6.2 Add Subject field to deck edit form
    - Update deck settings/edit UI to show current subject
    - Allow changing subject
    - _Requirements: 3.2_
  - [x] 6.3 Pass deck subject to AI actions from bulk import
    - Fetch deck_template.subject in BulkImportPage
    - Pass subject to draftBatchMCQFromText calls
    - _Requirements: 3.4_

- [x] 7. Checkpoint - Multi-Specialty Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Author Guardrails (Beta Tester Protection)
  - [x] 8.1 Audit and verify isAuthor checks in DeckDetailsPage
    - Confirm `isAuthor = deckTemplate.author_id === user.id` is computed
    - Verify Add Card form is wrapped with `{isAuthor && ...}`
    - Verify Bulk Import button is wrapped with `{isAuthor && ...}`
    - _Requirements: 4.1, 4.2, 4.5_
  - [x] 8.2 Audit and verify isAuthor checks in CardList
    - Confirm `isAuthor` prop is passed to CardList
    - Verify BulkActionsBar is wrapped with `{isAuthor && ...}`
    - Verify edit/delete buttons in CardListItem respect isAuthor
    - _Requirements: 4.3, 4.4_
  - [x] 8.3 Audit BulkImportPage for author check
    - Verify page checks author status before rendering import UI
    - Redirect or show error for non-authors
    - _Requirements: 4.2_
  - [x] 8.4 Write property test for author control visibility
    - **Property 7: Author Control Visibility**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

- [x] 9. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

