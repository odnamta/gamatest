# Requirements Document

## Introduction

V8.6 "No Question Left Behind" is a remediation patch for Celline's OBGYN Prep that addresses three critical issues: data loss during batch MCQ extraction from dense PDF pages, unreliable resume functionality in the auto-scan feature, and the inability to rename decks after creation. Additionally, it introduces a quality-of-life feature to flag complex question formats that may need manual review.

## Glossary

- **Batch Extraction**: The process of using AI to extract multiple MCQs from a single page of source text
- **Auto-Scan**: Automated page-by-page MCQ extraction from a PDF document
- **Resume**: Continuing an interrupted auto-scan from the last processed page
- **Dense Page**: A PDF page containing more than 5 MCQs
- **Complex Format**: Question types that may not parse correctly (matching, linked questions, tables)
- **deck_template**: The V2 schema table storing deck metadata (title, author, visibility)
- **NeedsReview Tag**: A special tag indicating a card requires manual verification

## Requirements

### Requirement 1: Unlimited Batch Extraction

**User Story:** As a user importing MCQs from dense PDF pages, I want all questions on a page to be extracted, so that I don't lose any study material.

#### Acceptance Criteria

1. WHEN the AI extracts MCQs from source text THEN the System SHALL return all valid MCQs found without an artificial cap
2. WHEN a page contains more than 5 MCQs THEN the System SHALL extract and save all of them
3. WHEN the AI response is large THEN the System SHALL allocate sufficient token budget (4096+) to prevent truncation
4. WHEN validating extracted MCQs THEN the System SHALL process all items in the response array without slicing

### Requirement 2: Bulletproof Resume

**User Story:** As a user who paused an auto-scan, I want to resume from exactly where I left off, so that I don't re-process pages or lose progress.

#### Acceptance Criteria

1. WHEN a user clicks Resume THEN the System SHALL continue from the saved currentPage without resetting to page 1
2. WHEN resumable state exists in localStorage THEN the System SHALL preserve all accumulated stats (cardsCreated, pagesProcessed, errorsCount)
3. WHEN the Resume button is clicked THEN the System SHALL verify localStorage state exists before proceeding
4. IF no valid saved state exists WHEN Resume is requested THEN the System SHALL fall back to starting fresh with a warning

### Requirement 3: Deck Renaming

**User Story:** As a deck author, I want to rename my decks after creation, so that I can organize my content with better titles.

#### Acceptance Criteria

1. WHEN a deck author views their deck details page THEN the System SHALL display an editable title with a pencil icon
2. WHEN a user edits the deck title and confirms THEN the System SHALL update the deck_template title in the database
3. WHEN a non-author views a deck THEN the System SHALL display the title as read-only text
4. WHEN a title update succeeds THEN the System SHALL provide optimistic UI feedback before server confirmation
5. IF a title update fails THEN the System SHALL revert to the previous title and display an error message

### Requirement 4: Complex Card Flagging

**User Story:** As a user importing MCQs, I want complex question formats to be flagged for review, so that I can manually verify they parsed correctly.

#### Acceptance Criteria

1. WHEN the AI detects a complex question format (matching, linked, tables) THEN the System SHALL add a "NeedsReview" tag to that card
2. WHEN displaying cards with the NeedsReview tag THEN the System SHALL highlight them with a yellow border
3. WHEN filtering cards THEN the System SHALL provide an option to show only cards needing review
