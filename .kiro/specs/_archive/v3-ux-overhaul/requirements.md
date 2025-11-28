# Requirements Document

## Introduction

This specification defines the V3 UX Overhaul for Celline's OBGYN Prep application. The goal is to transform the dashboard from a "cockpit" with multiple options into a "companion" that shows Celline exactly what she needs daily: a single "Start Studying" button and streamlined bulk import tools. The primary user is Celline, a busy OBGYN resident studying from her phone, so all changes must be mobile-first (375px width priority).

## Glossary

- **Dashboard**: The main landing page after login displaying study options and progress
- **Global Study Session**: A study session that pulls due cards from ALL decks, not just one specific deck
- **Due Card**: A flashcard or MCQ whose `next_review` timestamp is less than or equal to the current time
- **Hero Section**: A prominent top section of the dashboard with greeting and primary call-to-action
- **Bulk Import**: The workflow for creating MCQs from PDF source materials
- **Library Section**: A collapsible navigation area containing Courses, Units, Lessons, and Decks
- **Daily Goal**: A user-configurable target number of cards to review per day
- **Toast**: A brief notification message that appears temporarily on screen

## Requirements

### Requirement 1: Dashboard Hero Section

**User Story:** As Celline, I want to see a simple greeting and my daily study status immediately upon login, so that I can quickly understand what I need to do today without cognitive overload.

#### Acceptance Criteria

1. WHEN Celline navigates to the dashboard THEN THE Dashboard SHALL display a hero card with the greeting text "Hi Celline 👋 Ready to study?"
2. WHEN the dashboard loads THEN THE Dashboard SHALL compute and display the total count of due cards across all decks
3. WHEN the dashboard loads THEN THE Dashboard SHALL display the count of cards completed today
4. WHEN the dashboard loads THEN THE Dashboard SHALL display daily goal progress as a circular ring, progress bar, or "X/Y" number format that fits mobile screens and shows green when completed
5. WHEN the dashboard loads THEN THE Dashboard SHALL display a streak badge showing "🔥 X-day streak" using data from user_stats
6. WHEN due cards exist across any deck THEN THE Dashboard SHALL display a prominent "Start Today's Session" button
7. WHEN zero due cards exist AND zero new cards exist THEN THE Dashboard SHALL display the empty state message "You have no due cards yet — create MCQs using Bulk Import or add a flashcard manually."
8. IF an unfinished study session exists in cached state THEN THE Dashboard SHALL display a "Resume Session" button instead of "Start Today's Session"

### Requirement 2: Global Study Session

**User Story:** As Celline, I want to study all my due cards in one session regardless of which deck they belong to, so that I can maximize my limited study time without navigating between decks.

#### Acceptance Criteria

1. WHEN the "Start Today's Session" button is clicked THEN THE System SHALL navigate to the `/study/global` route
2. WHEN the global study session starts THEN THE System SHALL fetch due cards across all user decks ordered by `next_review` ascending with a limit of 50 cards per batch
3. WHEN more than 50 due cards exist THEN THE System SHALL display a "Continue Studying" button after the session summary to fetch the next batch of 50 cards
4. WHEN zero due cards exist THEN THE System SHALL fetch up to 10 new (never reviewed) cards instead
5. WHEN displaying cards in global study THEN THE System SHALL reuse existing MCQStudySession or Flashcard components wrapped in a GlobalStudySession parent component
6. WHEN the global study session ends THEN THE System SHALL display a lightweight summary showing correct count and incorrect count
7. WHEN the user completes the global study session THEN THE System SHALL redirect to the dashboard and display a toast notification "Great work today!"

### Requirement 3: Navigation Cleanup

**User Story:** As Celline, I want the navigation to be simplified with content management options tucked away, so that I can focus on studying rather than managing content.

#### Acceptance Criteria

1. WHEN the dashboard renders THEN THE System SHALL group Courses, Units, Lessons, and Decks under a collapsible section labeled "Library & Content"
2. WHEN the Library & Content section is collapsed THEN THE System SHALL hide all course and deck listings
3. WHEN the Library & Content section is expanded THEN THE System SHALL display all course and deck listings
4. WHEN the navigation renders THEN THE System SHALL include a small "Add Deck" button within the Library & Content section
5. WHEN Celline logs in THEN THE System SHALL display the Dashboard Hero as the first visible element

### Requirement 4: Bulk Import Workflow Visualization

**User Story:** As Celline, I want to see my progress through the bulk import workflow, so that I understand where I am in the MCQ creation process.

#### Acceptance Criteria

1. WHEN the bulk import page loads THEN THE System SHALL display a breadcrumb stepper showing "1. Upload PDF → 2. Select Text → 3. Create MCQ"
2. WHEN a PDF source is linked to the deck THEN THE System SHALL display a green banner showing "📖 Linked Source: {filename}.pdf"
3. WHEN the linked PDF filename is clicked THEN THE System SHALL open the Supabase public URL for the PDF in a new browser tab
4. WHEN no PDF source is linked THEN THE System SHALL hide the linked source banner

### Requirement 5: Bulk Import Manual Assist

**User Story:** As Celline, I want helper buttons to quickly transfer selected text to the MCQ form, so that I can create questions faster without manual copy-paste.

#### Acceptance Criteria

1. WHEN the bulk import page renders THEN THE System SHALL display a button labeled "⬇️ Copy selected text to Question Stem"
2. WHEN the copy button is clicked AND text is selected in the PDF text area THEN THE System SHALL populate the Question Stem field with the selected text
3. WHEN the copy button is clicked AND no text is selected THEN THE System SHALL display a toast message "Select text in the left box first."
4. WHEN the bulk import page renders THEN THE System SHALL display a disabled button labeled "✨ AI Draft (Coming Soon)" with a tooltip showing "Coming soon"
5. WHEN the AI Draft button exists THEN THE System SHALL have a placeholder server action `draftMCQFromText()` that returns a predictable dummy MCQ object with format: `{ stem: "AI Draft Placeholder", options: ["A", "B", "C", "D"], correct_index: 0, explanation: "AI explanation placeholder." }`
6. WHEN the AI Draft button is disabled THEN THE System SHALL NOT invoke the `draftMCQFromText()` server action automatically

### Requirement 6: Global Study Summary Screen

**User Story:** As Celline, I want to see a summary of my global study session with options to continue or return home, so that I can track my progress and decide my next action.

#### Acceptance Criteria

1. WHEN the global study session completes THEN THE System SHALL display correct answer count, incorrect answer count, and streak progress
2. WHEN the summary screen renders THEN THE System SHALL display a large "Return to Dashboard" button
3. WHEN more due cards remain after the session THEN THE System SHALL display a "Continue Studying" button
4. WHEN no more due cards remain THEN THE System SHALL hide the "Continue Studying" button

### Requirement 7: Mobile-First Design

**User Story:** As Celline studying from her phone, I want all new UI elements to be optimized for mobile viewing, so that I can study comfortably on a 375px width screen.

#### Acceptance Criteria

1. WHEN the dashboard renders on mobile (375px width) THEN THE Dashboard SHALL display all UI elements fully visible without horizontal scrolling
2. WHEN the hero section renders on mobile THEN THE Dashboard SHALL display the "Start Today's Session" button spanning the full available width
3. WHEN the bulk import page renders on mobile THEN THE System SHALL remove the side-by-side layout entirely and stack elements vertically: PDF textarea at full width, copy button below it, MCQ form at the bottom
4. WHEN the global study summary renders on mobile THEN THE System SHALL display all buttons as touch-friendly with minimum 44px tap targets
