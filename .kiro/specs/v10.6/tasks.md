# Implementation Plan

## V10.6: The Digital Notebook & Search

- [x] 1. Database Schema & Types
  - [x] 1.1 Create migration script for user_card_progress columns
    - Add `is_flagged` boolean column with default false
    - Add `notes` text column with default null
    - Create migration file in `scripts/migrate-v10.6-notebook.sql`
    - _Requirements: 6.1, 6.2_
  - [x] 1.2 Update TypeScript types
    - Add `is_flagged` and `notes` to UserCardProgress interface in `src/types/database.ts`
    - _Requirements: 6.1, 6.2_
  - [x] 1.3 Write property test for progress record defaults
    - **Property 9: Progress Record Defaults**
    - **Validates: Requirements 6.1, 6.2**

- [x] 2. Flag Toggle Feature
  - [x] 2.1 Create toggleCardFlag server action
    - Create `src/actions/notebook-actions.ts`
    - Implement upsert logic for is_flagged toggle
    - Return new flag state
    - _Requirements: 1.1, 6.3_
  - [x] 2.2 Write property test for flag toggle
    - **Property 1: Flag Toggle Inverts State**
    - **Validates: Requirements 1.1**
  - [x] 2.3 Write property test for upsert creates record
    - **Property 10: Upsert Creates Record**
    - **Validates: Requirements 6.3, 6.4**
  - [x] 2.4 Create FlagIcon component
    - Create `src/components/study/FlagIcon.tsx`
    - Implement filled/outline bookmark icons based on state
    - Add optimistic update with error rollback
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 2.5 Write property test for flag icon rendering
    - **Property 2: Flag Icon Reflects State**
    - **Validates: Requirements 1.2, 1.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Notes Feature
  - [x] 4.1 Create saveCardNotes server action
    - Add to `src/actions/notebook-actions.ts`
    - Implement upsert logic for notes field
    - _Requirements: 2.2, 6.4_
  - [x] 4.2 Create NotesSection component
    - Create `src/components/study/NotesSection.tsx`
    - Implement collapsible section with textarea
    - Add auto-save with 1000ms debounce using use-debounce
    - Add save status indicator (Saving.../Saved)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x] 4.3 Write property test for notes round-trip
    - **Property 3: Notes Round-Trip Consistency**
    - **Validates: Requirements 2.6**

- [x] 5. Integrate Flag & Notes into Study Components
  - [x] 5.1 Update Flashcard component
    - Import and add FlagIcon to top-right corner
    - Add NotesSection below the back content when revealed
    - Pass cardTemplateId and current flag/notes state
    - _Requirements: 1.2, 2.1_
  - [x] 5.2 Update MCQQuestion component
    - Import and add FlagIcon to top-right corner
    - Add NotesSection below the explanation when answered
    - Pass cardTemplateId and current flag/notes state
    - _Requirements: 1.2, 2.1_
  - [x] 5.3 Update study page data fetching
    - Include is_flagged and notes in card progress queries
    - Pass data to Flashcard/MCQQuestion components
    - _Requirements: 2.6_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Global Search Feature
  - [x] 7.1 Create searchCards server action
    - Add to `src/actions/notebook-actions.ts`
    - Query card_templates with ILIKE on stem and explanation
    - Filter by user's subscribed decks via user_decks
    - Limit to 10 results
    - Return card id, stem snippet, deck title
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 7.2 Write property test for search subscription filter
    - **Property 4: Search Results Subscription Filter**
    - **Validates: Requirements 3.2**
  - [x] 7.3 Write property test for search results limit
    - **Property 5: Search Results Limit**
    - **Validates: Requirements 3.3**
  - [x] 7.4 Write property test for search results contain query
    - **Property 6: Search Results Contain Query**
    - **Validates: Requirements 3.1**
  - [x] 7.5 Create SearchBar component
    - Create `src/components/search/SearchBar.tsx`
    - Implement debounced input (300ms)
    - Show loading spinner during search
    - Display results dropdown with snippets
    - _Requirements: 3.4, 3.6, 3.7_
  - [x] 7.6 Create SearchResults dropdown component
    - Create `src/components/search/SearchResults.tsx`
    - Display card stem and deck title
    - Handle click to open preview modal
    - Handle empty state
    - _Requirements: 3.4, 3.5, 3.6_

- [x] 8. Single Card Preview Modal
  - [x] 8.1 Create SingleCardPreviewModal component
    - Create `src/components/search/SingleCardPreviewModal.tsx`
    - Fetch full card data on open
    - Display stem, options (MCQ), explanation
    - Include FlagIcon and NotesSection
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 8.2 Write property test for preview modal content
    - **Property: Preview displays all required fields**
    - **Validates: Requirements 4.1**

- [x] 9. Integrate Search into Dashboard
  - [x] 9.1 Add SearchBar to DashboardHero
    - Import SearchBar component
    - Position in header area
    - Wire up SingleCardPreviewModal
    - _Requirements: 3.5_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Flagged Study Mode
  - [x] 11.1 Update ConfigureSessionModal
    - Add "Study Flagged Cards Only" toggle
    - Add flaggedOnly to CustomSessionConfig type
    - Update buildCustomStudyUrl to include flagged param
    - _Requirements: 5.1_
  - [x] 11.2 Update getCustomSessionCards action
    - Add flaggedOnly filter parameter
    - Filter by is_flagged = true when enabled
    - Apply AND logic with existing filters
    - Handle empty flagged cards case
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 11.3 Write property test for flagged filter
    - **Property 7: Flagged Filter Correctness**
    - **Validates: Requirements 5.2**
  - [x] 11.4 Write property test for combined filters
    - **Property 8: Combined Filters AND Logic**
    - **Validates: Requirements 5.4**

- [x] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
