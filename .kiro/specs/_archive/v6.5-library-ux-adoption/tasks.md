# Implementation Plan – V6.5 Library UX & Adoption

**Phase Goal:** Build the UI for finding shared decks and subscribing to them, leveraging the V2 Shared Schema.

## Invariants (MUST preserve)

1. **VISIBILITY:** `/library` only shows deck_templates where `visibility = 'public'` OR `author_id = auth.uid()`
2. **SUBSCRIPTIONS:** Subscribing creates/reactivates a `user_decks` row; does NOT create `user_card_progress` rows upfront
3. **UNSUBSCRIBE:** Sets `user_decks.is_active = false`; does NOT delete any `user_card_progress` rows
4. **STUDY:** V2 queries only consider cards from deck_templates the user is actively subscribed to (`user_decks.is_active = true`)

---

## Phase 1 — Server Actions & Types

- [x] 1. Set up types for library feature
  - [x] 1.1 Add BrowseDeckItem and MyDeckItem types to database.ts
    - Add `BrowseDeckItem` interface with id, title, description, visibility, author_id, card_count, isSubscribed, isAuthor, created_at
    - Add `MyDeckItem` interface with id, title, description, card_count, due_count, new_count, isAuthor, created_at
    - _Req: 1.2, 3.2_

- [x] 2. Create library browse action
  - [x] 2.1 Create library-actions.ts with getBrowseDecksForUser action
    - Query deck_templates WHERE visibility = 'public' OR author_id = user_id
    - LEFT JOIN user_decks to compute isSubscribed flag
    - COUNT card_templates for card_count
    - Compute isAuthor from author_id comparison
    - _Req: 1.1, 1.3, 1.4_
  - [x] 2.2 Write property test for visibility filter correctness
    - **Property 1: Visibility Filter Correctness**
    - **Validates: Requirements 1.1**
  - [x] 2.3 Write property test for subscription status accuracy
    - **Property 2: Subscription Status Accuracy**
    - **Validates: Requirements 1.4, 2.1**

- [x] 3. Implement subscription logic
  - [x] 3.1 Add subscribeToDeck action to library-actions.ts
    - Validate deck visibility before subscription
    - Upsert into user_decks with is_active = true
    - On conflict, set is_active = true (reactivation)
    - Do NOT create user_card_progress records
    - Call revalidatePath for /library and /library/my
    - _Req: 2.1, 2.2, 2.3, 2.5_
  - [x] 3.2 Write property test for subscription reactivation round-trip
    - **Property 3: Subscription Reactivation Round-Trip**
    - **Validates: Requirements 2.2**
  - [x] 3.3 Write property test for subscription visibility validation
    - **Property 4: Subscription Visibility Validation**
    - **Validates: Requirements 2.3**
  - [x] 3.4 Write property test for lazy seeding invariant on subscribe
    - **Property 5: Lazy Seeding Invariant (Subscribe)**
    - **Validates: Requirements 2.5**

- [x] 4. Implement My Library action
  - [x] 4.1 Add getUserSubscribedDecks action to library-actions.ts
    - Query deck_templates JOIN user_decks WHERE is_active = true
    - COUNT card_templates for card_count
    - COUNT user_card_progress WHERE next_review <= now() for due_count
    - COUNT cards without progress for new_count
    - _Req: 3.1, 3.2, 3.3_
  - [x] 4.2 Write property test for My Library active-only filter
    - **Property 6: My Library Active-Only Filter**
    - **Validates: Requirements 3.1**
  - [x] 4.3 Write property test for due count accuracy
    - **Property 7: Due Count Accuracy**
    - **Validates: Requirements 3.3**

- [x] 5. Implement unsubscribe logic
  - [x] 5.1 Add unsubscribeFromDeck action to library-actions.ts
    - UPDATE user_decks SET is_active = false
    - Do NOT delete user_card_progress records
    - Call revalidatePath for /library/my
    - _Req: 4.1, 4.2_
  - [x] 5.2 Write property test for unsubscribe soft delete
    - **Property 8: Unsubscribe Soft Delete**
    - **Validates: Requirements 4.1**
  - [x] 5.3 Write property test for progress preservation on unsubscribe
    - **Property 9: Progress Preservation on Unsubscribe**
    - **Validates: Requirements 4.2**

- [x] 6. Checkpoint - Verify server actions
  - Run `npm run test` to ensure property tests pass
  - Verify all 4 actions work correctly

---

## Phase 2 — Library UI Components

- [x] 7. Create Library browse page UI
  - [x] 7.1 Create DeckBrowseCard component
    - Location: `src/components/library/DeckBrowseCard.tsx`
    - Display title, description (truncated), card count
    - Show "Created by you" badge if isAuthor
    - Button: "Add to My Studies" or "Go to My Library" based on isSubscribed
    - Handle subscribe action with optimistic UI update
    - _Req: 1.2, 1.3, 1.4, 2.4_
  - [x] 7.2 Create LibraryGrid component
    - Location: `src/components/library/LibraryGrid.tsx`
    - Grid layout for DeckBrowseCard items
    - Empty state: "No decks available yet"
    - Loading skeleton state
    - _Req: 1.5_
  - [x] 7.3 Create /library page route
    - Location: `src/app/(app)/library/page.tsx`
    - Server component fetching getBrowseDecksForUser
    - Render LibraryGrid with fetched data
    - _Req: 1.1_

