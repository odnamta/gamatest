# Implementation Plan

## Schema Discovery Summary

**Canonical Tables (V2 Schema):**
- `card_templates` - MCQ content with stem, options, correct_index, explanation, source_meta
- `deck_templates` - Deck containers with author_id, visibility
- `sources` - PDF tracking (title, type, file_url, metadata)
- `tags` - 3-tier taxonomy with card_template_tags join table

**New Tables:**
- `book_sources` - Textbook/question bank metadata
- `book_chapters` - Chapter hierarchy within books
- `matching_groups` - Shared options for matching questions

**card_templates Extensions:**
- `book_source_id` (UUID FK nullable)
- `chapter_id` (UUID FK nullable)
- `question_number` (INTEGER nullable)
- `matching_group_id` (UUID FK nullable)

---

- [x] 1. Database Schema Migration
  - [x] 1.1 Create book_sources table with RLS
    - Create migration file `scripts/migrate-v11-structured-content.sql`
    - Add book_sources table with: id, author_id, title, edition, specialty, created_at
    - Add RLS policy for author ownership
    - Add index on author_id
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Create book_chapters table with RLS
    - Add book_chapters table with: id, book_source_id, chapter_number, title, expected_question_count, created_at
    - Add unique constraint on (book_source_id, chapter_number)
    - Add RLS policy via book_sources ownership
    - Add index on book_source_id
    - Add ON DELETE CASCADE from book_sources
    - _Requirements: 2.1, 2.4, 1.5_

  - [x] 1.3 Create matching_groups table with RLS
    - Add matching_groups table with: id, chapter_id, common_options, instruction_text, created_at
    - Add RLS policy via chapter/book ownership (allow null chapter_id)
    - Add index on chapter_id
    - Add ON DELETE SET NULL for chapter_id
    - _Requirements: 4.1, 4.5_

  - [x] 1.4 Extend card_templates table
    - Add nullable columns: book_source_id, chapter_id, question_number, matching_group_id
    - Add foreign key constraints with ON DELETE SET NULL
    - Add indexes on new FK columns
    - _Requirements: 3.1, 4.2, 2.5_

- [x] 2. TypeScript Types and Validation
  - [x] 2.1 Add database types
    - Add BookSource, BookChapter, MatchingGroup interfaces to `src/types/database.ts`
    - Extend CardTemplate interface with new nullable fields
    - Add ImportSessionContext type
    - _Requirements: 1.1, 2.1, 4.1, 3.1_

  - [x] 2.2 Create Zod validation schemas
    - Create `src/lib/structured-content-schema.ts`
    - Add bookSourceSchema with title validation (non-empty)
    - Add bookChapterSchema with chapter_number (positive) and title validation
    - Add matchingGroupSchema with common_options validation
    - _Requirements: 1.2, 2.2_

  - [x] 2.3 Write property tests for validation schemas
    - **Property 1: Book Source Title Validation**
    - **Property 2: Chapter Number Validation**
    - **Validates: Requirements 1.2, 2.2**

- [x] 3. Server Actions for Book/Chapter Management
  - [x] 3.1 Create book source actions
    - Create `src/actions/book-source-actions.ts`
    - Implement createBookSource with validation
    - Implement getBookSources (list for current author)
    - Implement updateBookSource
    - Implement deleteBookSource
    - _Requirements: 1.2, 1.3_

  - [x] 3.2 Create chapter actions
    - Create `src/actions/chapter-actions.ts`
    - Implement createChapter with validation
    - Implement getChaptersByBook (ordered by chapter_number)
    - Implement updateChapter
    - Implement deleteChapter
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 Write property tests for chapter ordering
    - **Property 3: Chapter Ordering**
    - **Validates: Requirements 2.3**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Import Setup UI Components
  - [x] 5.1 Create BookSourceSelector component
    - Create `src/components/batch/BookSourceSelector.tsx`
    - Fetch book_sources for current author
    - Dropdown with search/filter capability
    - "Create New" option with inline dialog
    - _Requirements: 5.1, 5.3_

  - [x] 5.2 Create ChapterSelector component
    - Create `src/components/batch/ChapterSelector.tsx`
    - Disabled state when no book selected
    - Fetch chapters filtered by book_source_id
    - Order by chapter_number ascending
    - "Create New" option with inline dialog
    - _Requirements: 5.2, 5.3_

  - [x] 5.3 Write property test for chapter filtering
    - **Property 8: Chapter Selector Filtering**
    - **Validates: Requirements 5.2**

  - [x] 5.4 Create ImportSetupPanel component
    - Create `src/components/batch/ImportSetupPanel.tsx`
    - Compose BookSourceSelector and ChapterSelector
    - Add optional "Expected Question Count" number input
    - Export ImportSessionContext to parent
    - _Requirements: 5.1, 5.2, 5.4_

  - [x] 5.5 Integrate ImportSetupPanel into bulk import flow
    - Update `src/app/(app)/decks/[id]/add-bulk/page.tsx` or equivalent
    - Add ImportSetupPanel before PDF viewer
    - Pass context to Auto-Scan hook
    - _Requirements: 5.5_

