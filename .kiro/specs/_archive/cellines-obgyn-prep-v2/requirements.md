# Requirements Document

## Introduction

Celline's OBGYN Prep V2 extends the existing Spaced Repetition System with three major feature sets: (1) a Multiple Choice Question (MCQ) engine for Magoosh-style practice, (2) a Duolingo-style Course/Unit/Lesson path for structured learning, and (3) an enhanced bulk import workflow for PDF-assisted content creation. This phase focuses on enabling Celline to practice OBGYN MCQs from her PDF question banks in short, repeatable sessions with clear progress tracking.

## Glossary

- **MCQ (Multiple Choice Question):** A question format with a stem (prompt), multiple answer options, one correct answer, and an optional explanation.
- **Stem:** The question prompt or scenario text in an MCQ.
- **Options:** The array of possible answers for an MCQ (typically 4-5 choices).
- **Correct Index:** The zero-based index identifying which option is the correct answer.
- **Explanation:** Optional text explaining why the correct answer is correct and/or why other options are incorrect.
- **Course:** A top-level container organizing related Units around a subject area (e.g., "OBGYN Board Review").
- **Unit:** A section within a Course grouping related Lessons by topic (e.g., "Obstetrics Complications").
- **Lesson:** A short, repeatable study session containing a fixed number of MCQs and/or cards (e.g., 10 questions).
- **Lesson Item:** A reference linking a Lesson to either an MCQ or a flashcard, with ordering.
- **Lesson Progress:** A record tracking a user's completion status and best score for a specific Lesson.
- **Source:** A registered PDF or document that serves as the origin for imported MCQs/cards.
- **Card Type:** An enumeration distinguishing flashcards from MCQs within the cards table.

## Requirements

### Requirement 1: MCQ Data Model

**User Story:** As a system, I want to store MCQ-style questions with options, correct answer, and explanation, so that the app can support multiple choice practice alongside flashcards.

#### Acceptance Criteria

1. WHEN an MCQ is created, THE Database System SHALL store the stem, options array, correct_index, and optional explanation in the cards table with card_type set to 'mcq'.
2. WHEN storing MCQ options, THE Database System SHALL serialize the options as a JSONB array and deserialize them back to verify round-trip consistency.
3. WHEN the cards table is accessed, THE RLS Policy SHALL verify the user owns the parent deck via deck_id.
4. WHEN an MCQ is created, THE Validation System SHALL require a non-empty stem, at least 2 options, and a valid correct_index within the options array bounds.
5. WHEN an MCQ includes an image, THE Database System SHALL store the image_url referencing Supabase Storage.

### Requirement 2: MCQ Study Flow

**User Story:** As a user, I want to practice MCQs one at a time with immediate feedback and explanations, so that I can learn from my mistakes in a Magoosh-style experience.

#### Acceptance Criteria

1. WHEN a user selects an answer option, THE MCQ Study Component SHALL immediately reveal whether the selection is correct or incorrect.
2. WHEN displaying feedback, THE MCQ Study Component SHALL highlight the correct answer in green and any incorrect selection in red.
3. WHEN an MCQ has an explanation, THE MCQ Study Component SHALL display the explanation after the user answers.
4. WHEN a user answers an MCQ correctly, THE System SHALL map the response to an SRS rating of Good (3) for scheduling.
5. WHEN a user answers an MCQ incorrectly, THE System SHALL map the response to an SRS rating of Again (1) for scheduling.
6. WHEN an MCQ is answered, THE System SHALL update user_stats (total_reviews) and study_logs (cards_reviewed) identically to flashcard reviews.
7. WHEN displaying an MCQ, THE MCQ Study Component SHALL show a progress indicator (e.g., "Question 3 of 10").
8. WHEN an MCQ is answered, THE MCQ Study Component SHALL provide a clear button to proceed to the next question.

### Requirement 3: MCQ Authoring

**User Story:** As a user, I want to manually create MCQs from my PDF question banks, so that I can build my study content quickly.

#### Acceptance Criteria

1. WHEN creating an MCQ, THE Create MCQ Form SHALL accept a stem (markdown textarea), 4 options, correct option selector, explanation (markdown), and optional image upload.
2. WHEN the user submits an MCQ, THE Validation System SHALL reject submissions with empty stems, fewer than 2 options, or invalid correct_index values.
3. WHEN an MCQ is successfully created, THE Create MCQ Form SHALL reset while maintaining the current deck context for rapid entry.
4. WHEN creating an MCQ, THE Server Action SHALL verify the user owns the target deck before insertion.
5. WHEN uploading an image for an MCQ, THE System SHALL store the file in Supabase Storage and link via image_url.

### Requirement 4: Course/Unit/Lesson Schema

**User Story:** As a system, I want to organize MCQs and cards into a Course → Unit → Lesson hierarchy, so that users can follow a structured learning path.

#### Acceptance Criteria

