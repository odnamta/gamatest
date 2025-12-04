# Requirements Document

## Introduction

V8.5 Data Integrity focuses on three areas to improve the reliability and completeness of the Auto-Scan MCQ generation:

1. **Tag Display on Read-Side**: Ensure AI-generated tags are visible when viewing cards in the deck detail page
2. **AI Strictness**: Make tags mandatory in AI responses and improve extraction thoroughness
3. **Resume Logic Clarity**: Add explicit `isResuming` flag to prevent confusion between fresh start and resume

These improvements build on V8.4's tag persistence fixes to ensure tags flow through the entire system from AI generation to database storage to UI display.

## Glossary

- **card_template_tags**: Junction table linking card_templates to tags in the V2 schema
- **AI Tags**: Concept tags automatically suggested by the AI during MCQ generation (1-3 per question)
- **Session Tags**: User-selected tags applied to all cards created in a session
- **Forensic Mode**: AI extraction mode that thoroughly scans for all questions in the source text
- **Resume Flag**: Boolean indicating whether Auto-Scan should continue from saved state vs start fresh

## Requirements

### Requirement 1: Tag Display on Card View

**User Story:** As a user viewing my deck, I want to see the AI-generated tags on each card so that I can understand the topics covered and filter my study sessions.

#### Acceptance Criteria

1. WHEN a user views a deck detail page THEN the System SHALL display tags for each card_template by joining with card_template_tags
2. WHEN fetching card details THEN the System SHALL include the tag names from the tags table via the card_template_tags junction
3. WHEN no tags exist for a card THEN the System SHALL display an empty tag list without errors
4. WHEN tags are displayed THEN the System SHALL show them in a visually distinct format (e.g., colored badges)

### Requirement 2: AI Tag Enforcement

**User Story:** As a user generating MCQs with AI, I want every question to have at least one medical concept tag so that my cards are properly categorized for study.

#### Acceptance Criteria

1. WHEN the AI generates an MCQ THEN the System SHALL require at least 1 tag and at most 3 tags per question
2. WHEN validating AI response THEN the System SHALL reject questions with empty or missing tags array
3. WHEN prompting the AI THEN the System SHALL instruct it to generate at least 1 medical concept tag per question
4. WHEN the AI returns questions without tags THEN the System SHALL filter them out before presenting to the user

### Requirement 3: AI Extraction Thoroughness

**User Story:** As a user scanning a PDF page, I want the AI to find all MCQs present in the text so that I don't miss any questions.

#### Acceptance Criteria

1. WHEN extracting MCQs from text THEN the System SHALL instruct the AI to use "forensic mode" to find every question
2. WHEN the source text contains multiple questions THEN the System SHALL extract up to 5 questions per request
3. WHEN the AI prompt is constructed THEN the System SHALL include explicit instructions to not skip questions
4. WHEN questions are found THEN the System SHALL preserve their original numbering or ordering from the source

### Requirement 4: Resume Logic Clarity

**User Story:** As a user resuming an Auto-Scan, I want the system to clearly distinguish between starting fresh and resuming so that I don't accidentally lose my progress.

#### Acceptance Criteria

1. WHEN the Resume button is clicked THEN the System SHALL pass an explicit `isResuming: true` flag to the scan function
2. WHEN `isResuming` is true THEN the System SHALL use the saved currentPage from localStorage
3. WHEN `isResuming` is false or undefined THEN the System SHALL start from the specified startPage or page 1
4. WHEN resuming THEN the System SHALL preserve all existing stats (cardsCreated, pagesProcessed, errorsCount)
5. IF the saved state is corrupted or missing THEN the System SHALL fall back to starting fresh with a warning
