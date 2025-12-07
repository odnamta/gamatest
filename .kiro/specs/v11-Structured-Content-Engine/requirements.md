# Requirements Document

## Introduction

V11 "Structured Content Engine" replaces fragile tag-based organization with a robust relational model for Books, Chapters, and Matching Sets. This version introduces a QA-focused ingestion workflow that tracks expected vs. actual question counts and detects missing questions during bulk import. All changes are additive and backwards-compatible with existing data.

## Glossary

- **Specialize**: The medical board exam preparation application
- **card_templates**: The canonical MCQ/flashcard content table (V2 schema)
- **deck_templates**: Shared deck containers that hold card_templates
- **sources**: Existing table for PDF/document tracking (file_url, metadata)
- **Book Source**: A textbook or question bank with title, edition, and specialty
- **Chapter**: A numbered section within a book source
- **Matching Group**: A set of questions sharing common answer options (e.g., matching exercises)
- **Question Number**: The original number assigned to a question in the source material
- **Expected Question Count**: Admin-provided estimate of questions in a chapter for QA validation
- **Import Session**: A single bulk import operation targeting one chapter

## Schema Discovery Summary

**Existing Tables (to be reused/extended):**
- `card_templates` - Canonical MCQ table with: stem, options (JSONB), correct_index, explanation, source_meta (JSONB)
- `deck_templates` - Deck containers with author_id, visibility
- `sources` - PDF tracking with: title, type, file_url, metadata (JSONB)
- `tags` - 3-tier taxonomy (source/topic/concept) with card_template_tags join table

**New Tables Required:**
- `book_sources` - Structured book/textbook metadata
- `book_chapters` - Chapter hierarchy within books
- `matching_groups` - Shared options for matching-style questions

## Requirements

### Requirement 1: Book Source Management

**User Story:** As an admin, I want to register textbooks and question banks with structured metadata, so that imported questions can be traced to their authoritative source.

#### Acceptance Criteria

1. THE System SHALL provide a `book_sources` table with columns: id (UUID), author_id (UUID FK), title (TEXT), edition (TEXT nullable), specialty (TEXT nullable), created_at (TIMESTAMPTZ)
2. WHEN an admin creates a book source THEN the System SHALL validate that title is non-empty
3. WHEN displaying book sources THEN the System SHALL show title, edition, and specialty
4. THE System SHALL enforce RLS so authors can only manage their own book_sources
5. WHEN a book source is deleted THEN the System SHALL cascade delete associated chapters

### Requirement 2: Chapter Management

**User Story:** As an admin, I want to organize book sources into numbered chapters, so that questions can be grouped by their location in the source material.

#### Acceptance Criteria

1. THE System SHALL provide a `book_chapters` table with columns: id (UUID), book_source_id (UUID FK), chapter_number (INTEGER), title (TEXT), expected_question_count (INTEGER nullable), created_at (TIMESTAMPTZ)
2. WHEN an admin creates a chapter THEN the System SHALL validate that chapter_number is positive and title is non-empty
3. WHEN displaying chapters THEN the System SHALL order them by chapter_number ascending
4. THE System SHALL enforce unique constraint on (book_source_id, chapter_number)
5. WHEN a chapter is deleted THEN the System SHALL set chapter_id to NULL on associated card_templates (not cascade delete)

### Requirement 3: Card-to-Chapter Linking

**User Story:** As an admin, I want to link MCQs to their source chapter, so that I can track question provenance and detect missing content.

#### Acceptance Criteria

1. THE card_templates table SHALL include nullable columns: book_source_id (UUID FK), chapter_id (UUID FK), question_number (INTEGER nullable)
2. WHEN saving cards via bulk import with chapter context THEN the System SHALL populate book_source_id and chapter_id
3. WHEN chapter context is not provided THEN the System SHALL leave book_source_id and chapter_id as NULL (backwards compatible)
4. WHEN querying cards by chapter THEN the System SHALL return all card_templates with matching chapter_id
5. THE question_number field SHALL store the original question number from the source material

