# Requirements Document

## Introduction

V11.6 "Bulk Import Reliability (Hyperflow)" focuses on improving the reliability, predictability, and manageability of the bulk MCQ import workflow. This version introduces a dedicated Drafts Workspace for managing imported cards per deck, solidifies atomicity guarantees in bulkCreateMCQV2, and improves autoscan ergonomics with clearer error handling and re-run semantics.

**Constraints:**
- Schema changes are DISALLOWED - use existing tables/columns only
- Mobile-first UX (375px minimum)
- Reuse existing patterns: bulkCreateMCQV2, content-staging-metrics, tag-resolver, withUser + ActionResultV2

## Glossary

- **Draft**: A card_template with status='draft', pending author review before publishing
- **Published**: A card_template with status='published', visible in study sessions
- **Archived**: A card_template with status='archived', hidden from study but retained
- **Import Session**: A batch import operation identified by import_session_id
- **QA Metrics**: Quality assurance data tracking detected vs created question counts
- **Autoscan**: AI-powered extraction of MCQs from PDF/text content
- **Deck Template**: The shared content layer table (deck_templates) containing deck metadata
- **Card Template**: The shared content layer table (card_templates) containing MCQ content

## Requirements

### Requirement 1: List Draft MCQs per Deck

**User Story:** As an author, I want to view all draft MCQs for a specific deck, so that I can review and manage imported content before publishing.

#### Acceptance Criteria

1. WHEN an author requests drafts for a deck THEN the System SHALL return only card_templates where status='draft' and deck_template_id matches
2. WHEN fetching drafts THEN the System SHALL include question_number, stem preview, tags, and import_session_id for each draft
3. WHEN a non-author requests drafts for a deck THEN the System SHALL return an authorization error
4. WHEN drafts are fetched THEN the System SHALL order them by question_number ascending, then by created_at ascending
5. WHEN the deck has no drafts THEN the System SHALL return an empty array without error

### Requirement 2: Drafts Panel UI

**User Story:** As an author, I want a dedicated Drafts section in the deck view, so that I can easily review and manage pending imports.

#### Acceptance Criteria

1. WHEN an author views a deck with drafts THEN the System SHALL display a Drafts panel showing draft count and list
2. WHEN displaying drafts THEN the System SHALL show question number, stem (1-2 line clamp), and tag chips for each draft
3. WHEN the viewport is 375px or smaller THEN the System SHALL collapse the drafts table into stacked cards
4. WHEN drafts exist THEN the System SHALL provide bulk selection UI with per-row checkboxes and "Select all visible" option
5. WHEN no drafts exist THEN the System SHALL hide or collapse the Drafts panel

### Requirement 3: Bulk Publish and Archive

**User Story:** As an author, I want to bulk publish or archive selected drafts, so that I can efficiently manage large imports.

#### Acceptance Criteria

1. WHEN an author selects drafts and clicks "Publish selected" THEN the System SHALL transition all selected card_templates to status='published'
2. WHEN an author selects drafts and clicks "Archive selected" THEN the System SHALL transition all selected card_templates to status='archived'
3. WHEN a bulk action completes THEN the System SHALL refresh the Drafts panel without full-page reload
4. WHEN a bulk action is requested THEN the System SHALL display a confirmation dialog before proceeding
5. WHEN a bulk action fails THEN the System SHALL display an error message and not modify any cards

### Requirement 4: Atomic Writes in bulkCreateMCQV2

**User Story:** As an author, I want bulk imports to be atomic, so that partial failures do not leave orphaned or inconsistent data.

#### Acceptance Criteria

1. WHEN bulkCreateMCQV2 inserts card_templates, tags, card_template_tags, and user_card_progress THEN the System SHALL ensure all operations succeed or none are committed
2. WHEN any insert step fails THEN the System SHALL return { ok: false, error } without committing partial data
3. WHEN a tag creation race condition occurs THEN the System SHALL handle it gracefully without failing the entire batch

### Requirement 5: Missing Question Detection

**User Story:** As an author, I want to see which question numbers are missing from my import, so that I can identify gaps in extraction.

#### Acceptance Criteria

1. WHEN autoscan detects question numbers THEN the System SHALL calculate missing numbers by comparing detected vs created
2. WHEN displaying QA metrics THEN the System SHALL show missing question numbers consistently between BatchReviewPanel and backend
3. WHEN missing numbers exist THEN the System SHALL display them with a warning indicator
4. WHEN all detected questions are created THEN the System SHALL display "Complete ✓" status

### Requirement 6: Duplicate Protection

**User Story:** As an author, I want the system to prevent duplicate cards when re-importing the same content, so that I don't have to manually clean up duplicates.

#### Acceptance Criteria

1. WHEN importing cards THEN the System SHALL check for duplicates based on deck_template_id and normalized stem text
2. WHEN a duplicate is detected THEN the System SHALL skip creating that card without failing the batch
3. WHEN duplicates are skipped THEN the System SHALL report the skip count in the result
4. WHEN the same PDF chunk is re-imported THEN the System SHALL not create duplicate cards

### Requirement 7: Extraction Error Handling

**User Story:** As an author, I want clear feedback when PDF extraction or AI generation fails, so that I can take corrective action.

#### Acceptance Criteria

1. WHEN PDF text extraction fails THEN the System SHALL display a user-friendly error message indicating which pages failed
2. WHEN AI draft generation fails THEN the System SHALL display the error without creating partial imports
3. WHEN extraction fails for some pages THEN the System SHALL indicate which part failed and suggest re-running that chunk
4. WHEN displaying errors on mobile THEN the System SHALL ensure messages are readable without horizontal scroll

### Requirement 8: Autoscan Re-run vs Append Semantics

**User Story:** As an author, I want predictable behavior when re-running autoscan on the same content, so that I understand what will happen to existing drafts.

#### Acceptance Criteria

1. WHEN autoscan is triggered THEN the System SHALL display a hint describing whether it will replace or append
2. WHEN the same chunk and settings are used THEN the System SHALL apply duplicate protection to prevent double cards
3. WHEN autoscan completes THEN the System SHALL show consistent results across multiple runs on the same source
4. WHEN re-running autoscan THEN the System SHALL not silently mix replace and append modes

