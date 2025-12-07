# Requirements Document

## Introduction

V11.1 "Tagging Ergonomics" restores the speed of V8 tagging workflows with a Bulk Toolbar and unifies "Sources" and "Topics" in the UI without duplicating source data into tags. This version introduces a floating Bulk Action Bar, an improved TagSelector with "Create at Top" UX, virtual source badges derived from `book_sources`, and sticky import session settings.

## Glossary

- **Specialize**: The medical board exam preparation application
- **card_templates**: The canonical MCQ/flashcard content table (V2 schema)
- **book_sources**: V11 table containing textbook/question bank metadata (title, edition, specialty)
- **card_template_tags**: Join table linking card_templates to tags
- **Bulk Action Bar**: A floating toolbar that appears when cards are selected, providing batch operations
- **Virtual Source Badge**: A visual badge derived from `book_sources.title` via `card_templates.book_source_id`, NOT a real tag
- **Session Tags**: Tags applied to all cards during a bulk import session
- **Sticky Settings**: Import context (book, chapter, session tags) persisted in localStorage across page reloads

## Requirements

### Requirement 1: Bulk Action Bar

**User Story:** As an admin, I want a floating toolbar when cards are selected, so that I can quickly apply bulk operations without scrolling.

#### Acceptance Criteria

1. WHEN one or more cards are selected on the Deck Details page THEN the System SHALL display a floating Bulk Action Bar at the bottom of the viewport
2. THE Bulk Action Bar SHALL include an "Add Tag" button as a primary action
3. WHEN the "Add Tag" button is clicked THEN the System SHALL open the TagSelector modal
4. WHEN a tag is selected and confirmed THEN the System SHALL call `bulkAddTagToCards` to apply the tag to ALL selected cards in one batched operation
5. THE bulk tagging operation SHALL handle 50+ cards in a single operation without noticeable lag (< 2 seconds)

### Requirement 2: Creatable Select (Create Tag at Top)

**User Story:** As an admin, I want to create new tags directly from the search box without scrolling, so that I can tag cards faster.

#### Acceptance Criteria

1. WHEN the user types in the TagSelector search box THEN the System SHALL display a "Create '<inputValue>' tag" option PINNED at the top of the dropdown list
2. WHEN the user presses Enter while the "Create" option is highlighted THEN the System SHALL create the tag and immediately select it
3. THE existing tag list SHALL appear below the Create row, filtered by the search input
4. THE user SHALL NOT need to scroll to the bottom of the list to create a new tag
5. WHEN the input is empty or matches an existing tag exactly (case-insensitive) THEN the System SHALL NOT show the Create option

### Requirement 3: Virtual Source Badge Display

**User Story:** As an admin, I want to see which book a card came from without creating duplicate tags, so that source tracking remains clean.

#### Acceptance Criteria

1. WHEN displaying a card in CardListItem THEN the System SHALL check for `card.book_source_id`
2. WHEN `book_source_id` exists THEN the System SHALL fetch the corresponding `book_sources` row and render a blue "Source" badge with the book title
3. THE Source badge SHALL be visually distinct from topic tags (blue color, "Source:" prefix or icon)
4. THE System SHALL NOT create or attach a real tag for the source; the badge is purely visual
5. WHEN `book_source_id` is NULL THEN the System SHALL NOT display a Source badge

### Requirement 4: Unified Filter Bar with Source Filter

**User Story:** As an admin, I want to filter cards by both Source (book) and Topic (tag), so that I can find specific content quickly.

#### Acceptance Criteria

1. THE FilterBar on the deck page SHALL include a "Source" filter section
2. THE Source filter section SHALL list distinct `book_sources` referenced by cards in the current deck
3. WHEN filtering by a Source THEN the System SHALL apply a WHERE clause on `card_templates.book_source_id`
4. THE "Topics" filter section SHALL remain backed by tags (join `card_template_tags` → `tags`)
5. THE System SHALL allow combining filters: e.g., Source = "Lange" AND Topic = "Anatomy"
6. WHEN both Source and Topic filters are active THEN the System SHALL apply AND logic to show only cards matching both criteria

### Requirement 5: Sticky Import Session Context

**User Story:** As an admin, I want my import settings (Source, Chapter, Session Tags) to persist across page reloads, so that I don't have to re-select them when importing multiple pages from the same chapter.

#### Acceptance Criteria

1. WHEN the user selects a Source (book_source_id) on the BulkImportPage THEN the System SHALL persist the selection in localStorage
2. WHEN the user selects a Chapter (chapter_id) on the BulkImportPage THEN the System SHALL persist the selection in localStorage
3. WHEN the user selects Session Tags on the BulkImportPage THEN the System SHALL persist the selection in localStorage
4. WHEN the BulkImportPage loads THEN the System SHALL restore the persisted Source, Chapter, and Session Tags
5. WHEN the user navigates to a different deck THEN the System SHALL clear or update the stored context appropriately
6. THE localStorage key SHALL be scoped to the deck ID to prevent cross-deck pollution

### Requirement 6: Backwards Compatibility

**User Story:** As a developer, I want V11.1 changes to be non-breaking, so that existing workflows continue to function.

#### Acceptance Criteria

1. THE existing tag-based filtering SHALL remain functional alongside the new Source filtering
2. THE existing BulkTagModal and `bulkAddTagToCards` action SHALL continue to work without modification to their core logic
3. THE existing TagSelector SHALL continue to work in all current usage contexts
4. WHEN cards do not have `book_source_id` THEN the System SHALL display them normally without Source badges
5. THE "Show Untagged Only" filter SHALL continue to work correctly with the new Source filter