- [x] 8. Create My Library page UI
  - [x] 8.1 Create MyDeckCard component
    - Location: `src/components/library/MyDeckCard.tsx`
    - Display title, card count, due count badge
    - Button: "Continue Study" linking to /study
    - Unsubscribe action with confirmation
    - _Req: 3.2, 3.3, 3.5, 4.4_
  - [x] 8.2 Create MyLibraryGrid component
    - Location: `src/components/library/MyLibraryGrid.tsx`
    - Grid layout for MyDeckCard items
    - Empty state with link to browse library
    - Loading skeleton state
    - _Req: 3.4_
  - [x] 8.3 Create /library/my page route
    - Location: `src/app/(app)/library/my/page.tsx`
    - Server component fetching getUserSubscribedDecks
    - Render MyLibraryGrid with fetched data
    - _Req: 3.1_

- [x] 9. Checkpoint - Verify UI
  - Manual test: browse library, subscribe to deck, view My Library
  - Verify responsive design on mobile

---

## Phase 3 — V2 Study Integration

- [x] 10. Update V2 study queries
  - [x] 10.1 Update getGlobalDueCardsV2 to filter by active subscriptions
    - Get active deck_template_ids from user_decks WHERE is_active = true
    - Filter card_templates by active deck_template_ids
    - Include new cards (no progress) in study results
    - _Req: 5.1, 5.2_
  - [x] 10.2 Write property test for study query active-subscription filter
    - **Property 10: Study Query Active-Subscription Filter**
    - **Validates: Requirements 5.1**
  - [x] 10.3 Write property test for new card eligibility
    - **Property 11: New Card Eligibility**
    - **Validates: Requirements 5.2**

- [x] 11. Verify lazy progress creation
  - [x] 11.1 Verify upsertCardProgress handles lazy creation correctly
    - Ensure first answer creates user_card_progress record
    - Ensure subsequent answers update existing record
    - _Req: 5.3, 5.4_
  - [x] 11.2 Write property test for lazy progress creation on first answer
    - **Property 12: Lazy Progress Creation on First Answer**
    - **Validates: Requirements 5.3**

- [x] 12. Update global stats
  - [x] 12.1 Update getGlobalStatsV2 to count only active subscriptions
    - Filter due count by active deck_template_ids
    - _Req: 5.5_
  - [x] 12.2 Write property test for global due count active-only
    - **Property 13: Global Due Count Active-Only**
    - **Validates: Requirements 5.5**

- [x] 13. Checkpoint - Verify study integration
  - Run `npm run test` - all tests pass
  - Manual test: subscribe → study → verify progress created lazily

---

## Phase 4 — Navigation & Polish

- [x] 14. Add navigation integration
  - [x] 14.1 Add Library links to app layout navigation
    - Add "Library" link to /library
    - Add "My Library" link to /library/my
    - _Req: 6.1_
  - [x] 14.2 Add navigation from subscribe success to My Library
    - Show toast with "Go to My Library" link after subscribe
    - _Req: 6.2_
  - [x] 14.3 Add navigation from My Library empty state to Library
    - Include "Browse Library" link in empty state
    - _Req: 6.3_

- [x] 15. Final verification
  - [x] 15.1 Run full test suite
    - `npm run test` passes
    - All 13 property tests pass
    - _Req: Testing_
  - [x] 15.2 Build verification
    - `npm run build` succeeds
    - No TypeScript errors
    - _Req: Testing_

---

## V6.5 Invariants Checklist

- [x] ✅ **VISIBILITY:** Browse shows only public + authored decks
- [x] ✅ **SUBSCRIPTIONS:** Subscribe creates user_decks only, no progress rows
- [x] ✅ **UNSUBSCRIBE:** Soft delete preserves all progress data
- [x] ✅ **STUDY:** Only active subscriptions included in study queries

---

## New Files Summary

| File | Purpose |
|------|---------|
| `src/actions/library-actions.ts` | Browse, subscribe, unsubscribe actions |
| `src/components/library/DeckBrowseCard.tsx` | Card component for browse view |
| `src/components/library/LibraryGrid.tsx` | Grid layout for browse page |
| `src/components/library/MyDeckCard.tsx` | Card component for My Library |
| `src/components/library/MyLibraryGrid.tsx` | Grid layout for My Library |
| `src/app/(app)/library/page.tsx` | Browse page route |
| `src/app/(app)/library/my/page.tsx` | My Library page route |
| `src/__tests__/library-subscription.property.test.ts` | Property tests |

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `src/types/database.ts` | Add BrowseDeckItem, MyDeckItem types |
| `src/actions/global-study-actions.ts` | Update V2 queries for active subscriptions |
| `src/app/(app)/layout.tsx` | Add Library navigation links |
