# Implementation Plan

## Fix 1: Resume State Persistence

- [x] 1. Fix state persistence timing in useAutoScan
  - [x] 1.1 Add synchronous persistState call in runScanIteration after successful page processing
    - Modify `runScanIteration` to call `persistState()` immediately after updating stats and before `setTimeout` for next iteration
    - This ensures currentPage is saved before advancing
    - _Requirements: 1.1_
  - [x] 1.2 Verify pauseScan calls persistState
    - Confirm `pauseScan` already calls `persistState()` (it does per code review)
    - Add console.log to verify it fires on pause
    - _Requirements: 1.2_
  - [x] 1.3 Write property test for state persistence timing
    - **Property 1: State persistence before page advance**
    - **Validates: Requirements 1.1**
  - [x] 1.4 Write property test for pause persistence
    - **Property 2: Pause triggers immediate persist**
    - **Validates: Requirements 1.2**

- [x] 2. Verify resume state hydration
  - [x] 2.1 Add logging when loadAutoScanState finds resumable state
    - Log `[useAutoScan] Found resumable state at page X with Y cards created`
    - _Requirements: 3.3_
  - [x] 2.2 Verify hasResumableState is set correctly on mount
    - Confirm the useEffect that calls `loadAutoScanState` sets `hasResumableState` when `saved.isScanning` is true
    - _Requirements: 1.3_
  - [x] 2.3 Write property test for resumable state detection
    - **Property 3: Resumable state detection**
    - **Validates: Requirements 1.3**

- [x] 3. Verify resume preserves stats
  - [x] 3.1 Audit resume function to ensure stats are not reset
    - Confirm `resume()` does not call `setStats(getInitialStats())`
    - Stats should remain at hydrated values from localStorage
    - _Requirements: 1.4_
  - [x] 3.2 Write property test for resume stats preservation
    - **Property 4: Resume preserves stats**
    - **Validates: Requirements 1.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - All 594 tests pass ✓

## Fix 2: AI Tag Persistence

- [x] 5. Add defensive checks and logging in bulkCreateMCQV2
  - [x] 5.1 Add null/undefined check for card.tagNames
    - Before iterating `cards[i].tagNames`, check if it exists and is an array
    - Default to empty array if undefined: `const cardTags = cards[i].tagNames || []`
    - _Requirements: 2.1_
  - [x] 5.2 Add logging for tag resolution
    - Log `[bulkCreateMCQV2] Card ${i}: ${cardTags.length} AI tags, resolving...`
    - Log `[bulkCreateMCQV2] Resolved ${tagNameToId.size} unique tags`
    - _Requirements: 3.2_
  - [x] 5.3 Add logging for card_template_tags insertion
    - Log `[bulkCreateMCQV2] Inserting ${cardTagRows.length} card-tag links`
    - _Requirements: 3.2_

- [x] 6. Verify tag deduplication logic
  - [x] 6.1 Audit case-insensitive tag matching
    - Verify `tagNameToId.get(tagName.trim().toLowerCase())` matches how tags are stored in the map
    - Confirm tags are stored with lowercase keys: `tagNameToId.set(tagName.toLowerCase(), ...)`
    - _Requirements: 2.5_
  - [x] 6.2 Verify seenPairs deduplication prevents duplicate links
    - Confirm the `seenPairs` Set prevents duplicate card_template_tags entries
    - _Requirements: 2.4_
  - [x] 6.3 Write property test for tag deduplication
    - **Property 6: Tag deduplication across session and AI tags**
    - **Validates: Requirements 2.4**
  - [x] 6.4 Write property test for case-insensitive tag reuse
    - **Property 7: Case-insensitive tag reuse**
    - **Validates: Requirements 2.5**

- [x] 7. Checkpoint - Ensure all tests pass
  - All 594 tests pass ✓

## Integration Verification

- [ ] 8. Manual end-to-end verification
  - [ ] 8.1 Test Auto-Scan pause/resume flow
    - Start Auto-Scan on a multi-page PDF
    - Pause after 2-3 pages
    - Refresh the page
    - Verify Resume banner appears with correct page number
    - Click Resume and verify scan continues from saved page
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [ ] 8.2 Test AI tag persistence
    - Run Auto-Scan on a page that generates MCQs with AI tags
    - Check database: verify card_template_tags entries exist
    - Verify tags table has the AI-suggested tags with correct user_id
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 9. Final Checkpoint - Ensure all tests pass
  - All 594 tests pass ✓
