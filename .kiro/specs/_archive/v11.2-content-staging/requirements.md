# Requirements Document

## Introduction

V11.3: Content Staging introduces a safe "Draft" layer and per-session Review UI for the Specialize medical board prep application. This feature enables authors to QA and tag imported chapters before cards enter the live study deck, ensuring content quality and completeness. The staging workflow groups cards by import session, provides gap detection using question number analysis, and offers a streamlined publish flow.

## Glossary

- **Card Template**: A shared MCQ card in the `card_templates` table that can be studied by users
- **Import Session**: A logical grouping of cards created during a single bulk import operation, identified by `import_session_id`
- **Draft Status**: A card state indicating the card is not yet visible in study flows and requires QA review
- **Published Status**: A card state indicating the card is live and visible in all study flows
- **Archived Status**: A card state indicating the card is hidden from study but retained for historical purposes
- **Question Number**: The original question number from the source material, used for gap detection
- **Gap Detection**: The process of comparing detected question numbers in source text against saved cards to identify missing questions
- **Session Review UI**: An admin-only interface for reviewing, editing, and publishing cards from a specific import session

## Requirements

### Requirement 1

**User Story:** As an author, I want new bulk-imported cards to be saved as drafts, so that I can review and QA them before they appear in study sessions.

#### Acceptance Criteria

1. WHEN the system creates a new card via bulk import THEN the Card_Template SHALL have `status` set to 'draft'
2. WHEN the system creates a new card via bulk import THEN the Card_Template SHALL have `import_session_id` set to the current session's UUID
3. WHEN the database schema is migrated THEN existing Card_Templates SHALL have `status` defaulted to 'published' to maintain backward compatibility
4. WHEN a card has `status = 'draft'` THEN the study queries SHALL exclude that card from all study flows

### Requirement 2

**User Story:** As an author, I want cards from the same bulk import to be grouped together, so that I can review them as a cohesive unit.

#### Acceptance Criteria

1. WHEN the BulkImport page initiates a new import THEN the System SHALL generate a unique `import_session_id` UUID
2. WHEN `bulkCreateMCQV2` is called THEN the System SHALL accept and store the `import_session_id` on all created Card_Templates
3. WHEN cards share the same `import_session_id` THEN the Session Review UI SHALL display them as a single reviewable group
4. WHEN an import session is created THEN the System SHALL record the `book_source_id`, `chapter_id`, and `created_at` timestamp

### Requirement 3

**User Story:** As an author, I want study sessions to only show published cards, so that students never see incomplete or unreviewed content.

#### Acceptance Criteria

1. WHEN fetching due cards for global study THEN the System SHALL filter to `status = 'published'` only
2. WHEN fetching due cards for per-deck study THEN the System SHALL filter to `status = 'published'` only
3. WHEN counting due cards for dashboard display THEN the System SHALL count only `status = 'published'` cards
4. WHEN a card has `status = 'archived'` THEN the study queries SHALL exclude that card from all study flows

### Requirement 4

**User Story:** As an author, I want to view all draft cards from an import session in a dedicated review interface, so that I can efficiently QA the imported content.

#### Acceptance Criteria

1. WHEN an author navigates to the Session Review route THEN the System SHALL display all Card_Templates with the matching `import_session_id`
2. WHEN displaying the Session Review header THEN the System SHALL show the Book Title, Chapter Title, and draft card count
3. WHEN displaying the card table THEN the System SHALL show columns for question_number, stem (truncated), tags count, status, and last_updated
4. WHEN the author sorts the table THEN the System SHALL support sorting by question_number in ascending or descending order
5. WHEN a non-author user attempts to access the Session Review route THEN the System SHALL deny access

### Requirement 5

**User Story:** As an author, I want inline QA tools in the review interface, so that I can edit, delete, or duplicate cards without leaving the page.

#### Acceptance Criteria

1. WHEN the author clicks Edit on a card row THEN the System SHALL open an editor panel with the card's current data
2. WHEN the author clicks Delete on a card row THEN the System SHALL remove the card (matching existing delete behavior)
3. WHEN the author clicks Duplicate on a card row THEN the System SHALL create a copy of the card with the same `import_session_id` and `status = 'draft'`
4. WHEN the author clicks "Add Missing Card" THEN the System SHALL open a blank MCQ form pre-filled with `book_source_id`, `chapter_id`, and `import_session_id`
5. WHEN a new card is added via "Add Missing Card" THEN the Card_Template SHALL have `status = 'draft'`

### Requirement 6

**User Story:** As an author, I want to see which question numbers are missing from my import, so that I can identify and fill gaps before publishing.

#### Acceptance Criteria

1. WHEN the Session Review UI loads THEN the System SHALL compute detected question numbers from the source text using QuestionNumberDetector
2. WHEN displaying QA metrics THEN the System SHALL show: detected count, created count, and list of missing numbers
3. WHEN missing numbers exist THEN the System SHALL allow sorting or highlighting cards to make gaps visible
4. WHEN the author views the metrics THEN the System SHALL display in format: "Detected N questions · M cards created · Missing: X, Y, Z"

### Requirement 7

**User Story:** As an author, I want to publish selected draft cards to make them live, so that students can begin studying the reviewed content.

#### Acceptance Criteria

1. WHEN the author selects cards using checkboxes THEN the System SHALL track the selection state
2. WHEN the author clicks "Publish Selected" THEN the System SHALL update `status = 'published'` for all selected cards in a single transaction
3. WHEN cards are published THEN the System SHALL display a confirmation banner with the count of published cards
4. WHEN cards are published THEN the System SHALL update the header counts to reflect the new draft vs published totals
5. WHEN cards are published THEN the System SHALL NOT modify the `import_session_id` so session history remains intact

### Requirement 8

**User Story:** As an author, I want to archive bad cards without deleting them, so that I can keep them out of circulation while preserving the record.

#### Acceptance Criteria

1. WHEN the author clicks "Archive Selected" THEN the System SHALL update `status = 'archived'` for all selected cards
2. WHEN a card has `status = 'archived'` THEN the study queries SHALL exclude that card
3. WHEN a card has `status = 'archived'` THEN the Session Review UI SHALL still display it with a visual indicator

### Requirement 9

**User Story:** As an author, I want to see my current import session's status while on the BulkImport page, so that I can track progress and navigate to review.

#### Acceptance Criteria

1. WHEN the BulkImport page has an active session THEN the System SHALL display a session panel showing draft card count
2. WHEN displaying the session panel THEN the System SHALL show: "Current session: N draft cards · Detected M numbers · Missing K"
3. WHEN the author clicks "Review & Publish" THEN the System SHALL navigate to the Session Review route for the current session
