# Requirements: V4.2 – UI/UX Upgrade Pack

## Overview

V4.2 focuses on improving the user experience across the MCQ editor, card management, and overall visual polish. This includes four feature sets: MCQ Editor UI Overhaul, Duplicate Card, Deck Bulk Actions, and Premium UI Polish.

## Goals

1. Improve MCQ editing experience with better form layout and keyboard shortcuts
2. Enable quick card duplication for similar questions
3. Add bulk operations for efficient deck management
4. Polish the UI to a premium, Notion-style aesthetic

## Non-Goals

- Modifying AI integration or SRS logic
- Adding new card types
- Changing authentication flow

---

## Feature Set A: MCQ Editor UI Overhaul

### US-A1: Consistent Option Layout
As a user, I want all MCQ option fields to have consistent spacing and visual grouping so the form looks professional and is easy to scan.

### US-A2: Dynamic Options
As a user, I want to add or remove answer options (2-5) so I can create questions with varying numbers of choices.

### US-A3: Keyboard Efficiency
As a user, I want keyboard shortcuts (Enter to add option, Cmd+Enter to save) so I can create MCQs faster without using the mouse.

### US-A4: Mobile Save Button
As a mobile user, I want a floating save button so I can easily submit the form without scrolling.

### Acceptance Criteria – Feature Set A

1. WHEN the MCQ form renders, THE system SHALL display all option fields with consistent 12px vertical spacing.
2. WHEN a user clicks "Add Option", THE system SHALL add a new empty option field (max 5 options).
3. WHEN a user clicks "Remove" on an option, THE system SHALL remove that option (min 2 options required).
4. WHEN a user presses Enter in an option field, THE system SHALL add a new option below (if under max).
5. WHEN a user presses Cmd+Enter (Mac) or Ctrl+Enter (Windows), THE system SHALL submit the form.
6. WHEN viewing on mobile (< 640px), THE system SHALL display a floating "Save" button fixed to bottom.
7. WHEN explanation text exceeds 500 characters, THE system SHALL expand the textarea gracefully without layout shift.

---

## Feature Set B: Duplicate Card

### US-B1: Quick Duplication
As a user, I want to duplicate an existing card so I can create similar questions without re-entering all the data.

### Acceptance Criteria – Feature Set B

1. WHEN viewing a card in the deck list, THE system SHALL display a "Duplicate" button alongside Edit/Delete.
2. WHEN a user clicks "Duplicate", THE system SHALL create a new card with all data copied (stem, options, correct_index, explanation, image_url).
3. WHEN duplicating, THE system SHALL append "(copy)" to the stem/front text.
4. WHEN duplicating, THE system SHALL generate a new UUID for the card.
5. WHEN duplication succeeds, THE system SHALL show toast: "Card duplicated".
6. WHEN duplication fails, THE system SHALL show toast with error message.

---

## Feature Set C: Deck Bulk Actions

### US-C1: Select Multiple Cards
As a user, I want to select multiple cards at once so I can perform bulk operations.

### US-C2: Bulk Delete
As a user, I want to delete multiple selected cards at once so I can clean up my deck efficiently.

### US-C3: Bulk Move
As a user, I want to move selected cards to another deck so I can reorganize my content.

### US-C4: Bulk Export
As a user, I want to export selected cards as JSON so I can backup or share my content.

### Acceptance Criteria – Feature Set C

1. WHEN viewing the deck card list, THE system SHALL display a checkbox on each card.
2. WHEN one or more cards are selected, THE system SHALL display a "Bulk Actions" bar at the top.
3. WHEN no cards are selected, THE system SHALL hide the bulk actions bar.
4. WHEN user clicks "Delete Selected", THE system SHALL show confirmation dialog with count.
5. WHEN user confirms bulk delete, THE system SHALL delete all selected cards and show toast: "X cards deleted".
6. WHEN user clicks "Move to Deck", THE system SHALL show deck selector dropdown.
7. WHEN user selects target deck and confirms, THE system SHALL move cards and show toast: "X cards moved".
8. WHEN user clicks "Export Selected", THE system SHALL download a JSON file named "{deck-title}-export.json".
9. THE exported JSON SHALL contain an array of card objects with all fields.

---

## Feature Set D: Premium UI Polish

### US-D1: Visual Refinement
As a user, I want a polished, premium-looking interface so the app feels professional and enjoyable to use.

### Acceptance Criteria – Feature Set D

1. WHEN rendering card list items, THE system SHALL apply subtle shadows (shadow-sm).
2. WHEN hovering over Edit/Delete buttons, THE system SHALL show hover state (background change).
3. WHEN viewing on mobile, THE system SHALL apply proper spacing (min 44px tap targets, 16px padding).
4. WHEN rendering card list, THE system SHALL add subtle dividers between items.
5. WHEN rendering containers, THE system SHALL use rounded-xl for Notion-style corners.
6. THE system SHALL use consistent color palette: blue-600/700 for primary, slate-600 for text.
7. THE heatmap legend SHALL be aligned under the grid (already implemented in previous task).

---

## Non-Functional Requirements

### NFR-1: Performance
- Bulk operations SHOULD complete within 3 seconds for up to 50 cards.
- UI SHOULD remain responsive during bulk operations (show loading state).

### NFR-2: Accessibility
- All interactive elements SHOULD have proper focus states.
- Keyboard shortcuts SHOULD be discoverable via tooltips.

### NFR-3: Mobile
- All features SHOULD work on viewports >= 320px wide.
- Touch targets SHOULD be at least 44px.
