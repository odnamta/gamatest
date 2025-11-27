# Implementation Plan

## Feature Set 1: Gamification

- [x] 1. Create database schema for gamification
  - [x] 1.1 Add user_stats table to schema
    - Create `user_stats` table with columns: user_id (PK, FK), last_study_date, current_streak, longest_streak, total_reviews, daily_goal
    - Add RLS policies for select/insert/update
    - Add index on user_id
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.2 Add study_logs table to schema
    - Create `study_logs` table with columns: id, user_id (FK), study_date, cards_reviewed
    - Add unique constraint on (user_id, study_date)
    - Add RLS policies for select/insert/update
    - Add index on (user_id, study_date)
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 1.3 Add TypeScript types for new tables
    - Add UserStats interface to types/database.ts
    - Add StudyLog interface to types/database.ts
    - Add SessionState interface to types/session.ts
    - _Requirements: 8.3, 9.3_

- [x] 2. Implement streak calculation logic
  - [x] 2.1 Create streak calculator helper
    - Implement `lib/streak.ts` with calculateStreak function
    - Handle same-day study (no change)
    - Handle consecutive day study (+1)
    - Handle gap day study (reset to 1)
    - Use date-fns for date comparison
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 2.2 Write property test for streak calculation
    - **Property 1: Streak Calculation Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.4**
  - [x] 2.3 Write property test for longest streak invariant
    - **Property 2: Longest Streak Invariant**
    - **Validates: Requirements 1.5**
  - [x] 2.4 Write property test for total reviews increment
    - **Property 3: Total Reviews Increment**
    - **Validates: Requirements 1.6**

- [x] 3. Integrate streak system into rateCardAction
  - [x] 3.1 Update rateCardAction to update user_stats
    - Fetch or create user_stats record
    - Call calculateStreak helper
    - Update last_study_date, current_streak, longest_streak, total_reviews
    - Use database transaction for atomicity
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 3.2 Update rateCardAction to upsert study_logs
    - Upsert study_log record for current date
    - Increment cards_reviewed by 1
    - _Requirements: 2.1, 9.4_
  - [x] 3.3 Write property test for study log upsert
    - **Property 4: Study Log Upsert Correctness**
    - **Validates: Requirements 2.1, 9.1, 9.4**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement study heatmap
  - [x] 5.1 Create heatmap intensity helper
    - Implement `lib/heatmap.ts` with getHeatmapIntensity function
    - Map 0 → intensity 0, 1-5 → 1, 6-15 → 2, 16+ → 3
    - _Requirements: 2.3_
  - [x] 5.2 Write property test for heatmap intensity
    - **Property 5: Heatmap Color Intensity Mapping**
    - **Validates: Requirements 2.3**
  - [x] 5.3 Create stats Server Actions
    - Implement `actions/stats-actions.ts` with getUserStats, getStudyLogs
    - Fetch last 60 days of study logs
    - _Requirements: 2.2_
  - [x] 5.4 Create StudyHeatmap component
    - Implement `components/dashboard/StudyHeatmap.tsx` as Client Component
    - Render 60-day grid with color-coded cells
    - Support horizontal scrolling on mobile
    - Show empty cells with subtle border
    - _Requirements: 2.2, 2.3, 2.4, 2.5_
  - [x] 5.5 Integrate heatmap into dashboard
    - Add StudyHeatmap to dashboard page
    - Pass study logs as props from RSC
    - _Requirements: 2.2_

- [x] 6. Implement session summary
  - [x] 6.1 Create session state tracking
    - Add session state management to StudySession component
    - Track cards reviewed and rating breakdown in React state
    - _Requirements: 3.1, 3.2_
  - [x] 6.2 Write property test for session tracking
    - **Property 6: Session Tracking Accuracy**
    - **Validates: Requirements 3.1, 3.2**
  - [x] 6.3 Create SessionSummary component
    - Implement `components/study/SessionSummary.tsx`
    - Display total cards reviewed
    - Display rating breakdown (Again, Hard, Good, Easy counts)
    - Display progress bar if daily goal is set
    - Display "Streak Kept!" or "Streak Started!" message
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 6.4 Integrate session summary into study page
    - Show SessionSummary when no due cards remain
    - Pass session state and streak info as props
    - _Requirements: 3.1_

