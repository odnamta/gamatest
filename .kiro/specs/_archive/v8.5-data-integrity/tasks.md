# Implementation Plan

## Fix 1: Tag Display on Read-Side

- [x] 1. Add tag fetching to deck detail page
  - [x] 1.1 Update card query to join with card_template_tags and tags
    - Modify the Supabase query in deck detail page to include nested select
    - Query: `card_templates` → `card_template_tags` → `tags (id, name, color)`
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Update card type to include tags array
    - Add `tags: { id: string; name: string; color: string }[]` to card type
    - Handle null/empty tags gracefully
    - _Requirements: 1.3_
  - [x] 1.3 Display tags as colored badges on each card
    - Render tags below the card stem or in a dedicated tags section
    - Use tag color for badge background
    - _Requirements: 1.4_
  - [x] 1.4 Write property test for tag fetch completeness
    - **Property 1: Tag fetch includes all linked tags**
    - **Validates: Requirements 1.1, 1.2**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fix 2: AI Tag Enforcement

- [x] 3. Make tags mandatory in schema
  - [x] 3.1 Update mcqBatchItemSchema to require tags
    - Remove `.optional()` from tags field
    - Keep `.min(1)` and `.max(3)` constraints
    - Add `.min(1)` to individual tag strings to reject empty strings
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Verify validation filters out tagless questions
    - Questions failing validation are already filtered in draftBatchMCQFromText
    - Add logging: `[draftBatchMCQFromText] Filtered X questions with invalid tags`
    - _Requirements: 2.4_
  - [x] 3.3 Write property test for tag validation rejection
    - **Property 2: Tag validation rejects empty tags**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 3.4 Write property test for valid tags acceptance
    - **Property 3: Valid tags pass validation**
    - **Validates: Requirements 2.1**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fix 3: AI Extraction Thoroughness

- [x] 5. Add forensic mode to AI prompts
  - [x] 5.1 Update BATCH_EXTRACT_SYSTEM_PROMPT with forensic mode
    - Add "FORENSIC MODE" section with explicit instructions
    - Instruct AI to scan entire text for ALL MCQs
    - Instruct AI to not skip any questions
    - Instruct AI to generate at least 1 tag per question
    - _Requirements: 3.1, 3.3_
  - [x] 5.2 Update BATCH_GENERATE_SYSTEM_PROMPT similarly
    - Add same forensic mode instructions for generate mode
    - Emphasize thoroughness and mandatory tags
    - _Requirements: 3.1, 3.3_
  - [x] 5.3 Verify question ordering is preserved
    - AI responses should maintain order from source text
    - No code change needed - just verify in prompts
    - _Requirements: 3.4_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fix 4: Resume Logic Clarity

- [x] 7. Add explicit isResuming flag to startScan
  - [x] 7.1 Update startScan interface to accept options object
    - Change from `startScan(startPage?: number)` to `startScan(options?: StartScanOptions)`
    - Define `StartScanOptions { startPage?: number; isResuming?: boolean }`
    - _Requirements: 4.1_
  - [x] 7.2 Implement isResuming logic in startScan
    - If `isResuming === true`: Use saved currentPage from state, preserve stats
    - If `isResuming === false` or undefined: Use startPage or default to 1, reset stats
    - _Requirements: 4.2, 4.3_
  - [x] 7.3 Update resume() to call startScan with isResuming: true
    - Simplify resume() to delegate to startScan({ isResuming: true })
    - _Requirements: 4.1_
  - [x] 7.4 Update BulkImportClient to pass correct flags
    - Resume button: `startScan({ isResuming: true })`
    - Start Fresh button: `startScan({ startPage: 1, isResuming: false })`
    - _Requirements: 4.1_
  - [x] 7.5 Write property test for resume flag behavior
    - **Property 4: Resume flag uses saved page**
    - **Validates: Requirements 4.1, 4.2**
  - [x] 7.6 Write property test for fresh start behavior
    - **Property 5: Fresh start ignores saved page**
    - **Validates: Requirements 4.3**

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Final Verification

- [ ] 9. Manual end-to-end verification
  - [ ] 9.1 Test tag display on deck detail page
    - Create cards with AI tags via Auto-Scan
    - Navigate to deck detail page
    - Verify tags are displayed as colored badges
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 9.2 Test AI tag enforcement
    - Run Auto-Scan on a PDF page
    - Verify all generated MCQs have at least 1 tag
    - Check console for any filtered questions
    - _Requirements: 2.1, 2.2, 2.4_
  - [ ] 9.3 Test resume flag behavior
    - Start Auto-Scan, pause after 2-3 pages
    - Click Resume and verify it continues from saved page
    - Click Start Fresh and verify it starts from page 1
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 10. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
