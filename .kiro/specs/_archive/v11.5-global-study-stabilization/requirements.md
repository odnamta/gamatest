# Requirements Document

## Introduction

V11.5 "Global Study Stabilization & Safer Actions" focuses on four key areas: (1) stabilizing the SM-2 spaced repetition algorithm and enabling global study sessions across all decks, (2) introducing shared constants and a reusable auth helper to reduce code duplication, (3) improving tag and analytics hygiene with better validation and testable helpers, and (4) polishing author-facing UX with draft counts and QA metrics visibility.

## Glossary

- **SM-2 Algorithm**: The SuperMemo 2 spaced repetition algorithm that calculates optimal review intervals based on user performance ratings (Again/Hard/Good/Easy)
- **Global Study Session**: A study session that aggregates due cards from all subscribed decks, not limited to a single deck
- **Due Card**: A card whose `next_review` timestamp is at or before the current time
- **Published Card**: A card with `status='published'` that is visible to students for study
- **Draft Card**: A card with `status='draft'` that is only visible to authors for editing
- **withUser Helper**: A type-safe wrapper function that resolves authentication and Supabase client, returning early on auth failure
- **Tag Category**: One of three taxonomy levels: 'source' (textbook origin), 'topic' (medical domain), 'concept' (specific term)
- **Golden List**: The canonical set of valid topic tags for medical classification
- **QA Metrics**: Quality assurance statistics showing detected vs created question counts during bulk import

## Requirements

### Requirement 1: Global Study Session Entry Point

**User Story:** As a student, I want to start studying all my due cards from the dashboard, so that I can review across all my subscribed decks in one session.

#### Acceptance Criteria

1. WHEN a user views the dashboard THEN the System SHALL display a "Start Studying" button showing the global due card count
2. WHEN the global due count is zero THEN the System SHALL disable the Start Studying button and display "All caught up!"
3. WHEN a user clicks the Start Studying button THEN the System SHALL create a global study session and navigate to /study/global
4. WHEN creating a global study session THEN the System SHALL include only published cards with next_review at or before the current time
5. WHEN ordering cards for global study THEN the System SHALL sort by next_review ascending (most overdue first)

### Requirement 2: Global Study Session Server Action

**User Story:** As a developer, I want a server action that creates global study sessions, so that the study flow is consistent and secure.

#### Acceptance Criteria

1. WHEN createGlobalStudySession is called without authentication THEN the System SHALL return an error with code 'AUTH_REQUIRED'
2. WHEN createGlobalStudySession is called THEN the System SHALL query user_card_progress joined with card_templates for all subscribed decks
3. WHEN filtering due cards THEN the System SHALL exclude cards where status is not 'published'
4. WHEN filtering due cards THEN the System SHALL exclude cards where suspended is true
5. WHEN the session is created successfully THEN the System SHALL return the ordered card list and a session identifier

### Requirement 3: SM-2 Algorithm Invariants

**User Story:** As a developer, I want the SM-2 algorithm to maintain mathematical invariants, so that scheduling remains predictable and bug-free.

#### Acceptance Criteria

1. WHEN calculateNextReview is called with any valid rating THEN the System SHALL return an interval that is non-negative
2. WHEN calculateNextReview is called with any valid rating THEN the System SHALL return an ease_factor of at least 1.3
3. WHEN calculateNextReview is called THEN the System SHALL return a next_review date strictly after the current time
4. WHEN a rating of 1 (Again) is given THEN the System SHALL reset the interval to 0 and schedule review within 10 minutes
5. WHEN a rating of 4 (Easy) is given with interval 0 THEN the System SHALL set interval to 4 days

### Requirement 4: Shared Constants

**User Story:** As a developer, I want centralized constants for card statuses, tag categories, and MCQ limits, so that magic strings are eliminated and validation is consistent.

#### Acceptance Criteria

1. THE System SHALL export CARD_STATUS containing Draft, Published, and Archived values from a constants file
2. THE System SHALL export TAG_CATEGORIES as an array containing 'source', 'topic', and 'concept'
3. THE System SHALL export MCQ_LIMITS containing maxOptions, minStemLength, and maxStemLength values
4. WHEN validating card status THEN the System SHALL use CARD_STATUS constants instead of string literals
5. WHEN validating tag category THEN the System SHALL use TAG_CATEGORIES array for validation

### Requirement 5: withUser Authentication Helper

**User Story:** As a developer, I want a reusable auth helper that handles user resolution and Supabase client creation, so that server actions have consistent auth patterns.