1. WHEN a Course is created, THE Database System SHALL store id, user_id, title, description, and created_at with RLS enforcing user ownership.
2. WHEN a Unit is created, THE Database System SHALL store id, course_id, title, and order_index with RLS via course ownership.
3. WHEN a Lesson is created, THE Database System SHALL store id, unit_id, title, order_index, and target_item_count with RLS via unit/course ownership.
4. WHEN a Lesson Item is created, THE Database System SHALL store id, lesson_id, item_type ('mcq' or 'card'), item_id, and order_index.
5. WHEN a Unit is deleted, THE Database System SHALL cascade delete all child Lessons and Lesson Items.
6. WHEN a Course is deleted, THE Database System SHALL cascade delete all child Units, Lessons, and Lesson Items.

### Requirement 5: Lesson Study Flow

**User Story:** As a user, I want to complete short lessons with a clear start and end, so that I can study in focused, repeatable sessions.

#### Acceptance Criteria

1. WHEN a user starts a Lesson, THE Lesson Study System SHALL fetch all lesson_items in order and present them sequentially.
2. WHEN a lesson_item is of type 'mcq', THE Lesson Study System SHALL invoke the MCQ study flow for that item.
3. WHEN a lesson_item is of type 'card', THE Lesson Study System SHALL invoke the existing flashcard study flow for that item.
4. WHEN a Lesson completes, THE Lesson Study System SHALL record the completion in lesson_progress with timestamp and score.
5. WHEN a Lesson completes, THE Lesson Summary SHALL display the score (correct/total), mistakes made, and options to repeat or continue.
6. WHEN a Lesson is completed, THE System SHALL update study_logs and user_stats to maintain streak and heatmap consistency.

### Requirement 6: Course Map Navigation

**User Story:** As a user, I want to see a visual map of my course progress, so that I can track where I am and what's next like Duolingo.

#### Acceptance Criteria

1. WHEN viewing a Course, THE Course Map SHALL display all Units vertically with Lessons shown as tiles within each Unit.
2. WHEN displaying a Lesson tile, THE Course Map SHALL show the lesson title and completion status (locked, unlocked, completed).
3. WHEN a user has not completed the previous Lesson, THE Course Map SHALL display the next Lesson as locked.
4. WHEN the first Lesson of the first Unit has no prerequisites, THE Course Map SHALL display it as unlocked by default.
5. WHEN a Lesson is completed, THE Course Map SHALL display a checkmark or completion indicator on that tile.
6. WHEN a user taps an unlocked Lesson tile, THE Course Map SHALL navigate to the Lesson Overview page.
7. WHEN a user taps a locked Lesson tile, THE Course Map SHALL display a message indicating the prerequisite Lesson.

### Requirement 7: Lesson Progress Tracking

**User Story:** As a user, I want my lesson completion and scores tracked, so that I can see my progress and know which lessons to revisit.

#### Acceptance Criteria

1. WHEN a Lesson is completed, THE Database System SHALL upsert a lesson_progress record with user_id, lesson_id, last_completed_at, and score.
2. WHEN the lesson_progress table is accessed, THE RLS Policy SHALL verify auth.uid() equals user_id.
3. WHEN determining lesson lock status, THE System SHALL query lesson_progress for the previous lesson in order_index sequence.
4. WHEN a user completes a Lesson with a higher score than before, THE System SHALL update best_score in lesson_progress.

### Requirement 8: Source Document Model

**User Story:** As a system, I want to register PDF sources linked to decks, so that users can track where their content originated.

#### Acceptance Criteria

1. WHEN a Source is created, THE Database System SHALL store id, user_id, title, type, file_url, and created_at.
2. WHEN the sources table is accessed, THE RLS Policy SHALL verify auth.uid() equals user_id.
3. WHEN a Source is linked to a Deck, THE Database System SHALL create a deck_sources record with deck_id and source_id.
4. WHEN a user uploads a PDF, THE System SHALL validate file type (PDF only) and enforce a reasonable maximum file size.

### Requirement 9: PDF Upload and Linking

**User Story:** As a user, I want to upload my OBGYN PDFs and link them to decks, so that I can reference my source materials while creating content.

#### Acceptance Criteria

1. WHEN on the bulk import page, THE Upload UI SHALL display an "Upload PDF" button if no source is linked.
2. WHEN a PDF is uploaded, THE System SHALL store the file in Supabase Storage with user-scoped access.
3. WHEN a PDF upload succeeds, THE System SHALL create a source record and optionally link it to the current deck.
4. WHEN a source is linked, THE Bulk Import Page SHALL display the source title and filename.
5. WHEN a user attempts to access another user's PDF via URL, THE Storage Policy SHALL deny access.

### Requirement 10: Manual Extraction Helper

**User Story:** As a user, I want a streamlined interface to copy/paste from my PDFs and create MCQs quickly, so that I can build my question bank efficiently.

#### Acceptance Criteria

1. WHEN on the bulk import page, THE UI SHALL display a large textarea for pasting PDF text alongside the Create MCQ form.
2. WHEN pasting text, THE UI SHALL provide instructions guiding the user to copy/paste into the MCQ form fields.
3. WHEN the layout is displayed, THE UI SHALL use a split-view design (textarea left, form right) on larger screens.
4. WHEN designing the layout, THE UI SHALL include placeholder space for a future "AI Suggest MCQs" button.

