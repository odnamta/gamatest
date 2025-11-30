# Implementation Plan – V6.3 The Scanner & The Crammer

**Phase Goal:** Eliminate manual highlighting via Page Scanning, enable targeted 'Cram' sessions by Tag/Deck, and harden the Vision/AI pipeline.

## Start Task

- [x] 1. Initial setup and verification
  - [x] 1.1 Read and understand the existing codebase structure
    - Review PDF viewer, batch draft flow, and study session components
    - Understand existing V6.2 Vision MVP implementation
  - [x] 1.2 Verify all V6.2 tests pass before starting
    - Run `npm run test`
    - Confirmed 421 tests pass

## Task Group 1: Page Scanner - Text Extraction

- [x] 2. Create PDF text extraction utilities
  - [x] 2.1 Create pdf-text-extraction.ts
    - Location: `src/lib/pdf-text-extraction.ts`
    - Implement `extractPageText(pdfDocument, pageNumber): Promise<string>`
    - Use PDF.js text content API via react-pdf's document proxy
    - Concatenate text items preserving line breaks based on Y position
    - _Req: Page Scanner_
  - [x] 2.2 Add noise filtering function
    - Implement `cleanPageText(rawText: string): string`
    - Remove lines < 5 chars at start/end of page
    - Remove standalone page numbers (`^\d+$`)
    - Remove chapter/section headers (`^(chapter|section|page)\s*\d+$`)
    - Remove short copyright lines
    - Collapse excessive whitespace
    - _Req: Page Scanner_
  - [x] 2.3 Add convenience function
    - Implement `extractCleanPageText(pdfDocument, pageNumber): Promise<string>`
    - Combines extraction and cleaning in one step
    - _Req: Page Scanner_

## Task Group 2: Page Scanner - UI Integration

- [x] 3. Add Scan Page button to PDF viewer
  - [x] 3.1 Update PDFViewer props
    - File: `src/components/pdf/PDFViewer.tsx`
    - Add `onScanPage?: (pdfDocument, pageNumber) => void` prop
    - Add `isScanning?: boolean` prop for loading state
    - Store PDF document reference in state
    - _Req: Page Scanner_
  - [x] 3.2 Add Scan Page button to toolbar
    - Add button with FileText icon next to page navigation
    - Purple background to match AI actions
    - Show "Scanning..." with spinner when `isScanning` is true
    - Mobile: ensure 48px min touch target
    - _Req: Page Scanner_
  - [x] 3.3 Integrate with add-bulk page
    - File: `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`
    - Add `isPageScanning` state
    - Implement `handleScanPage` callback
    - Extract text → call `draftBatchMCQFromText` → open BatchReviewPanel
    - Show loading state during extraction + AI generation
    - _Req: Page Scanner_

## Task Group 3: Custom Cram Mode - URL Params

- [x] 4. Create URL parameter utilities
  - [x] 4.1 Create custom-session-params.ts
    - Location: `src/lib/custom-session-params.ts`
    - Define `SessionMode` type: `'due' | 'cram'`
    - Define `CustomSessionConfig` interface with tagIds, deckIds, mode, limit
    - _Req: Cram Mode_
  - [x] 4.2 Implement encode/decode functions
    - `encodeSessionParams(config)` → URL search string
    - `decodeSessionParams(searchParams)` → config object
    - Handle empty arrays, default mode to 'due', clamp limit to 1-200
    - _Req: Cram Mode_
  - [x] 4.3 Add helper functions
    - `buildCustomStudyUrl(config)` → full URL path
    - `isValidConfig(config)` → boolean (at least one filter required)
    - _Req: Cram Mode_

## Task Group 4: Custom Cram Mode - Server Action

- [x] 5. Create getCustomSessionCards server action
  - [x] 5.1 Create custom-study-actions.ts
    - Location: `src/actions/custom-study-actions.ts`
    - Add 'use server' directive
    - Define `CustomSessionInput` and `CustomSessionResult` types
    - _Req: Cram Mode Backend_
  - [x] 5.2 Implement card fetching with OR semantics
    - Fetch cards matching ANY selected tag OR belonging to ANY selected deck
    - Verify deck ownership before including cards
    - _Req: Cram Mode Backend_
  - [x] 5.3 Implement mode filtering
    - If `mode === 'due'`: filter to `next_review <= now`, order by `next_review ASC`
    - If `mode === 'cram'`: no SRS filter, shuffle with Fisher-Yates
    - Apply limit after filtering
    - _Req: Cram Mode Backend_
  - [x] 5.4 Add getUserDecks helper
    - File: `src/actions/deck-actions.ts`
    - Fetch all user's decks for modal dropdown
    - _Req: Cram Mode UI_

## Task Group 5: Custom Cram Mode - UI

- [x] 6. Create ConfigureSessionModal component
  - [x] 6.1 Create modal component
    - Location: `src/components/study/ConfigureSessionModal.tsx`
    - Props: `isOpen`, `onClose`
    - Modal with backdrop, header, body, footer
    - _Req: Cram Mode UI_
  - [x] 6.2 Implement form fields
    - Tags: Multi-select using existing `TagSelector`
    - Decks: Checkbox list with user's decks
    - Mode: Radio buttons "Due Only" | "Cram All" with descriptions
    - Limit: Number input (default 50, max 200)
    - _Req: Cram Mode UI_
  - [x] 6.3 Implement navigation
    - "Start Session" button builds URL and navigates to `/study/custom?params`
    - Disable button if no tags or decks selected
    - _Req: Cram Mode UI_
  - [x] 6.4 Add Custom Session button to dashboard
    - File: `src/components/dashboard/DashboardHero.tsx`
    - Add secondary button below "Start Today's Session"
    - Label: "Custom Session" with Settings icon
    - Opens ConfigureSessionModal
    - _Req: Cram Mode UI_