- [x] 7. Display streak on dashboard
  - [x] 7.1 Update dashboard to show streak
    - Fetch user_stats in dashboard RSC
    - Display current streak with flame icon (Lucide)
    - _Requirements: 1.7_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Feature Set 2: UI/UX Polish

- [x] 9. Implement dark/light mode toggle
  - [x] 9.1 Install and configure next-themes
    - Install `next-themes` package
    - Update `tailwind.config.ts` with `darkMode: ['class']`
    - _Requirements: 4.1_
  - [x] 9.2 Create ThemeProvider wrapper
    - Wrap app in ThemeProvider in root layout
    - Set attribute to 'class'
    - Enable system preference detection
    - _Requirements: 4.1_
  - [x] 9.3 Create ThemeToggle component
    - Implement `components/ui/ThemeToggle.tsx`
    - Use Sun/Moon icons from Lucide
    - Toggle between dark and light modes
    - _Requirements: 4.2, 4.3_
  - [x] 9.4 Write property test for theme persistence
    - **Property 7: Theme State Persistence**
    - **Validates: Requirements 4.2, 4.3**
  - [x] 9.5 Add ThemeToggle to navigation
    - Add toggle to app layout header
    - _Requirements: 4.2_
  - [x] 9.6 Audit flashcard contrast in both modes
    - Review and adjust Flashcard component colors
    - Ensure WCAG AA contrast ratios
    - _Requirements: 4.4, 4.5_

- [x] 10. Implement markdown support
  - [x] 10.1 Install markdown dependencies
    - Install `react-markdown` and `@tailwindcss/typography`
    - Configure typography plugin in Tailwind config
    - _Requirements: 5.1, 5.2_
  - [x] 10.2 Create MarkdownContent component
    - Implement `components/study/MarkdownContent.tsx`
    - Use react-markdown for rendering
    - Apply `prose dark:prose-invert` classes
    - Sanitize input to prevent XSS
    - _Requirements: 5.1, 5.2, 5.4_
  - [x] 10.3 Write property test for markdown rendering
    - **Property 8: Markdown Rendering Correctness**
    - **Validates: Requirements 5.1**
  - [x] 10.4 Write property test for XSS sanitization
    - **Property 9: Markdown XSS Sanitization**
    - **Validates: Requirements 5.4**
  - [x] 10.5 Write property test for markdown round-trip
    - **Property 10: Markdown Round-Trip Consistency**
    - **Validates: Requirements 5.5**
  - [x] 10.6 Update Flashcard to use MarkdownContent
    - Replace plain text rendering with MarkdownContent
    - Apply to both front and back content
    - _Requirements: 5.1_
  - [x] 10.7 Add markdown helper text to card form
    - Add helper text showing `**bold**`, `*italic*` syntax
    - _Requirements: 5.3_

- [x] 11. Implement image optimization and zoom
  - [x] 11.1 Update Flashcard image rendering
    - Use Next.js Image component for optimization
    - Apply `object-contain` styling
    - _Requirements: 6.1, 6.2_
  - [x] 11.2 Create ImageModal component
    - Implement `components/ui/ImageModal.tsx`
    - Display image in fullscreen overlay
    - Close on backdrop click or Escape key
    - Allow native pinch-zoom on mobile
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 11.3 Integrate ImageModal into Flashcard
    - Add click handler to card images
    - Open modal with clicked image
    - _Requirements: 6.3_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Feature Set 3: Bulk Import (Skeleton UI)

- [x] 13. Implement bulk import skeleton
  - [x] 13.1 Create bulk import page
    - Implement `app/(app)/decks/[deckId]/add-bulk/page.tsx`
    - Verify user owns deck before rendering
    - Redirect unauthorized users to dashboard
    - _Requirements: 7.1, 7.5_
  - [x] 13.2 Write property test for deck ownership authorization
    - **Property 11: Deck Ownership Authorization**
    - **Validates: Requirements 7.1**
  - [x] 13.3 Create bulk import UI
    - Add large textarea for pasting notes
    - Add disabled "Generate (Coming Soon)" button
    - Style consistently with existing forms
    - _Requirements: 7.2, 7.3_
  - [x] 13.4 Add link from deck details page
    - Add "Bulk Import" link/button to deck details page
    - Navigate to `/decks/[deckId]/add-bulk`
    - _Requirements: 7.4_

- [x] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
