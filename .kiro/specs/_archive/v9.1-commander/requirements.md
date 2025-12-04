# Requirements Document

## Introduction

V9.1 "The Commander" empowers deck authors with bulk management capabilities, prepares the AI system for multi-specialty support beyond OBGYN, and protects content integrity by hiding edit controls from non-author subscribers. This release addresses the immediate need to bulk-tag 500+ Lange cards with a source tag, enables future expansion to other medical specialties, and ensures beta testers can study shared decks without accidentally modifying content.

## Glossary

- **Deck Template**: A shared deck in the V2 architecture (`deck_templates` table) that can be subscribed to by multiple users
- **Card Template**: A shared card in the V2 architecture (`card_templates` table) belonging to a deck template
- **Author**: The user who created a deck template (`author_id` field)
- **Subscriber**: A user who has subscribed to a deck template via `user_decks` but is not the author
- **Bulk Tagging**: The ability to apply a tag to multiple cards in a single operation
- **Subject**: The medical specialty or academic domain a deck covers (e.g., "Obstetrics & Gynecology", "Internal Medicine")
- **Tag Category**: The 3-tier taxonomy classification (source, topic, concept) from V9

## Requirements

### Requirement 1: Bulk Card Selection

**User Story:** As a deck author, I want to select multiple cards at once, so that I can perform bulk operations efficiently.

#### Acceptance Criteria

1. WHEN a deck author views their deck details page THEN the System SHALL display a "Select All" toggle that selects all cards in the deck (not just the current page)
2. WHEN a deck author clicks individual card checkboxes THEN the System SHALL track the selected card IDs in component state
3. WHEN cards are selected THEN the System SHALL display a selection count indicator showing "X cards selected"
4. WHEN the "Select All" toggle is activated THEN the System SHALL fetch and select all card template IDs from the database for that deck
5. WHEN the "Select All" toggle is deactivated THEN the System SHALL clear all selections

### Requirement 2: Bulk Tag Application

**User Story:** As a deck author, I want to add a tag to all selected cards at once, so that I can organize large decks quickly (e.g., apply "#Lange" source tag to 500 cards).

#### Acceptance Criteria

1. WHEN cards are selected THEN the System SHALL display an "Add Tag" button in the bulk actions toolbar
2. WHEN the author clicks "Add Tag" THEN the System SHALL open a TagSelector modal showing available tags
3. WHEN the author selects a tag and confirms THEN the System SHALL call the `bulkAddTagToCards` server action
4. WHEN `bulkAddTagToCards` receives more than 100 card IDs THEN the System SHALL batch the database inserts in chunks of 100 to prevent timeout
5. WHEN bulk tagging completes successfully THEN the System SHALL display a success toast with the count of cards tagged
6. WHEN bulk tagging fails THEN the System SHALL display an error message and not leave partial state
7. WHEN a card already has the selected tag THEN the System SHALL skip that card without error (idempotent operation)

### Requirement 3: Multi-Specialty AI Support

**User Story:** As a deck author, I want to specify the subject/specialty for my deck, so that AI-generated MCQs use appropriate domain expertise.

#### Acceptance Criteria

1. WHEN creating a new deck template THEN the System SHALL display a "Subject" field defaulting to "Obstetrics & Gynecology"
2. WHEN editing an existing deck template THEN the System SHALL display the current subject with ability to change it
3. WHEN the subject field is empty or not set THEN the System SHALL default to "Obstetrics & Gynecology" for backward compatibility
4. WHEN generating MCQs via `draftMCQFromText` THEN the System SHALL pass the deck's subject to the AI prompt
5. WHEN building the AI system prompt THEN the System SHALL replace the hardcoded specialty with the deck's subject (e.g., "You are a medical board exam expert specializing in [Subject]")

### Requirement 4: Author-Only Edit Controls

**User Story:** As a deck author, I want subscribers to be unable to modify my deck content, so that my carefully curated material remains intact.

#### Acceptance Criteria

1. WHEN a non-author user views a subscribed deck THEN the System SHALL hide the "Add Card" button
2. WHEN a non-author user views a subscribed deck THEN the System SHALL hide the "Bulk Import" button/link
3. WHEN a non-author user views a subscribed deck THEN the System SHALL hide the "Settings" or "Edit Deck" button
4. WHEN a non-author user views a subscribed deck THEN the System SHALL hide individual card edit/delete buttons
5. WHEN determining author status THEN the System SHALL compare `user.id` with `deck_template.author_id`
6. WHEN an author views their own deck THEN the System SHALL display all edit controls normally

### Requirement 5: Database Schema Extension

**User Story:** As a system, I need to store the subject field for deck templates, so that multi-specialty support persists correctly.

#### Acceptance Criteria

1. WHEN the migration runs THEN the System SHALL add a `subject` column to `deck_templates` table with type TEXT
2. WHEN the migration runs THEN the System SHALL set the default value to 'Obstetrics & Gynecology'
3. WHEN existing deck templates have NULL subject THEN the System SHALL treat them as 'Obstetrics & Gynecology'
4. WHEN the TypeScript types are updated THEN the System SHALL include `subject` as an optional string field in `DeckTemplate` interface