## Task Group 6: Custom Cram Mode - Study Page

- [x] 7. Create custom study page
  - [x] 7.1 Create page component
    - Location: `src/app/(app)/study/custom/page.tsx`
    - Server component that parses URL params
    - Redirect to dashboard if no filters set
    - _Req: Cram Mode Backend_
  - [x] 7.2 Fetch and render cards
    - Call `getCustomSessionCards` with parsed config
    - Fetch user stats for streak display
    - Render `GlobalStudySession` with fetched cards
    - _Req: Cram Mode Backend_
  - [x] 7.3 Handle edge cases
    - Error state: show error message with back link
    - Empty state: "No cards match your filters" with suggestions
    - _Req: Cram Mode Backend_

## Task Group 7: Study Flow Polish

- [x] 8. Add auto-advance and progress bar
  - [x] 8.1 Add auto-advance toggle
    - File: `src/components/study/GlobalStudySession.tsx`
    - Add `autoAdvance` state with localStorage persistence
    - Key: `study-auto-advance`
    - Auto-advance after MCQ answer with 1.5s delay
    - _Req: Study UX_
  - [x] 8.2 Add toggle UI
    - Small toggle switch in session header
    - Label: "Auto-advance"
    - Accessible with proper ARIA attributes
    - _Req: Study UX_
  - [x] 8.3 Add visual progress bar
    - Progress bar below "Card X of Y" text
    - Blue fill with smooth transition
    - Works for both standard and custom sessions
    - _Req: Study UX_

## Task Group 8: Property Tests

- [x] 9. Create property tests
  - [x] 9.1 Create custom-session.property.test.ts
    - Location: `src/__tests__/custom-session.property.test.ts`
    - Test encode/decode roundtrip preserves config
    - Test mode defaults to 'due' for invalid values
    - Test limit clamped to 1-200 range
    - Test isValidConfig requires at least one filter
    - **Property 1-9: Custom session URL params**
    - _Req: Testing_
  - [x] 9.2 Create page-scanner.property.test.ts
    - Location: `src/__tests__/page-scanner.property.test.ts`
    - Test noise filtering removes short lines
    - Test page numbers removed
    - Test chapter headers removed
    - Test whitespace collapsed
    - Test meaningful content preserved
    - **Property 1-11: Page scanner noise filtering**
    - _Req: Testing_

## Task Group 9: Final Verification

- [x] 10. Final integration and testing
  - [x] 10.1 Run full test suite
    - `npm run test` passes with 441 tests (20 new)
    - No regressions in existing tests
    - _Req: Testing_
  - [x] 10.2 Build verification
    - `npm run build` succeeds
    - No TypeScript errors
    - New `/study/custom` route included
    - _Req: Testing_

## Task Completed

- [x] All core V6.3 features implemented:
  - Page Scanner: One-click full page text extraction with noise filtering
  - Custom Cram Mode: Tag/deck filtering with due/cram modes
  - Study Flow Polish: Auto-advance toggle and visual progress bar
  - 20 new property tests added (441 total)

---

## Remaining Tasks (Not Yet Implemented)

### Vision v2: Diagram Extraction
- [ ] Add image drop overlay to PDF viewer
- [ ] Auto-trigger vision draft on image drop
- [ ] Add pre-upload size validation (10MB limit)

### Architecture Cleanup
- [ ] Create unified AI schemas (`src/lib/schemas/ai.ts`)
- [ ] Allow minimal text with image input
- [ ] Add toast + retry for failed AI requests
- [ ] Add debounce to save actions

---

## V6.1/V6.2 Invariants Preserved

1. ✅ **Units and clinical numbers must match source text exactly**
2. ✅ **Tags remain user-scoped with case-insensitive uniqueness**
3. ✅ **AI-generated concept tags use purple color**
4. ✅ **Session tags merge with per-card AI tags**
5. ✅ **Vision: Client-side resize to ~1024px mandatory**
6. ✅ **Modes: Extract/Generate toggle semantics unchanged**
7. ✅ **Tag filtering remains client-side** (for deck card lists)

---

## File Summary

### New Files Created
- `src/lib/pdf-text-extraction.ts` - Page text extraction + noise filtering
- `src/lib/custom-session-params.ts` - URL param encoding/decoding
- `src/actions/custom-study-actions.ts` - getCustomSessionCards server action
- `src/components/study/ConfigureSessionModal.tsx` - Custom session builder UI
- `src/app/(app)/study/custom/page.tsx` - Custom study session page
- `src/__tests__/custom-session.property.test.ts` - 9 property tests
- `src/__tests__/page-scanner.property.test.ts` - 11 property tests

### Modified Files
- `src/components/pdf/PDFViewer.tsx` - Scan Page button, PDF document ref
- `src/components/dashboard/DashboardHero.tsx` - Custom Session button
- `src/app/(app)/decks/[deckId]/add-bulk/page.tsx` - Page scan integration
- `src/components/study/GlobalStudySession.tsx` - Auto-advance, progress bar
- `src/actions/deck-actions.ts` - getUserDecks helper