### Requirement 4: Matching Group Support

**User Story:** As an admin, I want to group matching-style questions that share common options, so that the relationship between questions is preserved.

#### Acceptance Criteria

1. THE System SHALL provide a `matching_groups` table with columns: id (UUID), chapter_id (UUID FK nullable), common_options (JSONB), instruction_text (TEXT nullable), created_at (TIMESTAMPTZ)
2. THE card_templates table SHALL include a nullable column: matching_group_id (UUID FK)
3. WHEN cards belong to a matching group THEN each card SHALL still store its own options (denormalized for study compatibility)
4. WHEN displaying a matching group THEN the System SHALL show the common_options and all linked questions
5. WHEN a matching group is deleted THEN the System SHALL set matching_group_id to NULL on associated card_templates

### Requirement 5: Import Setup UI Enhancement

**User Story:** As an admin, I want to select a book and chapter before running Auto-Scan, so that imported questions are automatically linked to their source.

#### Acceptance Criteria

1. WHEN starting a bulk import session THEN the System SHALL display a book source selector (dropdown or search)
2. WHEN a book source is selected THEN the System SHALL display a chapter selector filtered to that book
3. WHEN no suitable book/chapter exists THEN the System SHALL allow inline creation via a minimal dialog
4. WHEN the admin provides an expected question count THEN the System SHALL store it for QA comparison
5. WHEN Auto-Scan saves cards THEN the System SHALL pass book_source_id and chapter_id to bulkCreateMCQV2

### Requirement 6: QA Feedback Display

**User Story:** As an admin, I want to see how many questions were generated vs. expected, so that I can identify incomplete imports.

#### Acceptance Criteria

1. WHEN displaying import results THEN the System SHALL show "Generated X / Expected Y cards" when expected count was provided
2. WHEN X < Y THEN the System SHALL display a warning banner indicating potential missing questions
3. WHEN X >= Y THEN the System SHALL display a success indicator
4. THE QA display SHALL query card_templates filtered by chapter_id, not by tags

### Requirement 7: Question Number Detection

**User Story:** As an admin, I want the system to detect question numbers in the source text, so that missing questions can be identified.

#### Acceptance Criteria

1. WHEN processing PDF text before AI extraction THEN the System SHALL scan for question numbering patterns (e.g., "1.", "2.", "1)", "2)")
2. THE System SHALL record the set of detected question numbers for the current import session
3. WHEN cards are saved THEN the System SHALL compare detected numbers with saved question_number values
4. WHEN there is a mismatch THEN the System SHALL display a list of missing question numbers in the review UI
5. THE missing question detection SHALL be read-only and advisory in V11 (no automatic re-extraction)

### Requirement 8: Matching Set Detection

**User Story:** As an admin, I want the system to detect matching-style question blocks, so that shared options are properly grouped.

#### Acceptance Criteria

1. WHEN processing PDF text THEN the System SHALL detect blocks with labeled options (A., B., C.) followed by numbered questions
2. WHEN a matching block is detected THEN the System SHALL pass explicit metadata to the AI indicating the option block
3. WHEN AI generates cards from a matching block THEN each card SHALL include the full options set
4. WHEN saving matching block cards THEN the System SHALL create a matching_group record and link all cards to it

### Requirement 9: Backwards Compatibility

**User Story:** As a developer, I want V11 changes to be non-breaking, so that existing data and workflows continue to function.

#### Acceptance Criteria

1. THE System SHALL NOT delete or mass-modify existing tags during V11 migration
2. WHEN bulk import is called without book/chapter parameters THEN the System SHALL function as before (null foreign keys)
3. THE existing study flows SHALL continue to work regardless of whether cards have book/chapter links
4. THE existing tag-based filtering SHALL remain functional alongside the new chapter-based organization
5. WHEN extending bulkCreateMCQV2 THEN the System SHALL accept optional book/chapter parameters without breaking existing callers
