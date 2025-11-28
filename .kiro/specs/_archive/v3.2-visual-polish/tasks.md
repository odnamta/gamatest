# Implementation Plan

## 1. GitHub-Style Heatmap Layout

- [x] 1.1 Update useResponsiveDayCount hook for 28/84 days
  - Change SMALL_SCREEN_DAYS from 28 to 28 (keep same)
  - Change LARGE_SCREEN_DAYS from 60 to 84 (12 weeks)
  - _Requirements: 1.2, 1.3_

- [x] 1.2 Write property test for updated day counts
  - **Property 1: Heatmap Day Count by Viewport**
  - Test 28 days for mobile, 84 days for desktop
  - **Validates: Requirements 1.2, 1.3**

- [x] 1.3 Refactor StudyHeatmap for GitHub-style layout
  - Use right-aligned (justify-end) flex/grid container
  - Always use 7 columns (one week per row)
  - 4 rows on mobile (28 days), 12 rows on desktop (84 days)
  - Today is always bottom-right-most square
  - Add visible gaps between squares
  - _Requirements: 1.1, 1.4, 1.5_

- [x] 1.4 Write property test for today at end
  - **Property 2: Heatmap Day Ordering (Today at End)**
  - Verify last element is always today
  - **Validates: Requirements 1.4**

## 2. Dashboard Cleanup

- [x] 2.1 Hide Courses section completely in LibrarySection
  - Comment out ALL courses rendering logic
  - Remove/hide Create Course button
  - Only show Decks section
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.2 Verify floating Add Deck button is removed
  - Confirm no floating button overlaps content
  - Only inline Create Deck form exists
  - _Requirements: 3.1, 3.2_

## 3. Checkpoint
  - [x] 3.1 Ensure all tests pass
    - Run test suite, ask user if questions arise

## 4. Bulk Import SourceBar Enhancement

- [x] 4.1 Refactor SourceBar for two-state display
  - State A (No File): Show "Upload PDF" button
  - State B (File Linked): Show filename (green) + "Replace" button
  - _Requirements: 4.1, 4.2_

- [x] 4.2 Implement Replace button functionality
  - Clicking Replace resets upload state
  - Shows upload interface again
  - _Requirements: 4.3_

- [x] 4.3 Update BulkImportPage layout
  - Top: Permanent SourceBar component
  - Bottom: Text Area and MCQ Form
  - Ensure upload never hides replace option
  - _Requirements: 4.4_

## 5. Power User Copy Toolbar

- [x] 5.1 Add Option D button to TextSelectionToolbar
  - Update TargetField type to include 'optionD'
  - Add "To Option D" button
  - Update FIELD_SEQUENCE to include optionD
  - _Requirements: 5.1_

- [x] 5.2 Update property test for extended field sequence
  - **Property 4: Focus Sequencing After Paste**
  - Include optionD in sequence
  - **Validates: Requirements 5.3**

- [x] 5.3 Wire up Option D in BulkImportPage
  - Add optionD to handleCopyToField callback
  - Add ref for option D input
  - _Requirements: 5.2_

## 6. Extended MCQ Options (A-E)

- [x] 6.1 Update CreateMCQForm max options to 5
  - Change MAX_OPTIONS from 10 to 5
  - Update help text to show "A-E"
  - _Requirements: 6.1_

- [x] 6.2 Update BulkMCQForm max options to 5
  - Change max from 10 to 5 in add-bulk/page.tsx
  - Update help text
  - _Requirements: 6.1_

- [x] 6.3 Update property test for 5-option limit
  - **Property 5: Option Array Labeling Invariant**
  - Test with max 5 options
  - **Validates: Requirements 6.2, 6.3**

## 7. Final Checkpoint
  - [x] 7.1 Ensure all tests pass
    - Run full test suite
    - Verify 28/84 day heatmap works
    - Verify courses hidden
    - Verify SourceBar replace works
    - Verify Option D copy works
    - Verify max 5 options
