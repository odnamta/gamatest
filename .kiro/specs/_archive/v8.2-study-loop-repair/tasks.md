# V8.2 Study Loop Repair - Implementation Plan

## Fix 1: The 'Groundhog Day' Bug (Critical Priority)

- [x] 1. Fix SM-2 "Again" interval
  - [x] 1.1 Update `calculateNextReview` in `src/lib/sm2.ts`
    - Change line 44: `60 * 1000` → `10 * 60 * 1000` (10 minutes)
    - _Requirements: 1.1_
  - [x] 1.2 Update property test in `src/__tests__/sm2.property.test.ts`
    - Change expected time from 1 minute to 10 minutes
    - Update test description to match new behavior
    - _Requirements: 1.1_
  - [x] 1.3 Add debug logging to `rateCardAction` in `src/actions/study-actions.ts`
    - After upsert: `console.log('[SRS] Card ${cardId} rated ${rating}: next_review = ${date}')`
    - _Requirements: 1.2_
  - [x] 1.4 Add debug logging to `answerMCQAction` in `src/actions/mcq-actions.ts`
    - Same logging pattern as 1.3
    - _Requirements: 1.2_

- [x] 2. Checkpoint - Verify Groundhog Day fix
  - Ensure all tests pass, ask the user if questions arise.

---

## Fix 2: Auto-Advance UX (High Priority)

- [x] 3. Update GlobalStudySession component
  - [x] 3.1 Add `isShowingFeedback` state to `src/components/study/GlobalStudySession.tsx`
    - New state: `const [isShowingFeedback, setIsShowingFeedback] = useState(false)`
    - _Requirements: 2.1_
  - [x] 3.2 Update `handleMCQAnswer` flow
    - Set `isShowingFeedback = true` after `isAnswered = true`
    - Change `AUTO_ADVANCE_DELAY` from 1500 to 2000
    - After timer: call `moveToNext()` and set `isShowingFeedback = false`
    - _Requirements: 2.1_
  - [x] 3.3 Pass `disabled` prop to MCQQuestion
    - Add: `disabled={isShowingFeedback}` to MCQQuestion component
    - _Requirements: 2.2_
  - [x] 3.4 Update Continue button during feedback
    - When `isShowingFeedback && autoAdvance`: show "Next card in 2s..." (disabled)
    - When `isAnswered && !autoAdvance`: show normal "Continue" button
    - _Requirements: 2.3, 2.4_

- [x] 4. Update MCQQuestion component
  - [x] 4.1 Add `disabled` prop to `src/components/study/MCQQuestion.tsx`
    - Add `disabled?: boolean` to props interface
    - Apply to option buttons: `disabled={disabled || isAnswered}`
    - _Requirements: 2.2_

- [x] 5. Checkpoint - Verify Auto-Advance UX
  - Ensure all tests pass, ask the user if questions arise.

---

## Fix 3: Smart Deck Merge (Medium Priority)

- [x] 6. Create Smart Merge Server Action
  - [x] 6.1 Add `findDuplicateDeckGroups` to `src/actions/heal-actions.ts`
    - Query: Find `deck_templates` grouped by `(title, author_id)` with count > 1
    - Return: `{ groups: Array<{ title: string, deckIds: string[], cardCounts: number[] }> }`
    - _Requirements: 3.1_
  - [x] 6.2 Add `mergeDuplicateDecks` to `src/actions/heal-actions.ts`
    - **Step 1**: For each duplicate group, pick Master (most cards) and Donor (fewer cards)
    - **Step 2**: Loop through Donor cards:
      - If `stem` matches a card in Master → Delete Donor card
      - If `stem` is unique → Update `deck_template_id` to Master
    - **Step 3**: Delete empty Donor deck_template
    - **Step 4**: Update user_decks to point to Master only
    - Wrap in transaction for safety
    - Return: `{ success: boolean, mergedCount: number, movedCards: number, deletedDuplicates: number }`
    - _Requirements: 3.2, 3.3_
  - [x] 6.3 Add stem comparison helper
    - Normalize stems: trim, lowercase, remove extra whitespace
    - Use exact match (not fuzzy) for safety
    - _Requirements: 3.2_

- [x] 7. Update RepairButton component
  - [x] 7.1 Update `src/components/dashboard/RepairButton.tsx`
    - Call `findDuplicateDeckGroups` on mount
    - If duplicates exist, show "Merge X duplicate decks" button
    - On click: call `mergeDuplicateDecks`, show detailed result toast
    - _Requirements: 3.1_

- [x] 8. Checkpoint - Verify Smart Merge
  - Ensure all tests pass, ask the user if questions arise.

---

## Fix 4: Missing V2 Cards (Medium Priority)

- [x] 9. Update global study query
  - [x] 9.1 Refactor `getGlobalDueCards` in `src/actions/global-study-actions.ts`
    - After getting due cards, also fetch new cards (no progress row)
    - Merge new cards into study queue (1 new per 3 due)
    - Cap new cards at `NEW_CARDS_FALLBACK_LIMIT` (10)
    - _Requirements: 4.1_
  - [x] 9.2 Update due count calculation
    - Include both due progress rows AND new cards count
    - _Requirements: 4.3_
  - [x] 9.3 Verify lazy seeding in `rateCardAction`
    - Confirm upsert creates row if not exists (already implemented)
    - _Requirements: 4.2_

- [x] 10. Final Checkpoint - Verify all fixes
  - Ensure all tests pass, ask the user if questions arise.
