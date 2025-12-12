# Requirements Document

## Introduction

v11.7 "Companion Dashboard & Tag-Filtered Global Study" enhances the Specialize app with two major capabilities:

1. **Tag-Filtered Global Study Sessions** - Allow users to filter their global study sessions by topic/source tags, enabling focused review of specific medical concepts.

2. **Companion-Style Dashboard Insights** - Transform the dashboard into a "study companion" that proactively surfaces weakest concepts and provides smart study suggestions.

This version prioritizes mobile-first UX (375px) and avoids schema changes by leveraging existing tables (`card_template_tags`, `tags`, `user_card_progress`).

## Glossary

- **Global Study Session**: A study session that pulls due cards from all subscribed decks, ordered by `next_review` ascending
- **Tag Filter**: A selection of one or more tags used to restrict which cards appear in a study session
- **Topic Tag**: A tag with `category='topic'` representing a medical domain (e.g., "Anatomy", "Endocrinology")
- **Source Tag**: A tag with `category='source'` representing a textbook/reference origin (e.g., "Williams", "Lange")
- **Concept Tag**: A tag with `category='concept'` representing a specific medical concept
- **Weakest Concept**: A concept tag with the lowest accuracy percentage among the user's studied cards
- **Due Card**: A card where `next_review <= NOW()` and `suspended = false` and `status = 'published'`
- **Low Confidence**: A tag with fewer than 5 total attempts (threshold defined in `LOW_CONFIDENCE_THRESHOLD`)

## Requirements

### Requirement 1: Tag-Filtered Global Study Action

**User Story:** As a medical resident, I want to filter my global study session by specific tags, so that I can focus my review on particular topics or sources.

#### Acceptance Criteria

1. WHEN the Global_Study_Action receives an optional `tagIds` parameter THEN the System SHALL restrict due-card selection to cards linked to at least one of the provided tags via the `card_template_tags` join table
2. WHEN `tagIds` is provided and non-empty THEN the System SHALL return only cards where `card_template_id` exists in `card_template_tags` with a matching `tag_id`
3. WHEN `tagIds` is empty or undefined THEN the System SHALL return all due cards matching existing constraints (status='published', suspended=false, next_review <= now)
4. WHEN filtering by tags THEN the System SHALL preserve the existing due-card ordering by `next_review` ascending
5. WHEN filtering by tags THEN the System SHALL maintain all existing constraints: `status='published'`, `suspended=false`, `next_review <= NOW()`

### Requirement 2: Tag Filter URL Parameters

**User Story:** As a user, I want my tag filter selection to be shareable via URL, so that I can bookmark specific filtered study sessions.

#### Acceptance Criteria

1. WHEN the StartStudyingButton receives a `tagIds` prop THEN the System SHALL include the tag IDs as URL search parameters when navigating to `/study/global`
2. WHEN the `/study/global` page loads with `?tags=tag1,tag2` search params THEN the System SHALL parse the comma-separated tag IDs and pass them to the global study action
3. WHEN no `tags` search param is present THEN the System SHALL invoke the global study action without tag filtering (existing behavior)
4. WHEN invalid or malformed tag IDs are provided THEN the System SHALL ignore them and proceed with valid IDs only

### Requirement 3: Dashboard Tag Filter UI

**User Story:** As a user, I want to select tags on the dashboard before starting a study session, so that I can quickly focus on specific topics without navigating elsewhere.

#### Acceptance Criteria

1. WHEN the Dashboard loads THEN the System SHALL display a StudyTagFilter component below the main greeting
2. WHEN the StudyTagFilter renders THEN the System SHALL load tags with `category` in ('topic', 'source') for the current user
3. WHEN a user taps a tag chip THEN the System SHALL toggle its selection state and update the visual indicator
4. WHEN tags are selected THEN the System SHALL pass the selected `tagIds` to the StartStudyingButton component
5. WHEN the user starts a study session with tags selected THEN the System SHALL navigate to `/study/global?tags={selectedTagIds}`
6. WHEN the user closes and reopens the app THEN the System SHALL restore the previously selected tags from localStorage
7. WHEN the tag filter row renders on a 375px viewport THEN the System SHALL wrap tags to multiple lines without horizontal scrolling

