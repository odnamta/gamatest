# Requirements Document

## Introduction

V8.3 addresses three critical issues in the Bulk Import workflow: crash protection when PDFs fail to load, precision page range scanning for chapter-by-chapter extraction, and intra-deck deduplication to clean up duplicate MCQs created during auto-scan sessions. These fixes improve stability, user control, and data quality in the MCQ creation pipeline.

## Glossary

- **Bulk Import Page**: The `/decks/[deckId]/add-bulk` page where users upload PDFs and create MCQs
- **Auto-Scan**: Automated process that iterates through PDF pages extracting MCQs via AI
- **PDFViewer**: Component that renders PDF documents and handles text selection
- **ErrorBoundary**: React component that catches JavaScript errors in child components and displays fallback UI
- **Page Range**: A start page and end page defining a subset of PDF pages to scan
- **Stem**: The question text of an MCQ card
- **Intra-Deck Deduplication**: Process of finding and removing MCQ cards with identical stems within a single deck

## Requirements

### Requirement 1: Bulk Import Crash Protection

**User Story:** As a user, I want the Bulk Import page to remain functional even when the PDF fails to load, so that I can still upload a new PDF or retry without refreshing the entire page.

#### Acceptance Criteria

1. WHEN the PDFViewer component receives a null or undefined fileUrl THEN the PDFViewer SHALL display a placeholder message instead of crashing
2. WHEN the useAutoScan hook reads corrupted JSON from localStorage THEN the useAutoScan hook SHALL catch the parse error and return null state instead of throwing
3. WHEN any child component of the Bulk Import page throws a render error THEN the ErrorBoundary SHALL catch the error and display a recovery UI with retry option
4. WHILE the PDF has failed to load THEN the Bulk Import page SHALL keep the upload button visible and functional

### Requirement 2: Precision Page Range Scanning

**User Story:** As a user, I want to specify a start page and end page for auto-scan, so that I can scan specific chapters or resume from where I left off without manual intervention.

#### Acceptance Criteria

1. WHEN the AutoScanControls component renders THEN the AutoScanControls component SHALL display a Start Page input defaulting to the current PDF page number
2. WHEN the AutoScanControls component renders THEN the AutoScanControls component SHALL display an End Page input defaulting to the total page count
3. WHEN the user changes the current page in PDFViewer THEN the Start Page input SHALL update to reflect the new current page
4. WHEN the user clicks Start Auto-Scan THEN the useAutoScan hook SHALL accept startPage and endPage parameters and scan only that range
5. WHEN the auto-scan reaches the endPage THEN the useAutoScan hook SHALL stop automatically and report completion
6. WHEN the user enters an invalid page range (startPage > endPage or out of bounds) THEN the AutoScanControls component SHALL disable the Start button and display a validation message

### Requirement 3: Intra-Deck Deduplication

**User Story:** As a user, I want to remove duplicate MCQs from my deck, so that I can clean up cards with identical questions that were accidentally created during bulk import.

#### Acceptance Criteria

1. WHEN the removeDuplicateCards server action is called with a deckId THEN the server action SHALL identify all card_templates with identical normalized stem values within that deck
2. WHEN duplicate stems are found THEN the server action SHALL keep the oldest card (by created_at) and delete the newer duplicates
3. WHEN deleting duplicate cards THEN the server action SHALL use a database transaction to ensure atomicity
4. WHEN the user clicks "Clean Duplicates" on the Deck Details page THEN the system SHALL call removeDuplicateCards and display the count of removed cards
5. WHEN no duplicates exist in the deck THEN the server action SHALL return a success response with zero deleted count

