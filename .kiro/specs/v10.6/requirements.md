# Requirements Document

## Introduction

V10.6 "The Digital Notebook & Search" adds personal study tools to Specialize, transforming it from a flashcard app into a personalized medical companion. This version introduces card flagging, personal notes, and global search functionality to help users organize and find content efficiently.

## Glossary

- **Specialize**: The medical board exam preparation application
- **Card Template**: Shared flashcard content (question/answer or MCQ)
- **User Card Progress**: Per-user progress and personalization data for a card
- **Flag**: A user bookmark on a card for later review
- **Notes**: Personal annotations a user adds to a card
- **Debounce**: Delaying an action until input stops for a specified duration
- **Subscribed Decks**: Deck templates the user has added via user_decks

## Requirements

### Requirement 1: Card Flagging

**User Story:** As a medical student, I want to flag cards for later review, so that I can quickly revisit difficult or important concepts.

#### Acceptance Criteria

1. WHEN a user clicks the flag icon on a card THEN the System SHALL toggle the `is_flagged` status and persist it to the database
2. WHEN a card is flagged THEN the System SHALL display a filled bookmark icon to indicate flagged state
3. WHEN a card is not flagged THEN the System SHALL display an outline bookmark icon
4. WHEN the flag status changes THEN the System SHALL provide immediate visual feedback without page reload
5. IF the flag toggle fails THEN the System SHALL display an error message and revert the visual state

### Requirement 2: Personal Notes

**User Story:** As a medical student, I want to add personal notes to cards, so that I can record my own insights and mnemonics alongside the content.

#### Acceptance Criteria

1. WHEN viewing a card THEN the System SHALL display a collapsible "My Notes" section below the explanation
2. WHEN a user types in the notes field THEN the System SHALL auto-save after 1000ms of inactivity
3. WHILE notes are being saved THEN the System SHALL display a subtle "Saving..." indicator
4. WHEN notes are successfully saved THEN the System SHALL display a brief "Saved" confirmation
5. IF note saving fails THEN the System SHALL display an error message and preserve the unsaved content
6. WHEN a user revisits a card THEN the System SHALL display their previously saved notes

### Requirement 3: Global Search

**User Story:** As a medical student, I want to search across all my subscribed cards, so that I can quickly find specific topics or concepts.

#### Acceptance Criteria

1. WHEN a user enters a search query THEN the System SHALL search card_templates stem and explanation fields
2. WHEN displaying search results THEN the System SHALL only include cards from decks the user has subscribed to
3. WHEN displaying search results THEN the System SHALL show a maximum of 10 results for performance
4. WHEN displaying search results THEN the System SHALL show card title and a text snippet with the match highlighted
5. WHEN a user clicks a search result THEN the System SHALL open a single card preview modal
6. WHEN the search query is empty THEN the System SHALL hide the results dropdown
7. WHILE search is in progress THEN the System SHALL display a loading indicator

### Requirement 4: Single Card Preview Modal

**User Story:** As a medical student, I want to preview a card from search results, so that I can read, flag, or take notes without starting a full study session.

#### Acceptance Criteria

1. WHEN the preview modal opens THEN the System SHALL display the full card content (question, answer/options, explanation)
2. WHEN viewing the preview modal THEN the System SHALL allow flagging the card
3. WHEN viewing the preview modal THEN the System SHALL allow adding or editing notes
4. WHEN the user closes the modal THEN the System SHALL return focus to the search results

### Requirement 5: Flagged Study Mode

**User Story:** As a medical student, I want to study only my flagged cards, so that I can focus on content I've marked as important or difficult.

#### Acceptance Criteria

1. WHEN configuring a custom study session THEN the System SHALL display a "Study Flagged Cards Only" toggle
2. WHEN the flagged-only toggle is enabled THEN the System SHALL filter cards to only include those with `is_flagged = true`
3. WHEN no flagged cards exist THEN the System SHALL display a message indicating no flagged cards are available
4. WHEN combining flagged filter with other filters THEN the System SHALL apply all filters together (AND logic)

### Requirement 6: Database Schema

**User Story:** As a developer, I want the database schema to support flags and notes, so that user personalization data is properly stored.

#### Acceptance Criteria

1. THE user_card_progress table SHALL include an `is_flagged` boolean column with default value false
2. THE user_card_progress table SHALL include a `notes` text column with default value null
3. WHEN a user flags a card without existing progress THEN the System SHALL create a progress record with the flag
4. WHEN a user adds notes to a card without existing progress THEN the System SHALL create a progress record with the notes