### Requirement 4: Dashboard Insights Action

**User Story:** As a user, I want the dashboard to show me personalized study insights, so that I can make informed decisions about what to study next.

#### Acceptance Criteria

1. WHEN the Dashboard loads THEN the System SHALL call a `getDashboardInsights` action using `withUser` and `ActionResultV2`
2. WHEN `getDashboardInsights` executes THEN the System SHALL return a DTO containing: `dueCount` (number), `weakestConcepts` (array of up to 3 concept tags with accuracy), and optionally `reviewedToday` (number)
3. WHEN computing weakest concepts THEN the System SHALL use the existing `findWeakestConcepts` utility function
4. WHEN the user has fewer than 5 total attempts across all concept tags THEN the System SHALL return an empty `weakestConcepts` array
5. WHEN `study_logs` contains a record for today's date THEN the System SHALL include `reviewedToday` in the response; otherwise the field SHALL be omitted

### Requirement 5: Weakest Concepts Card

**User Story:** As a user, I want to see my weakest concepts on the dashboard, so that I can quickly identify and address knowledge gaps.

#### Acceptance Criteria

1. WHEN the Dashboard renders and `weakestConcepts` is non-empty THEN the System SHALL display a WeakestConceptsCard component
2. WHEN the WeakestConceptsCard renders THEN the System SHALL show up to 3 concept tags with their accuracy percentage or a "Needs work" label
3. WHEN a user taps the "Review" button next to a concept THEN the System SHALL navigate to `/study/global?tags={conceptTagId}`
4. WHEN `weakestConcepts` is empty or the user has insufficient data THEN the System SHALL hide the WeakestConceptsCard or show an encouraging empty state
5. WHEN displaying accuracy THEN the System SHALL format it as a percentage rounded to the nearest integer (e.g., "42%")

### Requirement 6: Dashboard Layout (Mobile-First)

**User Story:** As a mobile user, I want the dashboard to be clean and focused, so that I can quickly start studying without visual clutter.

#### Acceptance Criteria

1. WHEN the Dashboard renders at 375px width THEN the System SHALL display sections in this order: (1) Greeting + Start Studying button, (2) Tag filter row, (3) WeakestConceptsCard, (4) Deck list
2. WHEN the Dashboard renders THEN the System SHALL maintain vertical scrollability with clear section separation
3. WHEN the Dashboard renders THEN the System SHALL NOT modify navigation structure or routes
4. WHEN the hero section renders THEN the System SHALL limit controls to: Start Studying button, optional tag filter, and search bar

### Requirement 7: Property Tests for Tag-Filtered Global Study

**User Story:** As a developer, I want property-based tests for tag filtering, so that I can ensure correctness across all input combinations.

#### Acceptance Criteria

1. WHEN property tests run for tag-filtered global study THEN the System SHALL verify that all returned cards have at least one of the requested `tagIds`
2. WHEN property tests run with empty/undefined `tagIds` THEN the System SHALL verify behavior matches the previous unfiltered global due logic
3. WHEN property tests run THEN the System SHALL verify that due ordering by `next_review` is preserved even when filtering by tags

### Requirement 8: Property Tests for Dashboard Insights

**User Story:** As a developer, I want property-based tests for dashboard insights, so that I can ensure the weakest concepts logic is correct.

#### Acceptance Criteria

1. WHEN property tests run for `getDashboardInsights` THEN the System SHALL verify that `findWeakestConcepts` is called with correct parameters
2. WHEN property tests run THEN the System SHALL verify that the low-attempts threshold (< 5) correctly hides noisy tags
3. WHEN property tests run THEN the System SHALL verify that `weakestConcepts` is ordered by accuracy ascending (most problematic first)