#### Acceptance Criteria

1. WHEN withUser is called THEN the System SHALL resolve the authenticated user and create a Supabase client in a single operation
2. WHEN no authenticated user exists THEN the System SHALL return { ok: false, error: 'AUTH_REQUIRED' } without executing the callback
3. WHEN authentication succeeds THEN the System SHALL pass user and supabase client to the callback function
4. WHEN the callback returns a result THEN the System SHALL pass through that result unchanged
5. THE withUser helper SHALL be type-safe, preserving the return type of the wrapped function

### Requirement 6: Server Action Refactoring

**User Story:** As a developer, I want server actions to use the withUser helper, so that auth boilerplate is eliminated and error shapes are standardized.

#### Acceptance Criteria

1. WHEN refactoring tag-actions THEN the System SHALL replace getUser/createSupabaseServerClient blocks with withUser
2. WHEN refactoring deck-actions THEN the System SHALL replace getUser/createSupabaseServerClient blocks with withUser
3. WHEN refactoring batch-mcq-actions THEN the System SHALL replace getUser/createSupabaseServerClient blocks with withUser
4. WHEN any refactored action fails authentication THEN the System SHALL return the standardized AUTH_REQUIRED error
5. WHEN Supabase queries fail THEN the System SHALL return structured errors instead of empty arrays

### Requirement 7: Tag Category Enforcement

**User Story:** As an author, I want tag categories to be strictly validated, so that the 3-tier taxonomy remains consistent.

#### Acceptance Criteria

1. WHEN creating a tag THEN the System SHALL validate category against TAG_CATEGORIES constant
2. WHEN creating a tag THEN the System SHALL derive color from category using getCategoryColor, ignoring user input
3. WHEN updating a tag category THEN the System SHALL automatically update the color to match the new category
4. IF an invalid category is provided THEN the System SHALL reject the operation with a validation error

### Requirement 8: Tag Resolver Extraction

**User Story:** As a developer, I want tag resolution logic extracted into a pure helper, so that it can be unit tested independently.

#### Acceptance Criteria

1. THE System SHALL export a resolveTopicTag function that maps input strings to canonical Golden List topics
2. WHEN resolveTopicTag receives a valid topic name THEN the System SHALL return the canonical form (e.g., 'preeclampsia' → 'Preeclampsia')
3. WHEN resolveTopicTag receives an invalid topic THEN the System SHALL return null
4. THE resolveTopicTag function SHALL be case-insensitive for matching
5. THE batch-mcq-actions SHALL use resolveTopicTag instead of inline mapping logic

### Requirement 9: Weakest Concept Analytics

**User Story:** As a student, I want to see my weakest concepts, so that I can focus study on areas needing improvement.

#### Acceptance Criteria

1. THE System SHALL export a findWeakestConcepts function that analyzes user_card_progress and card_template_tags
2. WHEN calculating weakness THEN the System SHALL prefer tags with lowest accuracy (correct_count / total_attempts)
3. WHEN a tag has fewer than 5 attempts THEN the System SHALL mark it as low-confidence and deprioritize it
4. WHEN multiple tags have equal accuracy THEN the System SHALL sort by total_attempts descending (more data = more reliable)
5. THE findWeakestConcepts function SHALL return the top N weakest concepts with their accuracy percentages

### Requirement 10: Draft Count Display

**User Story:** As an author, I want to see draft counts on my decks, so that I know which decks have unpublished content.

#### Acceptance Criteria

1. WHEN fetching deck data for an author THEN the System SHALL include draft_count in the query result
2. WHEN displaying a deck card THEN the System SHALL show a badge with draft count if greater than zero
3. WHEN a user taps the draft badge THEN the System SHALL navigate to the deck's card list with status filter set to 'draft'
4. WHEN the user is not the deck author THEN the System SHALL not display draft counts

### Requirement 11: QA Metrics in Import UI

**User Story:** As an author, I want to see QA metrics during bulk import, so that I can verify question extraction completeness.

#### Acceptance Criteria

1. WHEN autoscan completes THEN the System SHALL display detected question count, created count, and missing numbers
2. THE System SHALL format QA metrics as "Detected X · Created Y · Missing: Z" where Z is a comma-separated list
3. WHEN all detected questions are created THEN the System SHALL display "Detected X · Created X · Complete ✓"
4. WHEN missing numbers exist THEN the System SHALL highlight them in a warning color
5. THE formatQAMetrics helper SHALL be reusable across BatchReviewPanel and ImportSetupPanel

