# Requirements Document

## Introduction

V11.4 Draft Review & Publish accelerates the QA workflow for content authors by introducing status filters, smart select-all, bulk publishing, and a high-speed "Save & Next" side panel editor. This addresses the current limitation where authors must navigate to individual card edit pages and manually publish cards one at a time, significantly slowing down the content review process.

## Glossary

- **Status**: A card_template property indicating its lifecycle state: 'draft' (not visible in study), 'published' (visible in study), or 'archived' (hidden from all views).
- **Status Filter Chips**: UI elements above the card list that filter cards by status (Draft, Published, All).
- **Smart Select-All**: A selection mechanism that can select all cards matching the current filter, even those not rendered in the DOM.
- **Bulk Publish**: A server action that transitions multiple cards from 'draft' to 'published' status in a single operation.
- **CardEditorPanel**: A slide-over drawer component for editing cards without leaving the deck details page.
- **Filter Descriptor**: An object containing deckId, status, and optional tag filters used for bulk operations when `isAllSelected` is true.

## Requirements

### Requirement 1

**User Story:** As an author, I want to filter cards by status on the deck details page, so that I can focus on reviewing draft cards separately from published cards.

#### Acceptance Criteria

1. WHEN the deck details page loads THEN the System SHALL display status filter chips above the card list showing "Draft (X)", "Published (Y)", and "All" with accurate counts
2. WHEN the deck contains draft cards (X > 0) THEN the System SHALL default the active filter to "Draft"
3. WHEN the deck contains zero draft cards THEN the System SHALL default the active filter to "All"
4. WHEN an author clicks a status filter chip THEN the System SHALL update the card list to show only cards matching that status
5. WHEN the "Draft" filter is active THEN the System SHALL show only cards with status='draft'
6. WHEN the "Published" filter is active THEN the System SHALL show only cards with status='published'
7. WHEN the "All" filter is active THEN the System SHALL show cards with status='draft' OR status='published' (excluding archived)

### Requirement 2

**User Story:** As an author, I want to select all cards in the current filter even when not all are rendered, so that I can perform bulk operations on large card sets efficiently.

#### Acceptance Criteria

1. WHEN an author clicks "Select all" and totalCards equals visibleCards THEN the System SHALL select all visible cards
2. WHEN an author clicks "Select all" and totalCards exceeds visibleCards THEN the System SHALL display an inline prompt: "Select all {totalCards} cards in this filter?"
3. WHEN an author confirms the "Select all" prompt THEN the System SHALL set an isAllSelected flag representing all cards in the current filter
4. WHEN isAllSelected is true THEN the System SHALL pass a filter descriptor to bulk actions instead of explicit card IDs
5. WHEN the filter changes while isAllSelected is true THEN the System SHALL reset the selection state

### Requirement 3

**User Story:** As an author, I want to publish multiple draft cards at once, so that I can efficiently move reviewed content to the published state.

#### Acceptance Criteria

1. WHEN one or more cards are selected and the current filter includes draft cards THEN the System SHALL display a "Publish Selected" action in the bulk action bar
2. WHEN an author clicks "Publish Selected" THEN the System SHALL update all selected draft cards to status='published'
3. WHEN bulk publish receives an explicit list of card IDs THEN the System SHALL only update cards where current status='draft'
4. WHEN bulk publish receives a filter descriptor (isAllSelected=true) THEN the System SHALL update all draft cards matching the filter
5. WHEN bulk publish completes successfully THEN the System SHALL refresh the status chip counts and remove published cards from the "Draft" view
6. WHEN bulk publish completes successfully THEN the System SHALL display a toast: "Published X cards successfully"

### Requirement 4

**User Story:** As an author, I want a shortcut to publish all draft cards in a deck, so that I can quickly finalize content without manual selection.

#### Acceptance Criteria

1. WHEN the "Draft" filter is active and draft count > 0 THEN the System SHALL display a "Publish all draft cards" button near the status chips
2. WHEN an author clicks "Publish all draft cards" THEN the System SHALL display a confirmation dialog: "Publish all {X} draft cards in this deck?"
3. WHEN an author confirms the publish-all action THEN the System SHALL update all draft cards in the deck to status='published'
4. WHEN publish-all completes successfully THEN the System SHALL switch the active filter to "Published" or "All"

### Requirement 5

**User Story:** As an author, I want to edit cards in a side panel without leaving the deck page, so that I can review and fix cards faster.

#### Acceptance Criteria

1. WHEN an author clicks "Edit" on a card in the deck details page THEN the System SHALL open a CardEditorPanel slide-over instead of navigating to /cards/[id]/edit
2. WHEN the CardEditorPanel opens THEN the System SHALL display the existing EditCardForm content (stem, options, answer, explanation, tags) optimized for narrow width
3. WHEN the CardEditorPanel opens THEN the System SHALL maintain in state the ordered list of card IDs for the current filter and the index of the card being edited

### Requirement 6

**User Story:** As an author, I want "Save & Next" navigation in the editor panel, so that I can rapidly iterate through cards during review.

#### Acceptance Criteria

1. WHEN the CardEditorPanel is open THEN the System SHALL display "Previous" and "Next" navigation buttons near the top
2. WHEN the CardEditorPanel is open THEN the System SHALL display "Save" and "Save & Next" action buttons at the bottom
3. WHEN an author clicks "Save" THEN the System SHALL update the current card and remain on it
4. WHEN an author clicks "Save & Next" THEN the System SHALL update the current card and navigate to the next card in the filtered list
5. WHEN an author clicks "Previous" THEN the System SHALL navigate to the previous card in the filtered list without saving
6. WHEN an author clicks "Next" THEN the System SHALL navigate to the next card in the filtered list without saving
7. WHEN the current card is the last in the filtered list THEN the System SHALL disable "Save & Next" or show a "No more cards in this filter" hint

### Requirement 7

**User Story:** As an author, I want keyboard shortcuts in the editor panel, so that I can work even faster without using the mouse.

#### Acceptance Criteria

1. WHEN the CardEditorPanel is open and author presses Cmd+Enter (Ctrl+Enter on Windows) THEN the System SHALL trigger "Save & Next"
2. WHEN the CardEditorPanel is open and author presses Cmd+S (Ctrl+S on Windows) THEN the System SHALL trigger "Save"
3. WHEN the CardEditorPanel is open and author presses Escape THEN the System SHALL close the panel

### Requirement 8

**User Story:** As an author, I want the editor panel state to persist across page reloads, so that I can resume editing where I left off.

#### Acceptance Criteria

1. WHEN the CardEditorPanel is open THEN the System SHALL update the URL with a query parameter containing the card ID
2. WHEN the page loads with a card ID query parameter THEN the System SHALL re-open the CardEditorPanel on that card using the current filter context

### Requirement 9

**User Story:** As an author, I want to see status badges on each card, so that I can quickly identify draft vs published cards.

#### Acceptance Criteria

1. WHEN cards are displayed in the deck details page THEN the System SHALL show a small status badge ("Draft" or "Published") on each card
2. WHEN a card has status='draft' THEN the System SHALL display a blue "Draft" badge
3. WHEN a card has status='published' THEN the System SHALL display a green "Published" badge or no badge (published is the default state)

### Requirement 10

**User Story:** As a system maintainer, I want study flows to only include published cards, so that draft content is never shown to students.

#### Acceptance Criteria

1. WHEN fetching due cards for study THEN the System SHALL filter to status='published' only
2. WHEN calculating due card counts on the dashboard THEN the System SHALL filter to status='published' only
3. WHEN a card is in 'draft' or 'archived' status THEN the System SHALL exclude it from all study queries
