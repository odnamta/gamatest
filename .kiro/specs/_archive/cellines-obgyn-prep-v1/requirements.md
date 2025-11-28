# Requirements Document

## Introduction

Celline's OBGYN Prep V1 extends the existing Spaced Repetition System with gamification features to boost motivation, UI/UX polish for better usability across light/dark modes, and a skeleton UI for future bulk import functionality. This phase focuses on production-ready enhancements for a mobile-first user experience.

## Glossary

- **Streak:** A consecutive count of days where the user completed at least one study session.
- **Study Log:** A daily record of cards reviewed by a user.
- **Heatmap:** A visual grid representation showing study activity intensity over time (GitHub-style).
- **Session Summary:** An end-of-session screen showing progress metrics and achievements.
- **Daily Goal:** A user-configurable target number of cards to review per day.
- **Theme:** The visual appearance mode of the application (light or dark).
- **Markdown:** A lightweight markup language for formatting text with simple syntax.
- **Bulk Import:** A feature allowing users to paste multiple cards at once for batch creation.

## Requirements

### Requirement 1: Daily Streak System

**User Story:** As a user, I want to track my daily study streak, so that I stay motivated to study consistently.

#### Acceptance Criteria

1. WHEN a user completes their first card review of the day, THE Streak System SHALL update the user's `last_study_date` to the current date.
2. WHEN a user studies on a consecutive day (yesterday's date + 1), THE Streak System SHALL increment `current_streak` by 1.
3. WHEN a user studies on the same day as `last_study_date`, THE Streak System SHALL maintain the current streak value without change.
4. WHEN a user studies after missing one or more days, THE Streak System SHALL reset `current_streak` to 1.
5. WHEN `current_streak` exceeds `longest_streak`, THE Streak System SHALL update `longest_streak` to match `current_streak`.
6. WHEN a card is rated, THE Streak System SHALL increment `total_reviews` by 1.
7. WHEN the dashboard loads, THE Dashboard System SHALL display the user's current streak with a flame icon.

### Requirement 2: Study Heatmap

**User Story:** As a user, I want to see a visual heatmap of my study activity, so that I can track my consistency over time.

#### Acceptance Criteria

1. WHEN a user rates a card, THE Study Log System SHALL upsert a record for the current date, incrementing `cards_reviewed` by 1.
2. WHEN the dashboard loads, THE Heatmap Component SHALL display the last 60 days of study activity in a grid format.
3. WHEN rendering the heatmap, THE Heatmap Component SHALL use color intensity to represent the number of cards reviewed (0 = empty, 1-5 = light, 6-15 = medium, 16+ = dark).
4. WHEN displayed on mobile, THE Heatmap Component SHALL support horizontal scrolling within a container.
5. WHEN a day has no study activity, THE Heatmap Component SHALL render an empty cell with a subtle border.

### Requirement 3: Session Summary

**User Story:** As a user, I want to see a summary at the end of my study session, so that I can track my progress and feel accomplished.

#### Acceptance Criteria

1. WHEN a study session completes (no more due cards), THE Session Summary SHALL display the total cards reviewed in the session.
2. WHEN displaying the summary, THE Session Summary SHALL show a breakdown of ratings given (Again, Hard, Good, Easy counts).
3. WHEN the user has a daily goal set, THE Session Summary SHALL display progress as "Today: X / Goal" with a progress bar.
4. WHEN the session maintains or extends the streak, THE Session Summary SHALL display "Streak Kept!" with the current streak count.
5. WHEN the session is the first of the day, THE Session Summary SHALL display "Streak Started!" for new streaks.

### Requirement 4: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light modes, so that I can study comfortably in different lighting conditions.

#### Acceptance Criteria

1. WHEN the application loads, THE Theme System SHALL respect the user's system preference by default.
2. WHEN a user clicks the theme toggle, THE Theme System SHALL switch between dark and light modes.
3. WHEN the theme changes, THE Theme System SHALL persist the preference to localStorage.
4. WHEN rendering in dark mode, THE Flashcard Component SHALL maintain readable contrast ratios (WCAG AA minimum).
5. WHEN rendering in light mode, THE Flashcard Component SHALL use appropriate colors for comfortable reading.

### Requirement 5: Rich Text (Markdown) Support

**User Story:** As a user, I want to format my flashcard content with markdown, so that I can create visually structured study materials.

#### Acceptance Criteria

1. WHEN displaying card content, THE Card Renderer SHALL parse and render markdown syntax (bold, italic, lists, code blocks).
2. WHEN rendering markdown, THE Card Renderer SHALL apply Tailwind Typography styles with `prose dark:prose-invert` classes.
3. WHEN a user creates a card, THE Card Form SHALL display helper text showing supported markdown syntax.
4. WHEN rendering user-provided markdown, THE Card Renderer SHALL sanitize input to prevent XSS attacks.
5. WHEN markdown is parsed, THE System SHALL serialize the rendered output and deserialize it back to verify round-trip consistency.

### Requirement 6: Image Optimization and Zoom

**User Story:** As a user, I want to view card images clearly and zoom in on details, so that I can study visual content effectively.

#### Acceptance Criteria

1. WHEN displaying a card image, THE Image Component SHALL use Next.js Image optimization for automatic format conversion and sizing.
2. WHEN a card image is displayed, THE Image Component SHALL fit within the container using `object-contain` styling.
3. WHEN a user clicks on a card image, THE Image Modal SHALL open displaying the image in fullscreen.
4. WHEN the image modal is open, THE Image Modal SHALL close when the user clicks the backdrop or presses Escape.
5. WHEN viewing the modal on mobile, THE Image Modal SHALL allow native browser pinch-zoom functionality.

### Requirement 7: Bulk Import Skeleton UI

**User Story:** As a user, I want to see a bulk import interface, so that I know this feature is coming and can prepare my content.

#### Acceptance Criteria

1. WHEN a user navigates to `/decks/[deckId]/add-bulk`, THE Bulk Import Page SHALL verify the user owns the deck before rendering.
2. WHEN the bulk import page loads, THE Bulk Import Page SHALL display a large textarea for pasting notes.
3. WHEN the bulk import page loads, THE Bulk Import Page SHALL display a disabled "Generate (Coming Soon)" button.
4. WHEN viewing the deck details page, THE Deck Details Page SHALL include a link to the bulk import page.
5. WHEN an unauthorized user attempts to access the bulk import page, THE System SHALL redirect to the dashboard.

### Requirement 8: User Stats Data Model

**User Story:** As a system, I want to store user statistics, so that gamification features have persistent data.

#### Acceptance Criteria

1. WHEN a new user is created, THE Database System SHALL create a corresponding `user_stats` record with default values.
2. WHEN the `user_stats` table is accessed, THE RLS Policy SHALL verify `auth.uid() = user_id`.
3. WHEN storing streak data, THE `user_stats` Table SHALL include columns for `last_study_date`, `current_streak`, `longest_streak`, `total_reviews`, and `daily_goal`.
4. WHEN the schema is created, THE Database System SHALL use appropriate data types (date for dates, integer for counts).

### Requirement 9: Study Logs Data Model

**User Story:** As a system, I want to store daily study activity, so that the heatmap can display historical data.

#### Acceptance Criteria

1. WHEN a study log is created or updated, THE Database System SHALL enforce a unique constraint on `(user_id, study_date)`.
2. WHEN the `study_logs` table is accessed, THE RLS Policy SHALL verify the user owns the record.
3. WHEN storing study logs, THE `study_logs` Table SHALL include columns for `user_id`, `study_date`, and `cards_reviewed`.
4. WHEN multiple cards are reviewed on the same day, THE Study Log System SHALL increment the existing record rather than creating duplicates.
