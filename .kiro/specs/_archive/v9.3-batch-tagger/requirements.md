# Requirements Document

## Introduction

V9.3: The Batch Tagger addresses two critical issues in Celline's OBGYN Prep application:

1. **Timeout Problem**: The current `autoTagCards` server action times out when processing large batches of cards because it sends all cards to OpenAI in a single request. This feature implements a client-side orchestration loop that processes cards in small chunks with progress feedback.

2. **Multi-Discipline Foundation**: As the application expands beyond OBGYN to support other medical specialties (Surgery, Internal Medicine, USMLE Step 1), the AI tagging system needs context about the deck's subject to avoid misclassification (e.g., tagging a cardiology "Heart" question as "Fetal Heart" in an OBGYN context).

## Glossary

- **Auto-Tag**: AI-powered classification of cards into topic and concept tags using OpenAI
- **Chunk**: A small batch of cards (3-5) processed in a single server action call
- **Client-Side Loop**: A pattern where the browser orchestrates multiple sequential server calls with progress tracking
- **Golden List**: The canonical set of topic tags for a given medical specialty
- **Subject**: The medical specialty/discipline associated with a deck (e.g., OBGYN, Surgery)
- **Progress Modal**: A UI overlay showing tagging progress that cannot be dismissed during operation

## Requirements

### Requirement 1: Client-Side Tagging Orchestrator

**User Story:** As a deck author, I want to auto-tag large batches of cards without timeouts, so that I can efficiently organize my content.

#### Acceptance Criteria

1. WHEN a user initiates auto-tagging on selected cards THEN the System SHALL split the cards into chunks of 3 cards each
2. WHEN processing chunks THEN the System SHALL send each chunk sequentially to the server action and wait for completion before sending the next chunk
3. WHEN a chunk completes successfully THEN the System SHALL update the progress indicator to show current progress (e.g., "Tagging 3 of 12...")
4. WHEN all chunks complete THEN the System SHALL display a success summary with total tagged and skipped counts
5. IF a chunk fails THEN the System SHALL continue processing remaining chunks and report partial success
6. WHEN auto-tagging is in progress THEN the System SHALL display a modal with a progress bar that cannot be dismissed by clicking outside

### Requirement 2: Server Action Chunk Limit

**User Story:** As a system architect, I want the server action to enforce a maximum chunk size, so that individual requests complete within timeout limits.

#### Acceptance Criteria

1. WHEN `autoTagCards` receives more than 5 card IDs THEN the System SHALL return an error response without processing
2. WHEN `autoTagCards` receives 1-5 card IDs THEN the System SHALL process all cards in parallel using `Promise.all`
3. WHEN processing cards in parallel THEN the System SHALL make concurrent OpenAI API calls to minimize response time
4. WHEN returning results THEN the System SHALL include counts of successfully tagged and skipped cards

### Requirement 3: Deck Subject Integration

**User Story:** As a deck author preparing for multiple board exams, I want to specify the medical specialty for each deck, so that AI tagging uses appropriate context.

#### Acceptance Criteria

1. WHEN a deck is created THEN the System SHALL default the subject to "Obstetrics & Gynecology"
2. WHEN a user edits deck settings THEN the System SHALL display a subject dropdown with options: OBGYN, Surgery, Internal Medicine, Pediatrics, Family Medicine, Emergency Medicine, Psychiatry, Neurology, Cardiology, Dermatology
3. WHEN the subject is changed THEN the System SHALL persist the new subject to the database
4. WHEN auto-tagging cards THEN the System SHALL pass the deck's subject to the AI classification prompt

### Requirement 4: Context-Aware AI Prompting

**User Story:** As a deck author, I want the AI to understand my deck's specialty, so that tags are relevant to my study context.

#### Acceptance Criteria

1. WHEN generating the AI system prompt THEN the System SHALL include the deck subject (e.g., "You are an expert in [SUBJECT]")
2. WHEN classifying cards THEN the System SHALL use specialty-appropriate interpretation of medical terms
3. WHEN the subject is not OBGYN THEN the System SHALL avoid OBGYN-specific interpretations of ambiguous terms

### Requirement 5: Progress Modal UX

**User Story:** As a user, I want clear feedback during auto-tagging, so that I know the operation is progressing and don't accidentally interrupt it.

#### Acceptance Criteria

1. WHEN auto-tagging starts THEN the System SHALL display a modal overlay with a progress bar
2. WHEN the modal is displayed THEN the System SHALL prevent dismissal by clicking outside or pressing Escape
3. WHEN progress updates THEN the System SHALL show the current chunk number and total (e.g., "Processing batch 2 of 4...")
4. WHEN auto-tagging completes THEN the System SHALL enable the modal close button and show final results
5. IF the user clicks Cancel during processing THEN the System SHALL stop sending new chunks but allow current chunk to complete
