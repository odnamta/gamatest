# Implementation Plan – V4.1 Card Edit & Delete

## 1. Backend: Card Actions

- [x] 1. Add updateCard and deleteCard server actions
  - [x] 1.1 Implement `updateCard` action
    - Add to existing `src/actions/card-actions.ts`
    - Input: `{ cardId: string; type: 'flashcard' | 'mcq'; data: UpdateCardInput }`
    - Validate with Zod (reuse existing create schemas)
    - Ensure user is authenticated
    - Ensure card belongs to a deck owned by the user
    - Update record in DB (handle both flashcard and MCQ fields)
    - Return `{ ok: true }` or `{ ok: false; error: string }`
    - _Req: FR-2, FR-4_
  - [x] 1.2 Implement `deleteCard` action
    - Add to existing `src/actions/card-actions.ts`
    - Input: `cardId: string`
    - Ensure user is authenticated and owns the deck/card
    - Delete card from DB
    - Return `{ ok: true }` or `{ ok: false; error: string }`
    - _Req: FR-3, FR-4_

## 2. Frontend: Card List with Actions

- [x] 2. Update deck page with card actions
  - [x] 2.1 Create `CardListItem` component
    - Location: `src/components/cards/CardListItem.tsx`
    - Props: `card`, `deckId`, `onDeleted`
    - Render question/preview + type pill + Edit/Delete buttons
    - Edit button links to `/decks/[deckId]/cards/[cardId]/edit`
    - Delete button triggers confirmation + deleteCard action
    - _Req: FR-1_
  - [x] 2.2 Create `CardList` client component wrapper
    - Location: `src/components/cards/CardList.tsx`
    - Handles delete confirmation with `window.confirm`
    - Shows toast on success/error
    - Calls `router.refresh()` after delete
    - _Req: FR-3, FR-4_
  - [x] 2.3 Update deck page to use new components
    - Update `src/app/(app)/decks/[deckId]/page.tsx`
    - Replace inline card list with `CardList` component
    - _Req: FR-1, FR-3_

## 3. Frontend: Edit Card Flow

- [x] 3. Create edit card page and form
  - [x] 3.1 Create edit page route
    - `src/app/(app)/decks/[deckId]/cards/[cardId]/edit/page.tsx`
    - Server component: fetch card by id with ownership check
    - If not found → `notFound()`
    - _Req: FR-2_
  - [x] 3.2 Create `EditCardForm` client component
    - Location: `src/components/cards/EditCardForm.tsx`
    - Detect card type and render appropriate form
    - For flashcards: front, back, image_url fields
    - For MCQ: stem, options, correct_index, explanation fields
    - Pre-populate with current card data
    - On submit: call `updateCard` action
    - On success: redirect to `/decks/[deckId]` with toast "Card updated"
    - _Req: FR-2.1–FR-2.5_

## 4. Final Checkpoint

- [x] 4. Testing and polish
  - [x] 4.1 Manual tests
    - Edit flashcard (front/back) and confirm changes persist
    - Edit MCQ (stem, options, correct answer) and confirm changes persist
    - Delete a card and confirm it disappears from list
    - Test on mobile viewport; ensure buttons are usable (44px tap targets)
    - _Req: All_
  - [x] 4.2 Final review
    - Verify no console errors
    - Verify authorization checks work (can't edit/delete other users' cards)
    - Commit + push changes
