# Implementation Plan

- [x] 1. Create Title Case utility function
  - [x] 1.1 Create `src/lib/string-utils.ts` with `toTitleCase` function
    - Trim leading/trailing whitespace
    - Collapse multiple spaces to single space
    - Capitalize first letter of each word, lowercase rest
    - Return empty string for whitespace-only input
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 1.2 Write property test for Title Case formatting
    - **Property 1: Title Case Formatting Correctness**
    - **Validates: Requirements 5.1, 5.2, 5.3**
  - [x] 1.3 Write property test for whitespace input handling
    - **Property 2: Whitespace Input Rejection**
    - **Validates: Requirements 1.5, 2.3, 5.4**

- [x] 2. Implement renameTag server action
  - [x] 2.1 Add `renameTag` function to `src/actions/admin-tag-actions.ts`
    - Validate new name is non-empty after trimming
    - Check for existing tag with same name (case-insensitive)
    - Return conflict response if duplicate found
    - Update tag name if no conflict
    - Revalidate `/admin/tags` path on success
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 2.2 Write property test for rename conflict detection
    - **Property 6: Rename Conflict Detection**
    - **Validates: Requirements 1.4, 2.2**

- [x] 3. Implement autoFormatTags server action
  - [x] 3.1 Add `autoFormatTags` function to `src/actions/admin-tag-actions.ts`
    - Fetch all tags for authenticated user
    - For each tag, compute Title Case version
    - Skip if already formatted or would cause collision
    - Update tags that can be safely formatted
    - Return counts and skipped list with reasons
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 3.2 Write property test for collision detection
    - **Property 3: Collision Detection Prevents Duplicates**
    - **Validates: Requirements 3.3, 4.2, 4.3**
  - [x] 3.3 Write property test for result completeness
    - **Property 4: Auto-Format Result Completeness**
    - **Validates: Requirements 4.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add inline editing to TagManager
  - [x] 5.1 Create EditableTagItem component in `src/components/tags/TagManager.tsx`
    - Add edit mode state (isEditing, editValue, error)
    - Render pencil icon button next to tag name
    - Toggle to input field when editing
    - Handle Enter (save), Escape (cancel), blur (save)
    - Show validation error for empty names
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [x] 5.2 Integrate rename with conflict handling
    - Call `renameTag` on save
    - Show merge prompt when conflict response received
    - Use existing TagMergeModal for merge flow
    - _Requirements: 1.4, 2.1, 2.2_
  - [x] 5.3 Write property test for edit mode state transitions
    - **Property 5: Edit Mode State Transitions**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 6. Add Auto-Format button to TagManager
  - [x] 6.1 Create `src/components/tags/AutoFormatButton.tsx`
    - Button with "Auto-Format Tags" label
    - Loading state during operation
    - Call `autoFormatTags` server action
    - _Requirements: 3.1_
  - [x] 6.2 Integrate AutoFormatButton into TagManager
    - Add button to toolbar area
    - Show toast with summary on completion
    - Refresh tag list after formatting
    - _Requirements: 3.2, 3.4, 3.5_

- [x] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
