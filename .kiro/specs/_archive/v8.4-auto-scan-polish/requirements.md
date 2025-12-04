# Requirements Document

## Introduction

V8.4 Auto-Scan Polish addresses two critical bugs in the Bulk Import Auto-Scan feature:

1. **Resume Amnesia**: The Auto-Scan resume functionality fails to properly save and restore scan progress, causing users to lose their place when pausing/resuming scans.

2. **Missing Tags**: AI-generated tags from the batch MCQ generation are not being persisted to the database, resulting in cards without their concept tags.

These fixes are essential for a reliable Auto-Scan experience where users can confidently pause long document scans and resume later, with all AI-suggested tags properly saved.

## Glossary

- **Auto-Scan**: Automated feature that processes PDF pages sequentially, generating MCQs from each page using AI
- **Resume State**: The saved progress (current page, stats, skipped pages) stored in localStorage
- **Session Tags**: User-selected tags applied to all cards created in a session
- **AI Tags**: Concept tags automatically suggested by the AI during MCQ generation
- **card_template_tags**: Junction table linking card_templates to tags in the database

## Requirements

### Requirement 1: Auto-Scan Resume State Persistence

**User Story:** As a user scanning a large PDF, I want my scan progress to be reliably saved so that I can pause and resume without losing my place.

#### Acceptance Criteria

1. WHEN the Auto-Scan processes a page successfully THEN the System SHALL immediately persist the updated currentPage to localStorage before advancing to the next page
2. WHEN a user clicks the Pause button THEN the System SHALL save the current scan state to localStorage and stop the scan loop
3. WHEN a user returns to a PDF with saved scan state THEN the System SHALL display the Resume banner showing the saved page number
4. WHEN a user clicks Resume THEN the System SHALL continue scanning from the saved currentPage without resetting stats
5. IF localStorage contains corrupted or invalid scan state THEN the System SHALL clear the corrupted data and allow a fresh start

### Requirement 2: AI Tag Persistence

**User Story:** As a user creating MCQs with Auto-Scan, I want the AI-suggested concept tags to be saved with my cards so that I can organize and filter my study material.

#### Acceptance Criteria

1. WHEN bulkCreateMCQV2 receives cards with tagNames THEN the System SHALL create or find matching tags in the tags table
2. WHEN creating tag records THEN the System SHALL associate them with the current user's user_id
3. WHEN card_templates are created THEN the System SHALL insert corresponding rows in card_template_tags linking each card to its tags
4. WHEN both sessionTags and AI tagNames exist for a card THEN the System SHALL persist both sets of tags without duplicates
5. WHEN a tag name already exists for the user (case-insensitive) THEN the System SHALL reuse the existing tag instead of creating a duplicate

### Requirement 3: Scan State Logging and Debugging

**User Story:** As a developer debugging Auto-Scan issues, I want clear logging of state changes so that I can trace resume and tag persistence problems.

#### Acceptance Criteria

1. WHEN Auto-Scan saves state to localStorage THEN the System SHALL log the key fields (currentPage, cardsCreated, pagesProcessed)
2. WHEN bulkCreateMCQV2 processes tags THEN the System SHALL log the count of tags being saved for each card
3. WHEN localStorage state is loaded on mount THEN the System SHALL log whether resumable state was found
