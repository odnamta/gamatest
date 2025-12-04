# Implementation Plan

## Fix 1: Unlimited Batch Extraction

- [x] 1. Remove artificial caps from batch MCQ pipeline
  - [x] 1.1 Remove `.max(5)` from Zod schema
    - File: `src/lib/batch-mcq-schema.ts`
    - Change `mcqBatchDraftSchema` to remove `.max(5)` constraint
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Remove `.slice(0, 5)` from server action
    - File: `src/actions/batch-mcq-actions.ts`
    - Change `itemsToValidate = questionsArray.slice(0, 5)` to `itemsToValidate = questionsArray`
    - _Requirements: 1.4_
  - [x] 1.3 Update AI prompts to be "greedy"
    - File: `src/actions/batch-mcq-actions.ts`
    - Update `BATCH_EXTRACT_SYSTEM_PROMPT` and `BATCH_GENERATE_SYSTEM_PROMPT`
    - Replace "up to 5 MCQs" with "ALL MCQs found"
    - Add instruction: "Extract EVERY question. If there are 20 questions, return 20 objects."
    - _Requirements: 1.1, 1.2_
  - [x] 1.4 Add max_tokens to OpenAI call
    - File: `src/actions/batch-mcq-actions.ts`
    - Add `max_tokens: 4096` to `openai.chat.completions.create()` call
    - _Requirements: 1.3_
  - [x] 1.5 Add MAX_TOKENS config constant
    - File: `src/lib/ai-config.ts`
    - Add `export const MCQ_MAX_TOKENS = parseInt(process.env.MCQ_MAX_TOKENS ?? '4096')`
    - _Requirements: 1.3_
  - [x] 1.6 Write property test for batch array processing
    - **Property 1: No Artificial Array Cap**
    - **Validates: Requirements 1.1, 1.2, 1.4**
    - File: `src/__tests__/batch-unlimited.property.test.ts`

## Fix 2: Bulletproof Resume

- [x] 2. Fix auto-scan resume logic
  - [x] 2.1 Add defensive localStorage check in startScan
    - File: `src/hooks/use-auto-scan.ts`
    - In `startScan()`, when `isResuming === true`, verify saved state exists
    - If no valid state, fall back to `startFresh()` with warning
    - _Requirements: 2.3, 2.4_
  - [x] 2.2 Sync refs before scan loop starts
    - File: `src/hooks/use-auto-scan.ts`
    - In resume path, explicitly set `isScanningRef.current = true` and `currentPageRef.current = saved.currentPage` before setTimeout
    - _Requirements: 2.1_
  - [x] 2.3 Write property test for resume page preservation
    - **Property 2: Resume Preserves Page Position**
    - **Validates: Requirements 2.1**
    - File: `src/__tests__/resume-page-position.property.test.ts`
  - [x] 2.4 Write property test for resume stats preservation
    - **Property 3: Resume Preserves Stats**
    - **Validates: Requirements 2.2**
    - File: `src/__tests__/resume-stats.property.test.ts`
  - [x] 2.5 Write property test for resume fallback
    - **Property 4: Resume Fallback on Missing State**
    - **Validates: Requirements 2.3, 2.4**
    - File: `src/__tests__/resume-fallback.property.test.ts`

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Fix 3: Deck Renaming

- [x] 4. Implement deck renaming feature
  - [x] 4.1 Create updateDeckTitle server action
    - File: `src/actions/deck-actions.ts`
    - Add `updateDeckTitle(deckId: string, newTitle: string): Promise<ActionResult>`
    - Validate title (1-100 chars)
    - Check user is author via `author_id` match
    - Update `deck_templates.title`
    - Revalidate paths
    - _Requirements: 3.2, 3.3_
  - [x] 4.2 Write property test for author-only edit
    - **Property 5: Author-Only Title Edit**
    - **Validates: Requirements 3.2, 3.3**
    - File: `src/__tests__/deck-rename-auth.property.test.ts`
  - [x] 4.3 Create EditableDeckTitle component
    - File: `src/components/decks/EditableDeckTitle.tsx`
    - Props: `deckId`, `initialTitle`
    - States: viewing, editing, saving
    - Features: pencil icon, inline input, optimistic update, error rollback
    - _Requirements: 3.1, 3.4, 3.5_
  - [x] 4.4 Integrate EditableDeckTitle into deck page
    - File: `src/app/(app)/decks/[deckId]/page.tsx`
    - Replace static `<h1>` with `<EditableDeckTitle>` for authors
    - Keep static title for non-authors
    - _Requirements: 3.1, 3.3_

## Fix 4: Complex Card Flagging

- [x] 5. Implement NeedsReview flagging
  - [x] 5.1 Update AI prompts to add NeedsReview tag
    - File: `src/actions/batch-mcq-actions.ts`
    - Add to both system prompts: "If a question has complex format (matching, linked, tables), add 'NeedsReview' to tags array"
    - _Requirements: 4.1_
  - [x] 5.2 Add NeedsReview highlight to CardList
    - File: `src/components/cards/CardList.tsx` or `CardListItem.tsx`
    - Check if card has tag with name "NeedsReview" (case-insensitive)
    - Apply yellow border class: `border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20`
    - _Requirements: 4.2_
  - [x] 5.3 Write property test for NeedsReview highlight
    - **Property 6: NeedsReview Highlight**
    - **Validates: Requirements 4.2**
    - File: `src/__tests__/needs-review-highlight.property.test.ts`
  - [x] 5.4 Add NeedsReview filter to CardList
    - File: `src/components/cards/CardList.tsx`
    - Add filter button/toggle: "Show cards needing review"
    - Filter logic: `cards.filter(c => c.tags?.some(t => t.name.toLowerCase() === 'needsreview'))`
    - _Requirements: 4.3_
  - [x] 5.5 Write property test for NeedsReview filter
    - **Property 7: NeedsReview Filter**
    - **Validates: Requirements 4.3**
    - File: `src/__tests__/needs-review-filter.property.test.ts`

- [x] 6. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
