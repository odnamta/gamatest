# Implementation Plan

## 1. Create Global Study Server Actions and Core Logic

- [ ] 1.1 Create global due count computation logic
  - Create `src/lib/global-due-count.ts` with pure function `computeGlobalDueCount(cards: { next_review: string }[], now: string): number`
  - Function counts cards where `next_review <= now`
  - _Requirements: 1.2_

- [ ]* 1.2 Write property test for global due count
  - **Property 1: Global due count accuracy**
  - **Validates: Requirements 1.2**

- [ ] 1.3 Create daily progress computation logic
  - Create `src/lib/daily-progress.ts` with pure function `computeDailyProgress(studyLog: { cards_reviewed: number } | null): number`
  - Returns `cards_reviewed` or 0 if no log exists
  - _Requirements: 1.3, 1.4_

- [ ]* 1.4 Write property test for daily progress
  - **Property 2: Daily progress calculation**
  - **Validates: Requirements 1.3, 1.4**

- [ ] 1.5 Create global study server actions
  - Create `src/actions/global-study-actions.ts`
  - Implement `getGlobalDueCards()`: fetch due cards across all decks, ordered by `next_review` ASC, limit 50
  - Implement `getGlobalStats()`: return `totalDueCount`, `completedToday`, `hasNewCards`
  - Implement fallback: if 0 due cards, fetch up to 10 new cards instead
  - _Requirements: 2.2, 2.3_

- [ ]* 1.6 Write property test for global cards ordering
  - **Property 3: Global due cards ordering and limit**
  - **Validates: Requirements 2.2**

- [ ]* 1.7 Write property test for new cards fallback
  - **Property 4: New cards fallback**
  - **Validates: Requirements 2.3**

- [ ] 1.8 Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 2. Build Dashboard Hero Component

- [ ] 2.1 Create DashboardHero component
  - Create `src/components/dashboard/DashboardHero.tsx`
  - Display greeting "Hi Celline 👋 Ready to study?"
  - Show global due count, completed today, daily goal progress bar
  - Large "Start Today's Session" button linking to `/study/global`
  - Empty state message when no due cards and no new cards
  - Mobile-first: button spans full width on mobile
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.2_

## 3. Build Library Section Component

- [ ] 3.1 Create LibrarySection component
  - Create `src/components/dashboard/LibrarySection.tsx`
  - Collapsible section with label "Library & Content"
  - Contains courses and decks listings
  - Include "Add Deck" button within section
  - Default to collapsed state
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

## 4. Update Dashboard Page

- [ ] 4.1 Integrate DashboardHero into dashboard
  - Modify `src/app/(app)/dashboard/page.tsx`
  - Add DashboardHero as first element (above everything else)
  - Fetch global stats using `getGlobalStats()`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.5_

- [ ] 4.2 Integrate LibrarySection into dashboard
  - Wrap existing courses and decks sections in LibrarySection component
  - Remove duplicate section headers (now handled by LibrarySection)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4.3 Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 5. Build Global Study Session Components

- [ ] 5.1 Create GlobalStudySummary component
  - Create `src/components/study/GlobalStudySummary.tsx`
  - Display correct count, incorrect count, streak progress
  - Large "Return to Dashboard" button
  - Conditional "Continue Studying" button when `remainingDueCount > 0`
  - Mobile-first: 44px minimum tap targets
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.4_

- [ ]* 5.2 Write property test for session summary state
  - **Property 5: Session summary state consistency**
  - **Validates: Requirements 2.5, 6.1**

- [ ]* 5.3 Write property test for continue button display
  - **Property 7: Continue button conditional display**
  - **Validates: Requirements 6.3, 6.4**

- [ ] 5.4 Create GlobalStudySession component
  - Create `src/components/study/GlobalStudySession.tsx`
  - Track session state: currentIndex, correctCount, incorrectCount, isComplete
  - Render MCQQuestion for MCQ cards, Flashcard for regular cards
  - Handle card type detection and appropriate component rendering
  - Show GlobalStudySummary when session complete
  - Trigger toast "Great work today!" on completion
  - _Requirements: 2.4, 2.5, 2.6_

## 6. Create Global Study Route

- [ ] 6.1 Create global study page
  - Create `src/app/(app)/study/global/page.tsx`
  - Server component that calls `getGlobalDueCards()`
  - Pass cards to GlobalStudySession client component
  - Handle empty state (redirect to dashboard with message)
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 6.2 Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## 7. Enhance Bulk Import Page

- [ ] 7.1 Create BulkImportStepper component
  - Create `src/components/cards/BulkImportStepper.tsx`
  - Display breadcrumb: "1. Upload PDF → 2. Select Text → 3. Create MCQ"
  - Green banner showing "📖 Linked Source: {filename}.pdf" when source linked
  - Hide banner when no source linked
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 7.2 Create TextToStemButton component
  - Create `src/components/cards/TextToStemButton.tsx`
  - Button labeled "⬇️ Copy selected text to Question Stem"
  - Read selection from textarea ref
  - Call `onTextSelected` callback with selected text
  - Show toast "Select text in the left box first." when no selection
  - _Requirements: 5.1, 5.2, 5.3_

- [ ]* 7.3 Write property test for text selection transfer
  - **Property 6: Text selection transfer**
  - **Validates: Requirements 5.2**

- [ ] 7.4 Create AI Draft placeholder
  - Add disabled button "✨ AI Draft (Coming Soon)" to bulk import page
  - Create placeholder `draftMCQFromText()` server action returning dummy MCQ
  - _Requirements: 5.4, 5.5_

- [ ] 7.5 Update bulk import page with new components
  - Modify `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`
  - Add BulkImportStepper above PDF upload section
  - Add TextToStemButton and AI Draft button between text area and form
  - Wire up text selection to populate CreateMCQForm question stem
  - Mobile-first: stack layout vertically on small screens
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 7.3_

## 8. Final Integration and Polish

- [ ] 8.1 Add toast notification system
  - Ensure toast component exists or create simple toast for "Great work today!" and error messages
  - Wire up toast triggers in GlobalStudySession and TextToStemButton
  - _Requirements: 2.6, 5.3_

- [ ] 8.2 Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.
