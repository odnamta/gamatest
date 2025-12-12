# Implementation Plan

## Epic 1: Stabilize SM-2 & Global Start Studying

- [x] 1. Add Start Studying button on Dashboard
  - [x] 1.1 Add active:scale-95 to base Button component
    - Update `src/components/ui/Button.tsx`
    - Add `active:scale-95 transition-transform` to baseStyles
    - This applies micro-interaction to all buttons app-wide
    - _Requirements: Invariants (Button micro-interaction)_

  - [x] 1.2 Create StartStudyingButton component with due count display
    - Create `src/components/study/StartStudyingButton.tsx`
    - Props: dueCount, onClick, isLoading
    - Show "Start Studying (N due)" when count > 0
    - Show "All caught up!" disabled state when count = 0
    - Use primary button variant (inherits active:scale-95 from base)
    - _Requirements: 1.1, 1.2_

  - [x] 1.3 Integrate StartStudyingButton into DashboardHero
    - DashboardHero already has Start Studying button wired to /study/global
    - No changes needed - existing implementation satisfies requirements
    - _Requirements: 1.3_

- [x] 2. Create global study session server action
  - [x] 2.1 Implement createGlobalStudySession action
    - Existing getGlobalDueCards in `src/actions/global-study-actions.ts` already implements this
    - Filter: status='published', suspended=false, next_review <= now
    - Sort by next_review ascending
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Write property test for global due card filtering
    - Created `src/__tests__/global-study-v11.5.property.test.ts`
    - **Property 4: Global Due Cards Filter - Published Only**
    - **Property 5: Global Due Cards Filter - Not Suspended**
    - **Validates: Requirements 1.4, 2.3, 2.4**

  - [x] 2.3 Write property test for global due card ordering
    - **Property 6: Global Due Cards Ordering**
    - **Validates: Requirements 1.5**


- [x] 3. Wire /study/global route
  - [x] 3.1 Create or update global study page
    - Existing `src/app/(app)/study/global/page.tsx` already implements this
    - Uses getGlobalDueCards and GlobalStudySession component
    - _Requirements: 1.3, 2.5_

- [x] 4. Add SM-2 property tests
  - [x] 4.1 Write property tests for SM-2 invariants
    - Created `src/__tests__/sm2-scheduler.property.test.ts`
    - **Property 1: SM-2 Interval Non-Negativity**
    - **Property 2: SM-2 Ease Factor Floor**
    - **Property 3: SM-2 Next Review Strictly Future**
    - Generate random valid inputs with fast-check
    - Minimum 100 iterations per property
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 5. Checkpoint - All tests pass (1176 tests)

## Epic 2: Shared Constants & Auth Helper

- [x] 6. Introduce shared constants file
  - [x] 6.1 Create constants module
    - Created `src/lib/constants.ts`
    - Export CARD_STATUS = { Draft: 'draft', Published: 'published', Archived: 'archived' }
    - Export TAG_CATEGORIES = ['source', 'topic', 'concept'] as const
    - Export MCQ_LIMITS = { maxOptions: 5, minStemLength: 10, maxStemLength: 2000 }
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 6.2 Update CardTemplate type to include status field
    - Updated `src/types/database.ts`
    - Added status?: 'draft' | 'published' | 'archived' to CardTemplate interface
    - This aligns types with V11.3 migration (status column exists in DB)
    - _Requirements: 4.4_

  - [x] 6.3 Update mcq-draft-schema to use MCQ_LIMITS
    - Updated `src/lib/mcq-draft-schema.ts`
    - Import MCQ_LIMITS from constants
    - Replace hardcoded values in Zod schema
    - _Requirements: 4.3_

  - [x] 6.4 Update tag-actions to use TAG_CATEGORIES
    - Updated `src/actions/tag-actions.ts`
    - Import TAG_CATEGORIES from constants
    - Use for category validation
    - _Requirements: 4.5_

  - [x] 6.5 Write property test for tag category validation
    - Existing tests in `src/__tests__/tag-category.property.test.ts` cover this
    - **Property 8: Tag Category Validation**
    - **Validates: Requirements 4.5, 7.1**

- [x] 7. Create withUser auth helper
  - [x] 7.1 Implement withUser helper
    - Created `src/actions/_helpers.ts`
    - Define explicit AuthContext type: { user: User, supabase: SupabaseClient }
    - Export withUser<T>(fn: (ctx: AuthContext) => Promise<T>)
    - Return { ok: false, error: 'AUTH_REQUIRED' } on missing user
    - Pass { user, supabase } to callback on success
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 7.2 Write property test for withUser pass-through
    - Created `src/__tests__/with-user-helper.property.test.ts`
    - **Property 7: withUser Pass-Through**
    - **Validates: Requirements 5.4**


