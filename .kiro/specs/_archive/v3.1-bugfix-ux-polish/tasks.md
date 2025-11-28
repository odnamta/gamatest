# Implementation Plan

## 1. Study Activity Heatmap Responsive Fix

- [x] 1.1 Create pure function for generating day array with configurable count
  - Add `generateDayArray(dayCount: number, logMap: Map<string, number>): DayData[]` to `src/lib/heatmap.ts`
  - Function returns array ordered oldest to newest
  - _Requirements: 1.4_

- [x] 1.2 Write property test for day array generation
  - **Property 2: Heatmap Day Ordering**
  - **Validates: Requirements 1.4**

- [x] 1.3 Create responsive day count hook
  - Add `useResponsiveDayCount()` hook that returns 28 for small screens, 60 for large (1024px breakpoint)
  - Use `window.matchMedia` or similar approach
  - _Requirements: 1.1, 1.2_

- [x] 1.4 Write property test for responsive day count
  - **Property 1: Heatmap Day Count by Viewport**
  - **Validates: Requirements 1.1, 1.2**

- [x] 1.5 Refactor StudyHeatmap component for responsive grid
  - Remove `overflow-x-auto` and `min-w-max` classes
  - Use responsive grid that fits container width
  - Integrate `useResponsiveDayCount` hook
  - Update title to reflect dynamic day count
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

## 2. Hide Incomplete Course Features

- [x] 2.1 Update LibrarySection to conditionally render Courses
  - Wrap entire Courses subsection in `{courses.length > 0 && (...)}`
  - Remove CreateCourseForm import and usage
  - Update header count display when courses hidden
  - _Requirements: 2.1, 2.2_

## 3. Simplified Deck Creation UI

- [x] 3.1 Simplify CreateDeckForm component
  - Remove "New Deck" label from Input
  - Change placeholder to "Enter new deck title..."
  - Change button text to "Create Deck"
  - _Requirements: 3.2, 3.3_

- [x] 3.2 Remove floating Add Deck button from LibrarySection
  - Remove the Link and Button with "+ Add Deck" in Decks section header
  - Keep only the inline form
  - _Requirements: 3.1_

## 4. Persistent PDF Upload in Bulk Import

- [x] 4.1 Create SourceBar component
  - Create `src/components/cards/SourceBar.tsx`
  - Props: `fileName`, `fileUrl?`, `onChangeClick`
  - Render: FileText icon, green filename, "Change/Replace PDF" button
  - _Requirements: 4.1_

- [x] 4.2 Update BulkImportPage with conditional source display
  - If source linked: show SourceBar
  - If no source: show upload dropzone
  - Wire up state management for source linking
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 4.3 Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## 5. Power User Text Selection Tools

- [x] 5.1 Create TextSelectionToolbar component
  - Create `src/components/cards/TextSelectionToolbar.tsx`
  - Render row of buttons: "To Stem", "To Option A/B/C", "To Explanation"
  - Accept `textAreaRef`, `onCopyToField`, `onNoSelection` props
  - _Requirements: 5.1_

- [x] 5.2 Implement text transfer logic with field targeting
  - Add `getSelectedText` function (reuse from existing TextToStemButton)
  - Add `TargetField` type and field sequence constant
  - Implement `getNextField` pure function for focus sequencing
  - _Requirements: 5.2, 5.3_

- [x] 5.3 Write property test for text selection transfer
  - **Property 3: Text Selection Transfer**
  - **Validates: Requirements 5.2**

- [x] 5.4 Write property test for focus sequencing
  - **Property 4: Focus Sequencing After Paste**
  - **Validates: Requirements 5.3**

- [x] 5.5 Integrate TextSelectionToolbar into BulkImportPage
  - Replace single TextToStemButton with new toolbar
  - Wire up callbacks to update form fields
  - Implement auto-focus after paste
  - _Requirements: 5.1, 5.2, 5.3_

## 6. Flexible MCQ Form with Dynamic Options

- [x] 6.1 Add option labeling utility functions
  - Add `getOptionLabel(index: number): string` to convert 0→'A', 1→'B', etc.
  - Add to `src/lib/mcq-options.ts` or similar
  - _Requirements: 6.2_

- [x] 6.2 Write property test for option array labeling
  - **Property 5: Option Array Labeling Invariant**
  - **Validates: Requirements 6.2, 6.3**

- [x] 6.3 Enhance CreateMCQForm with letter labels
  - Display option labels as "A.", "B.", "C." etc. instead of "Option 1"
  - Use `getOptionLabel` function for consistency
  - _Requirements: 6.2, 6.3_

- [x] 6.4 Refactor CreateMCQForm to accept initial values
  - Add props: `initialStem?`, `initialOptions?`, `initialExplanation?`
  - Add `onSuccess?` callback prop
  - Sync state with initial props when they change
  - _Requirements: 6.4_

- [x] 6.5 Replace BulkMCQForm with shared CreateMCQForm
  - Remove inline `BulkMCQForm` from add-bulk/page.tsx
  - Import and use enhanced `CreateMCQForm` component
  - Pass initial values and callbacks
  - _Requirements: 6.4_

- [x] 6.6 Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
