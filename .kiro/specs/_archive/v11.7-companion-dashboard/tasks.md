# Implementation Plan

- [x] 1. Extend global study action to accept tag filters
  - [x] 1.1 Add `tagIds` parameter to `getGlobalDueCards` function signature
    - Modify `src/actions/global-study-actions.ts`
    - Add optional `tagIds?: string[]` parameter
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 1.2 Implement tag filtering query logic
    - When `tagIds` is non-empty, join with `card_template_tags` table
    - Use `IN` clause to match any provided tag ID
    - Preserve existing constraints: `status='published'`, `suspended=false`, `next_review <= now`
    - Maintain `ORDER BY next_review ASC`
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [x] 1.3 Write property test: Tag filter returns only matching cards
    - **Property 1: Tag filter returns only cards with matching tags**
    - **Validates: Requirements 1.1, 1.2, 1.5, 7.1**
  - [x] 1.4 Write property test: Empty tagIds returns unfiltered results
    - **Property 2: Empty tagIds returns unfiltered results**
    - **Validates: Requirements 1.3, 7.2**
  - [x] 1.5 Write property test: Tag filtering preserves ordering
    - **Property 3: Tag filtering preserves next_review ordering**
    - **Validates: Requirements 1.4, 7.3**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create URL utilities for tag parameters
  - [x] 3.1 Create `parseTagIdsFromUrl` utility function
    - Add to `src/lib/url-utils.ts` (new file)
    - Parse `?tags=tag1,tag2` format
    - Filter out invalid UUIDs
    - Return empty array for missing/empty param
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 3.2 Create `buildStudyUrl` utility function
    - Build `/study/global?tags={ids}` URL
    - Handle empty tagIds (no query param)
    - _Requirements: 2.1_
  - [x] 3.3 Write property test: URL round-trip
    - **Property 4: URL construction includes tagIds correctly**
    - **Property 5: URL parsing extracts valid tag IDs**
    - **Validates: Requirements 2.1, 2.2, 2.4**

- [x] 4. Enhance StartStudyingButton with tagIds support
  - [x] 4.1 Add `tagIds` prop to StartStudyingButton
    - Modify `src/components/study/StartStudyingButton.tsx`
    - Add optional `tagIds?: string[]` prop
    - Use `buildStudyUrl` for navigation
    - _Requirements: 2.1, 3.4, 3.5_

- [x] 5. Update global study page to read tag params
  - [x] 5.1 Parse tagIds from URL search params
    - Modify `src/app/(app)/study/global/page.tsx`
    - Use `parseTagIdsFromUrl` utility
    - Pass tagIds to `getGlobalDueCards` call
    - _Requirements: 2.2, 2.3_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create StudyTagFilter component
  - [x] 7.1 Create StudyTagFilter component structure
    - Create `src/components/tags/StudyTagFilter.tsx`
    - Load user tags via `getUserTags()`
    - Filter to `category in ('topic', 'source')`
    - _Requirements: 3.1, 3.2_
  - [x] 7.2 Implement tag chip multi-select UI
    - Render tags as pill/chip buttons
    - Toggle selection on tap
    - Visual indicator for selected state
    - Use `flex-wrap` for mobile layout
    - _Requirements: 3.3, 3.7_
  - [x] 7.3 Implement localStorage persistence
    - Save selection to `localStorage` key `study-tag-filter`
    - Restore selection on component mount
    - _Requirements: 3.6_
  - [x] 7.4 Write property test: Tag filter loads only topic/source
    - **Property 6: Tag filter loads only topic/source categories**
    - **Validates: Requirements 3.2**
  - [x] 7.5 Write property test: localStorage round-trip
    - **Property 7: localStorage persistence round-trip**
    - **Validates: Requirements 3.6**

- [x] 8. Integrate StudyTagFilter into DashboardHero
  - [x] 8.1 Add StudyTagFilter to DashboardHero
    - Modify `src/components/dashboard/DashboardHero.tsx`
    - Place below greeting, above Start Studying button
    - Wire selection to StartStudyingButton tagIds prop
    - _Requirements: 3.1, 3.4_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Create getDashboardInsights action
  - [x] 10.1 Add DashboardInsights types
    - Add to `src/types/actions.ts`
    - Define `DashboardInsights` interface
    - Define `DashboardInsightsResult` type
    - _Requirements: 4.2_
  - [x] 10.2 Implement getDashboardInsights action
    - Add to `src/actions/analytics-actions.ts`
    - Use `withUser` helper
    - Call `getGlobalStats()` for dueCount
    - Fetch user progress and tags for `findWeakestConcepts`
    - Query `study_logs` for today's reviewedToday
    - Return max 3 weakest concepts
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 10.3 Write property test: Dashboard insights DTO shape
    - **Property 8: Dashboard insights returns correct DTO shape**
    - **Validates: Requirements 4.2**
  - [x] 10.4 Write property test: Low confidence threshold
    - **Property 9: Low confidence threshold hides noisy tags**
    - **Validates: Requirements 4.4, 8.2**
  - [x] 10.5 Write property test: Weakest concepts ordering
    - **Property 10: Weakest concepts ordered by accuracy ascending**
    - **Validates: Requirements 8.3**

- [x] 11. Create WeakestConceptsCard component
  - [x] 11.1 Create WeakestConceptsCard component
    - Create `src/components/dashboard/WeakestConceptsCard.tsx`
    - Accept `concepts` and `onReviewClick` props
    - Show up to 3 concepts with accuracy
    - "Review" button per concept
    - Hide when concepts is empty
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 11.2 Create formatAccuracyPercent utility
    - Add to `src/lib/analytics-utils.ts`
    - Round to nearest integer, append "%"
    - _Requirements: 5.5_
  - [x] 11.3 Write property test: Accuracy formatting
    - **Property 11: Accuracy formatting rounds to integer**
    - **Validates: Requirements 5.5**

- [x] 12. Integrate WeakestConceptsCard into Dashboard
  - [x] 12.1 Add WeakestConceptsCard to Dashboard page
    - Modify `src/app/(app)/dashboard/page.tsx`
    - Call `getDashboardInsights()` server-side
    - Pass weakestConcepts to WeakestConceptsCard
    - Wire onReviewClick to navigate with tagId
    - _Requirements: 5.1, 5.3_

- [x] 13. Dashboard layout pass for mobile-first
  - [x] 13.1 Adjust Dashboard section ordering
    - Modify `src/app/(app)/dashboard/page.tsx`
    - Order: (1) Hero with tag filter, (2) WeakestConceptsCard, (3) Deck list
    - Ensure vertical scroll with clear sections
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
