# Requirements: V4.1 – Card Edit & Delete

## Overview

Currently, cards inside a deck can be created and studied, but not edited or deleted individually. This forces users to delete/recreate entire decks to fix mistakes. V4.1 adds per-card Edit and Delete actions on the deck detail page.

## Goals

1. Allow users to quickly fix mistakes in existing cards.
2. Allow safe deletion of incorrect/duplicate cards.
3. Avoid accidental destructive actions.
4. Keep the UI simple and mobile-friendly.

## Non-Goals

- Reordering cards within a deck.
- Bulk edit or bulk delete of multiple cards.
- Version history / undo after deletion.

## User Stories

### US-1: Fix a typo

As a user, when I notice a typo in a question or answer, I want to edit the card directly from the deck page so I don't have to recreate it from scratch.

### US-2: Remove a bad question

As a user, when I see a low-quality or duplicate card, I want to delete that specific card safely without affecting the rest of the deck.

### US-3: Mobile usage

As a user on my phone, I still want clear, tappable Edit/Delete actions without mis-tapping and accidentally deleting cards.

## Functional Requirements

### FR-1: Card Action Buttons

1. Each card in the deck list SHALL display action controls:
   - An **Edit** button.
   - A **Delete** button.
2. On desktop, buttons MAY use text labels ("Edit", "Delete").
3. On mobile, icons with tooltips or labels MAY be used to keep cards compact.

### FR-2: Edit Card Flow

1. Clicking **Edit** SHALL open an edit view for that specific card.
2. The edit form SHALL reuse the existing **Add Card** structure:
   - For flashcards: front, back, optional image URL.
   - For MCQs: stem, options, correct option, explanation.
3. The form SHALL be pre-populated with the current card data.
4. Submitting the form SHALL update the card in the database and return the user to the deck page.
5. On success, the deck page SHALL show a toast: "Card updated".

### FR-3: Delete Card Flow

1. Clicking **Delete** SHALL open a confirmation dialog (modal or browser confirm).
2. The confirmation message SHALL include:
   - The card type (MCQ / Flashcard).
   - A short preview of the stem/front (first ~80 characters).
3. If the user confirms, the card SHALL be deleted from the database.
4. On success, the card SHALL disappear from the deck list and a toast SHALL show: "Card deleted".
5. If the user cancels, no changes SHALL be made.

### FR-4: Safety & Validation

1. The Edit form SHALL validate fields using the same rules as card creation.
2. Delete actions SHALL require explicit confirmation; there SHALL be no one-tap delete without confirmation.
3. The system SHALL prevent editing/deleting cards that do not belong to the current user's deck (authorization guard).

## Non-Functional Requirements

### NFR-1: UX

- Buttons and tap targets SHOULD be at least 44px high on mobile.
- The Edit/Delete area SHOULD be visually separated enough to avoid accidental taps.

### NFR-2: Performance

- Editing or deleting a card SHOULD update the deck list without a full page reload if possible (client revalidation), but a simple reload is acceptable as a first step.

### NFR-3: Reliability

- Failed edits/deletes SHALL show an error toast and leave the UI in a consistent state.