- [x] 6. Extend bulkCreateMCQV2 Action
  - [x] 6.1 Add optional parameters to bulkCreateMCQV2
    - Extend BulkCreateV2Input interface with bookSourceId, chapterId, matchingGroupId
    - Update function signature (all new params optional)
    - _Requirements: 9.5_

  - [x] 6.2 Implement card-chapter linking logic
    - When bookSourceId/chapterId provided, populate FK columns on insert
    - When not provided, leave as NULL (backwards compatible)
    - _Requirements: 3.2, 3.3_

  - [x] 6.3 Write property tests for card-chapter linking
    - **Property 4: Card-Chapter Linking with Context**
    - **Property 5: Card-Chapter Linking without Context**
    - **Property 16: Backwards Compatibility**
    - **Validates: Requirements 3.2, 3.3, 9.2, 9.5**

  - [x] 6.4 Update Auto-Scan hook to pass context
    - Update `src/hooks/use-auto-scan.ts`
    - Accept ImportSessionContext parameter
    - Pass bookSourceId, chapterId to bulkCreateMCQV2
    - _Requirements: 5.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Question Number Detection
  - [x] 8.1 Create QuestionNumberDetector utility
    - Create `src/lib/question-number-detector.ts`
    - Implement regex patterns for: "1.", "1)", "Q1", "Question 1"
    - Return DetectionResult with detectedNumbers and patterns
    - _Requirements: 7.1_

  - [x] 8.2 Write property tests for question number detection
    - **Property 11: Question Number Pattern Detection**
    - **Validates: Requirements 7.1**

  - [x] 8.3 Integrate detector into Auto-Scan
    - Call detectQuestionNumbers on extracted text before AI
    - Store detected numbers in session state
    - _Requirements: 7.2_

  - [x] 8.4 Create missing number calculation utility
    - Create function to compute set difference (detected - saved)
    - Return array of missing question numbers
    - _Requirements: 7.3_

  - [x] 8.5 Write property test for missing number calculation
    - **Property 12: Missing Question Number Calculation**
    - **Validates: Requirements 7.3, 7.4**

- [x] 9. QA Feedback Display
  - [x] 9.1 Create QAFeedbackBanner component
    - Create `src/components/batch/QAFeedbackBanner.tsx`
    - Display "Generated X / Expected Y cards" format
    - Warning state (amber) when X < Y
    - Success state (green) when X >= Y
    - Expandable list of missing question numbers
    - _Requirements: 6.1, 6.2, 6.3, 7.4_

  - [x] 9.2 Write property tests for QA display states
    - **Property 9: QA Warning Display**
    - **Property 10: QA Success Display**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 9.3 Integrate QAFeedbackBanner into batch review
    - Update BatchReviewPanel or post-import UI
    - Query card count by chapter_id (not tags)
    - Pass expected count from session context
    - Pass missing numbers from detection
    - _Requirements: 6.1, 6.4_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Matching Set Detection and Handling
  - [x] 11.1 Create MatchingSetDetector utility
    - Create `src/lib/matching-set-detector.ts`
    - Detect contiguous labeled options (A., B., C., etc.)
    - Detect subsequent numbered questions referencing options
    - Return MatchingBlock array with options and question numbers
    - _Requirements: 8.1_

  - [x] 11.2 Write property test for matching block detection
    - **Property 13: Matching Block Detection**
    - **Validates: Requirements 8.1**

  - [x] 11.3 Integrate detector into Auto-Scan pre-processing
    - Call detectMatchingBlocks on extracted text
    - Pass matching block metadata to AI prompt
    - _Requirements: 8.2_

  - [x] 11.4 Create matching group server action
    - Add createMatchingGroup to `src/actions/chapter-actions.ts`
    - Accept chapter_id, common_options, instruction_text
    - Return created group id
    - _Requirements: 4.1_

  - [x] 11.5 Extend bulkCreateMCQV2 for matching groups
    - When matching block detected, create matching_group first
    - Link all cards from block to the group
    - Ensure each card has full options (denormalized)
    - _Requirements: 8.3, 8.4, 4.3_

  - [x] 11.6 Write property tests for matching group handling
    - **Property 7: Matching Group Card Denormalization**
    - **Property 14: Matching Block Card Options**
    - **Property 15: Matching Group Linking**
    - **Validates: Requirements 4.3, 8.3, 8.4**

- [x] 12. Card Query by Chapter
  - [x] 12.1 Create getCardsByChapter action
    - Add to `src/actions/chapter-actions.ts`
    - Query card_templates filtered by chapter_id
    - Return cards with full template data
    - _Requirements: 3.4_

  - [x] 12.2 Write property test for chapter card query
    - **Property 6: Chapter Card Query Correctness**
    - **Validates: Requirements 3.4**

- [x] 13. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