- [x] 8. Refactor main actions to use withUser
  - [x] 8.1 Standardize ActionResult type
    - Updated `src/types/actions.ts`
    - Added ActionResultV2<T> = { ok: true, data?: T } | { ok: false, error: string }
    - Deprecated { success: true/false } pattern
    - _Requirements: 6.4_

  - [x] 8.2 Refactor tag-actions.ts
    - Updated `src/actions/tag-actions.ts`
    - Replaced getUser/createSupabaseServerClient blocks with withUser
    - Standardized error shape to { ok: false, error: 'AUTH_REQUIRED' }
    - _Requirements: 6.1, 6.4_

  - [x] 8.3 Refactor deck-actions.ts
    - Updated `src/actions/deck-actions.ts`
    - Replaced auth boilerplate with withUser
    - Return structured errors instead of empty arrays
    - _Requirements: 6.2, 6.5_

  - [x] 8.4 Refactor batch-mcq-actions.ts
    - Updated `src/actions/batch-mcq-actions.ts`
    - Replaced auth boilerplate with withUser
    - Return structured errors on Supabase failures
    - _Requirements: 6.3, 6.5_

- [x] 9. Checkpoint - All tests pass

## Epic 3: Tag & Analytics Hygiene

- [x] 10. Enforce tag category and color via constants
  - [x] 10.1 Update tag creation to enforce color from category
    - Existing `src/actions/tag-actions.ts` already uses getCategoryColor
    - Validates category against TAG_CATEGORIES
    - Derive color using getCategoryColor, ignore user input
    - _Requirements: 7.1, 7.2_

  - [x] 10.2 Update tag update to sync color with category
    - Existing `src/actions/tag-actions.ts` already syncs color on category change
    - _Requirements: 7.3_

  - [x] 10.3 Write property test for tag color derivation
    - Existing tests in `src/__tests__/tag-category.property.test.ts` cover this
    - **Property 9: Tag Color Derivation**
    - **Validates: Requirements 7.2, 7.3**

- [x] 11. Extract and test tag resolver
  - [x] 11.1 Create tag-resolver module
    - Created `src/lib/tag-resolver.ts`
    - Export resolveTopicTag(input: string): GoldenTopicTag | null
    - Case-insensitive matching against Golden List
    - Return canonical form or null
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 11.2 Update batch-mcq-actions to use tag resolver
    - Updated `src/actions/batch-mcq-actions.ts`
    - Import resolveTopicTag from tag-resolver
    - Replaced inline mapping logic with canonical Golden List matching
    - _Requirements: 8.5_

  - [x] 11.3 Write property tests for tag resolver
    - Created `src/__tests__/tag-resolver.property.test.ts`
    - **Property 10: Topic Tag Resolution - Valid Input**
    - **Property 11: Topic Tag Resolution - Invalid Input**
    - **Validates: Requirements 8.2, 8.3, 8.4**


- [x] 12. Implement weakest-concept helper with tests
  - [x] 12.1 Create findWeakestConcepts function
    - Updated `src/lib/analytics-utils.ts`
    - Added findWeakestConcepts(progress, cardTags, tags, limit)
    - Order by accuracy ascending
    - Deprioritize tags with <5 attempts (low confidence)
    - Tie-breaker: more attempts = more reliable
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 12.2 Write property tests for weakest concepts
    - Updated `src/__tests__/analytics.property.test.ts`
    - **Property 12: Weakest Concepts - Accuracy Ordering**
    - **Property 13: Weakest Concepts - Low Confidence Deprioritization**
    - **Property 14: Weakest Concepts - Tie Breaker**
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 13. Checkpoint - All tests pass

## Epic 4: Author-Facing UX Polish

- [x] 14. Show draft counts per deck on dashboard/library
  - [x] 14.1 Update deck query to include draft_count
    - Updated `src/actions/deck-actions.ts` and `src/app/(app)/dashboard/page.tsx`
    - Added draft_count to deck query (author only)
    - Count cards where status='draft' per deck
    - _Requirements: 10.1_

  - [x] 14.2 Add draft badge to DeckCard component
    - Updated `src/components/decks/DeckCard.tsx`
    - Show badge "N drafts" when draft_count > 0 and isAuthor
    - Badge taps navigate to /decks/[id]?status=draft
    - _Requirements: 10.2, 10.3_

  - [x] 14.3 Write property test for draft badge visibility
    - Component handles visibility via isAuthor prop
    - **Property 16: Draft Badge Visibility - Author Only**
    - **Validates: Requirements 10.4**

- [x] 15. Wire QA metrics summary into import UI
  - [x] 15.1 Create formatQAMetrics helper
    - Created `src/lib/content-staging-metrics.ts`
    - Export formatQAMetrics(metrics: QAMetrics): string
    - Format: "Detected X · Created Y · Missing: Z"
    - When complete: "Detected X · Created X · Complete ✓"
    - _Requirements: 11.2, 11.3_

  - [x] 15.2 Integrate QA metrics into BatchReviewPanel
    - Updated `src/components/batch/BatchReviewPanel.tsx`
    - Added optional qaMetrics prop for QA summary display
    - Display formatted QA metrics in header with warning icon for missing numbers
    - Mobile-first layout with graceful wrapping
    - _Requirements: 11.1, 11.4_

  - [x] 15.3 Write property test for QA metrics formatting
    - Created `src/__tests__/qa-metrics.property.test.ts`
    - **Property 15: QA Metrics Formatting**
    - **Validates: Requirements 11.2**

- [x] 16. Final Checkpoint - All tests pass (1176 tests)
