# Requirements Document

## Introduction

V7.0 introduces an automated full-document extraction loop that processes entire PDFs page-by-page without manual clicking. The system orchestrates browser-side extraction, AI drafting, and card creation in a controlled loop with safety mechanisms, crash recovery, and progress tracking.

## Glossary

- **Auto-Scan Loop**: A client-side orchestrator that iterates through PDF pages, extracts text, generates MCQs via AI, and saves cards automatically
- **Session State**: The current progress of an auto-scan including page position, statistics, and error log
- **Consecutive Error**: A page failure that occurs immediately after another page failure without a successful page in between
- **Skipped Page**: A page that failed extraction or AI processing after retry attempts
- **Command Center**: The floating UI controls for starting, pausing, and monitoring the auto-scan

## Requirements

### Requirement 1

**User Story:** As a user, I want to automatically scan an entire PDF document, so that I can extract all MCQs without clicking through each page manually.

#### Acceptance Criteria

1. WHEN a user clicks "Start Auto-Scan" THEN the System SHALL begin processing pages sequentially starting from page 1
2. WHEN processing a page THEN the System SHALL extract text, call the AI draft action, and save cards without user intervention
3. WHEN a page is successfully processed THEN the System SHALL advance to the next page after a 1-2 second delay
4. WHEN the current page exceeds total pages THEN the System SHALL stop the loop and display completion status
5. WHEN the user clicks "Pause" THEN the System SHALL stop processing and preserve current progress
6. WHEN the user clicks "Stop" THEN the System SHALL halt the loop and retain statistics for review

### Requirement 2

**User Story:** As a user, I want the auto-scan to handle errors gracefully, so that a few bad pages don't ruin my entire extraction session.

#### Acceptance Criteria

1. WHEN a page fails to process THEN the System SHALL retry that page once before marking it as skipped
2. WHEN a page is skipped THEN the System SHALL record the page number and error reason in a skipped pages log
3. WHEN three consecutive pages fail THEN the System SHALL stop the loop automatically and notify the user
4. WHEN the loop stops due to consecutive errors THEN the System SHALL preserve all progress and statistics

### Requirement 3

**User Story:** As a user, I want my auto-scan progress to survive browser refreshes, so that I don't lose my work if I accidentally reload the page.

#### Acceptance Criteria

1. WHEN the auto-scan state changes THEN the System SHALL persist state to localStorage immediately
2. WHEN the bulk import page loads THEN the System SHALL check for existing in-progress scan state
3. WHEN resumable state exists THEN the System SHALL display a banner offering Resume or Reset options
4. WHEN the user clicks "Resume" THEN the System SHALL continue scanning from the saved page position
5. WHEN the user clicks "Reset" THEN the System SHALL clear saved state and allow a fresh start

### Requirement 4

**User Story:** As a user, I want to see real-time progress during auto-scan, so that I know how much work remains and how many cards have been created.

#### Acceptance Criteria

1. WHILE auto-scan is running THEN the System SHALL display current page number and total pages
2. WHILE auto-scan is running THEN the System SHALL display a progress bar showing completion percentage
3. WHILE auto-scan is running THEN the System SHALL display running totals of cards created and pages skipped
4. WHEN auto-scan completes THEN the System SHALL display final statistics summary

### Requirement 5

**User Story:** As a user, I want manual tools disabled during auto-scan, so that I don't accidentally interfere with the automated process.

#### Acceptance Criteria

1. WHILE auto-scan is running THEN the System SHALL disable the manual "Scan Page" button
2. WHILE auto-scan is running THEN the System SHALL disable text selection AI Draft buttons
3. WHILE auto-scan is running THEN the System SHALL display a mode indicator showing "Auto-Scan Active"
4. WHEN auto-scan is not running THEN the System SHALL enable all manual tools normally

### Requirement 6

**User Story:** As a user, I want to review which pages were skipped, so that I can manually process them later if needed.

#### Acceptance Criteria

1. WHEN pages have been skipped THEN the System SHALL provide a viewable log of skipped page numbers
2. WHEN viewing skipped pages THEN the System SHALL display the error reason for each skipped page
3. WHEN the user requests export THEN the System SHALL download skipped pages data as JSON

### Requirement 7

**User Story:** As a user, I want the auto-scan to respect my existing session settings, so that tags and AI mode apply consistently.

#### Acceptance Criteria

1. WHEN auto-scan creates cards THEN the System SHALL apply session tags to all created cards
2. WHEN auto-scan calls AI THEN the System SHALL use the currently selected AI mode (extract/generate)
3. WHEN auto-scan processes pages THEN the System SHALL respect the "include next page" setting if enabled
