# Implementation Plan: V7.1 Auto-Scan Loop Stabilization Hotfix

**Ground truth**: Auto-Scan must call `draftBatchMCQFromText` and `bulkCreateMCQV2` with the same `(deckTemplateId, sourceId, sessionTags, cards[])` shape as manual Scan Page.

## Fix Set 1 — Deck Template Wiring (BLOCKER)

- [x] 1. Fix useAutoScan hook ID handling
  - [x] 1.1 Add console.log instrumentation to bulkCreateMCQV2 to print deckTemplateId, sourceId
    - Log at start of function: `console.log('[bulkCreateMCQV2] Called with:', { deckTemplateId, sessionTags: sessionTags?.length, cardsCount: cards?.length })`
    - _Requirements: 1.1, 1.4_
  - [x] 1.2 Add `canStart` computed property to useAutoScan return
    - Return `canStart: !!(pdfDocument && deckId && sourceId)`
    - Prevents scan start when IDs are missing
    - _Requirements: 1.2, 1.3_
  - [x] 1.3 Write property test for ID consistency
    - **Property 1: Auto-Scan ID Consistency**
    - **Validates: Requirements 1.1, 1.2**
  - [x] 1.4 Write property test for initialization validity
    - **Property 2: Initialization Validity**
    - **Validates: Requirements 1.2, 1.3**
  - [x] 1.5 Wire IDs from page into hook
    - Pass `deckId` (from route params) and `linkedSource.id` from add-bulk/page.tsx into `useAutoScan({...})`
    - Ensure `processPage` uses these same values when calling `bulkCreateMCQV2`
    - Verify the call site in page.tsx passes non-empty strings (not undefined)
    - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Fix bulkCreateMCQV2 error message
  - [x] 2.1 Update NOT_FOUND error to include received deckTemplateId
    - Change error message to: `Deck template not found for id=${deckTemplateId}`
    - _Requirements: 1.4_

## Fix Set 2 — Resume Logic (PDF Reload UX)

- [x] 3. Fix resume flow in useAutoScan
  - [x] 3.1 Fix startScan to use savedState.currentPage when resuming
    - When `hasResumableState` is true and startScan called without explicit page, use saved page
    - Only reset stats when starting fresh (page 1)
    - _Requirements: 2.1, 2.4_
  - [x] 3.2 Write property test for resume page preservation
    - **Property 3: Resume Page Preservation**
    - **Validates: Requirements 2.1, 2.4**

- [x] 4. Update AutoScanResumeBanner text
  - [x] 4.1 Change banner message to guide PDF re-upload
    - New text: "Last scan stopped at Page X. Please re-select your PDF to resume."
    - _Requirements: 2.2_

- [x] 5. Update AutoScanControls button state
  - [x] 5.1 Disable Start button when canStart is false
    - Pass `canStart` from useAutoScan to AutoScanControls
    - Disable button when `disabled || !canStart`
    - _Requirements: 2.3_
  - [x] 5.2 Write property test for button disabled state
    - **Property 4: Start Button Disabled Without PDF**
    - **Validates: Requirements 2.3**

## Fix Set 3 — Append & +1 Page Wiring

- [x] 6. Fix Append Next Page functionality
  - [x] 6.1 Update handleAppendNextPage to properly update textarea state
    - Ensure textarea is fully controlled by `stitchedText` state (bind `value={stitchedText}`)
    - Append updates `stitchedText` only; React re-renders the textarea automatically
    - Do NOT write to `textAreaRef.current.value` directly — single source of truth is state
    - _Requirements: 3.1_
  - [x] 6.2 Write property test for append updates textarea
    - **Property 5: Append Updates Textarea State**
    - **Validates: Requirements 3.1**

- [x] 7. Wire +1 Page checkbox
  - [x] 7.1 Ensure includeNextPage state is passed to handleScanPage
    - Verify checkbox onChange updates `includeNextPage` state
    - Verify `handleScanPage` uses `includeNextPage` for text extraction
    - _Requirements: 3.2_
  - [x] 7.2 Update Scan Page button text based on includeNextPage
    - When checked: "Scan Pages {currentPage} & {currentPage + 1}"
    - When unchecked: "Scan Page {currentPage}"
    - _Requirements: 3.3_
  - [x] 7.3 Write property test for include next page combines text
    - **Property 6: Include Next Page Combines Text**
    - **Validates: Requirements 3.2**

## Fix Set 4 — Loop Robustness

- [x] 8. Fix consecutive error counting logic
  - [x] 8.1 Update processPage to distinguish empty results from errors
    - Definition of "error": any thrown exception OR `{ ok: false }` from draft/save calls
    - Definition of "success": `{ ok: true }` regardless of card count (including 0 MCQs)
    - 0 MCQs from draftBatchMCQFromText with `ok: true` = success, reset consecutiveErrors
    - Only increment consecutiveErrors on actual errors (thrown exception or `ok: false`)
    - _Requirements: 4.1, 4.2_
  - [x] 8.2 Write property test for empty pages don't increment errors
    - **Property 7: Empty Pages Don't Increment Errors**
    - **Validates: Requirements 4.1**
  - [x] 8.3 Write property test for actual errors increment counter
    - **Property 8: Actual Errors Increment Counter**
    - **Validates: Requirements 4.2**

- [x] 9. Add offline detection
  - [x] 9.1 Add navigator.onLine check and event listener
    - Add `window.addEventListener('offline', handler)` inside a useEffect
    - Clean up with `window.removeEventListener('offline', handler)` in the effect's cleanup function
    - When offline detected during scan: call pauseScan(), show toast "Connection lost, scan paused"
    - _Requirements: 4.4_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Final Verification

- [x] 11. Manual verification against ground truth
  - [x] 11.1 Compare Auto-Scan vs Manual Scan Page parameters
    - Run both paths with console logging
    - Verify deckTemplateId, sessionTags, cards structure match exactly
    - _Requirements: 1.1, 1.5_
  - [x] 11.2 Test full resume flow
    - Start scan, refresh page mid-scan, re-upload PDF, click Resume
    - Verify scan continues from saved page
    - _Requirements: 2.1, 2.2, 2.4, 2.5_

- [x] 12. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.