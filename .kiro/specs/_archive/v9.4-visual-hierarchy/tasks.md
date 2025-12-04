# Implementation Plan

- [x] 1. Create tag sorting utility
  - [x] 1.1 Create `src/lib/tag-sort.ts` with `sortTagsByCategory` function
    - Define `CATEGORY_PRIORITY` constant: source=1, topic=2, concept=3
    - Implement sort logic: category priority first, then alphabetical by name
    - Handle empty arrays and uncategorized tags (priority 99)
    - Return new array without mutating input
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_
  - [x] 1.2 Write property test for category priority ordering
    - **Property 1: Category Priority Ordering**
    - **Validates: Requirements 1.1, 2.1, 2.2**
  - [x] 1.3 Write property test for alphabetical ordering within category
    - **Property 2: Alphabetical Within Category**
    - **Validates: Requirements 1.3, 2.4**
  - [x] 1.4 Write property test for immutability
    - **Property 3: Immutability**
    - **Validates: Requirements 1.4**

- [x] 2. Integrate sorting into CardListItem
  - [x] 2.1 Update `CardListItem.tsx` to use `sortTagsByCategory`
    - Import `sortTagsByCategory` from `@/lib/tag-sort`
    - Sort tags before mapping to TagBadge components
    - _Requirements: 1.1, 1.2_

- [x] 3. Update card type badge styling for visual distinction
  - [x] 3.1 Modify card type badge in `CardListItem.tsx`
    - Add border to distinguish from pill-shaped tags
    - Use lighter background (`bg-*-50` instead of `bg-*-100`)
    - Keep `rounded` (rectangle) vs TagBadge's `rounded-full` (pill)
    - _Requirements: 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create ManageTagsButton component
  - [x] 5.1 Create `src/components/decks/ManageTagsButton.tsx`
    - Accept `isAuthor` prop
    - Return null if not author
    - Render Link to `/admin/tags` with Tags icon from Lucide
    - Style as secondary button matching existing UI patterns
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2_
  - [x] 5.2 Write property test for permission-gated visibility
    - **Property 5: Permission-Gated Visibility**
    - **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2**

- [x] 6. Add ManageTagsButton to deck details page
  - [x] 6.1 Update `src/app/(app)/decks/[deckId]/page.tsx`
    - Import ManageTagsButton component
    - Add button to author-only actions section (near Bulk Import)
    - Pass `isAuthor` prop
    - _Requirements: 4.1, 4.2_

- [x] 7. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
