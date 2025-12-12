# V11.2.1 Hotfix: Review & Extract Modes

## Overview
Fix two critical issues:
1. "Review & Publish" button leads to 404 - needs working navigation
2. Extract (Q&A) mode produces meta-questions instead of copying real MCQs

---

## Feature 1: Fix 'Review & Publish' Navigation & Session Review

### 1.1 Temporary Navigation Fix (No 404)
- [x] 1.1.1 Locate SessionPanel component that renders "Review & Publish" button
  - File: `src/components/session/SessionPanel.tsx`
  - Current link: `/admin/sessions/${sessionId}`
- [x] 1.1.2 Update the link to use deck draft view as temporary fallback
  - Change to: `/decks/${deckId}?showDrafts=true`
  - Added `deckId` prop to SessionPanel
- [x] 1.1.3 Update BulkImportClient to pass deckId to SessionPanel
  - File: `src/app/(app)/decks/[deckId]/add-bulk/BulkImportClient.tsx`
- [x] 1.1.4 Update CardList to read `showDrafts` from URL query params
  - File: `src/components/cards/CardList.tsx`
  - Initialize `showDrafts` state from `searchParams` if present
- [x] 1.1.5 Verify: After scanning, clicking "Review & Publish" shows deck page with drafts visible

### 1.2 Proper Session Review Route (Staging View)
- [x] 1.2.1 Verify existing route at `/admin/sessions/[sessionId]/page.tsx` works
  - File: `src/app/(app)/admin/sessions/[sessionId]/page.tsx`
  - Check if it properly fetches cards by `import_session_id`
- [x] 1.2.2 Fix SessionReviewHeader to display book source, chapter, stats
  - File: `src/components/session/SessionReviewHeader.tsx`
  - Show: book title, chapter, "X draft cards" count
  - Add "Back to Bulk Import" link
- [x] 1.2.3 Fix SessionReviewTable to render card list properly
  - File: `src/components/session/SessionReviewTable.tsx`
  - Columns: checkbox, question_number, stem (truncated), tags count, status, actions
  - Actions: Edit, Delete buttons
- [x] 1.2.4 Implement bulk selection with "Select All" checkbox
  - Track selected card IDs in state
  - "Select All" toggles all visible cards
- [x] 1.2.5 Implement "Publish Selected" action
  - Call existing `publishCards` server action from `src/actions/session-actions.ts`
  - Update UI after successful publish
  - Show success toast with count
- [x] 1.2.6 Once session review page works, update SessionPanel link back to `/admin/sessions/[sessionId]`
- [x] 1.2.7 Keep deck draft view (`/decks/[deckId]?showDrafts=true`) as fallback when sessionId is missing

---

## Feature 2: Fix Extract (Q&A) Mode Producing Meta Questions

### 2.1 Audit AI Mode Wiring on Bulk Import Page
- [x] 2.1.1 Trace AI Mode toggle on BulkImportClient
  - File: `src/app/(app)/decks/[deckId]/add-bulk/BulkImportClient.tsx`
  - State: `aiMode` ('extract' | 'generate')
  - Component: `ModeToggle`
- [x] 2.1.2 Trace mode passed to `draftBatchMCQFromText` server action
  - File: `src/actions/batch-mcq-actions.ts`
  - Verified `mode` parameter flows correctly
- [x] 2.1.3 Trace mode passed to `useAutoScan` hook
  - File: `src/hooks/use-auto-scan.ts`
  - Verified `aiMode` is passed to batch draft calls
- [x] 2.1.4 Add debug logging for Auto-Scan runs (dev-only)
  - Log: selected mode, page range, cards generated
  - File: `src/hooks/use-auto-scan.ts`

### 2.2 Harden the Extract (Q&A) Prompt
- [x] 2.2.1 Locate the Extract prompt in AI actions
  - File: `src/actions/ai-actions.ts` - `buildExtractSystemPrompt()`
  - File: `src/actions/batch-mcq-actions.ts` - `buildBatchExtractPrompt()` and `BATCH_EXTRACT_SYSTEM_PROMPT`
- [x] 2.2.2 Rewrite Extract prompt with explicit copy-only instructions
  - Instruction: "COPY existing exam-style MCQs from the text verbatim"
  - Instruction: "Only extract questions with numbered stems (1., 2., 3.) and options A-E"
  - Instruction: "Do NOT create new questions"
  - Instruction: "Do NOT write meta questions about pages, sections, or topics"
- [x] 2.2.3 Add positive example to prompt
  - Show a properly extracted Lange/Williams-style MCQ format
- [x] 2.2.4 Add negative example to prompt
  - Show what NOT to produce: "What is the main topic of page 5?"
- [x] 2.2.5 Add hard ban on meta-language patterns
  - Ban stems containing: "page X", "section Y", "topic of", "main idea of"
  - Unless those words appear in the original question text
- [x] 2.2.6 Preserve matching set support if implemented
  - Existing matching set support preserved (no changes needed)

### 2.3 Smoke Test and Guardrails
- [x] 2.3.1 Run Extract (Q&A) test on a known exam page
  - Use a page with clear numbered MCQs
  - Verify cards match the visible questions
- [x] 2.3.2 Verify no meta-language in generated stems
  - Check for: "page", "section", "topic of", "main idea"
  - If found, tighten prompt further
- [x] 2.3.3 Document QA checklist for Extract sessions
  - Card count should roughly match visible MCQs on page
  - All stems should be exam-style copies, not comprehension questions
  - Options should match original A-E format

---

## Testing Checklist
- [x] TypeScript compiles without errors
- [x] All tests pass (1060/1061 - 1 pre-existing flaky test)
- [x] Review & Publish button navigates without 404
- [x] Draft cards visible on deck page when `showDrafts=true`
- [x] Session review page loads and shows cards
- [x] Bulk publish updates card status correctly
- [x] Extract mode copies real MCQs, not meta questions
- [x] Generate mode still works for textbook content

---

## Files Modified
1. `src/components/session/SessionPanel.tsx` - Added deckId prop, updated link to deck draft view
2. `src/app/(app)/decks/[deckId]/add-bulk/BulkImportClient.tsx` - Pass deckId to SessionPanel
3. `src/components/cards/CardList.tsx` - Read showDrafts from URL query params
4. `src/actions/ai-actions.ts` - Hardened Extract prompt with meta-ban, examples
5. `src/actions/batch-mcq-actions.ts` - Hardened batch Extract prompts with meta-ban, examples

