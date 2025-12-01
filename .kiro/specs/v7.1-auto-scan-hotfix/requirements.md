# Requirements Document

## Introduction

V7.1 Loop Stabilization Hotfix addresses critical blocking errors in the V7.0 Auto-Scan feature. The auto-scan loop currently fails to save cards due to deck-template ID mismatch, has broken resume logic after PDF reload, and has non-functional UI controls (Append Next, +1 Page checkbox). This hotfix ensures Auto-Scan uses the exact same backend path as manual Scan Page.

## Glossary

- **Auto-Scan**: Automated loop that processes PDF pages sequentially, extracting MCQs via AI and saving them
- **Manual Scan Page**: The existing working "Scan Page" button that processes a single page
- **deck_template_id**: The ID of the deck template (used in V2 schema for card_templates)
- **user_deck_id**: Legacy deck ID (V1 schema) - must NOT be confused with deck_template_id
- **source_id**: The ID of the uploaded PDF source, used for localStorage state keying
- **card_templates**: V2 schema table where MCQ content is stored (NOT user_card_progress)
- **Resume State**: localStorage-persisted scan progress allowing continuation after page refresh
- **Consecutive Errors**: Count of sequential page failures; 3 triggers safety stop

## Requirements

### Requirement 1: Deck Template Wiring Fix (BLOCKER)

**User Story:** As a user running Auto-Scan, I want cards to be saved correctly, so that I can see my generated MCQs in my deck.

#### Acceptance Criteria

1. WHEN Auto-Scan calls bulkCreateMCQV2 THEN the System SHALL pass the same deckTemplateId that manual Scan Page passes
2. WHEN Auto-Scan initializes THEN the System SHALL obtain deckId from the page route params (not undefined/null)
3. WHEN Auto-Scan initializes THEN the System SHALL obtain sourceId from linkedSource.id (not undefined/null)
4. WHEN bulkCreateMCQV2 fails to find deck_template THEN the System SHALL return a detailed error message including the received ID
5. WHEN Auto-Scan saves cards THEN the System SHALL insert into card_templates table (not user_card_progress directly)

### Requirement 2: Resume Logic Fix (PDF Reload UX)

**User Story:** As a user who refreshed the page mid-scan, I want to resume from where I left off, so that I don't lose my progress.

#### Acceptance Criteria

1. WHEN savedState exists and user clicks Resume THEN the System SHALL start scanning from savedState.currentPage (not page 1)
2. WHEN savedState exists but no PDF is loaded THEN the System SHALL display "Last scan stopped at Page X. Please re-select your PDF to resume."
3. WHEN no PDF is loaded THEN the System SHALL disable the Start Auto-Scan button
4. WHEN user clicks Resume THEN the System SHALL call startScan with the saved page number
5. WHEN PDF reloads after resume banner appears THEN the System SHALL preserve the saved state until explicitly reset

### Requirement 3: Append & +1 Page Wiring Fix

**User Story:** As a user building context across pages, I want Append Next and +1 Page to work correctly, so that I can combine text from multiple pages.

#### Acceptance Criteria

1. WHEN user clicks Append Next THEN the System SHALL update the textarea value immediately (not just show toast)
2. WHEN user checks +1 Page checkbox THEN the System SHALL combine current and next page text during extraction
3. WHEN +1 Page is checked THEN the System SHALL update Scan Page button text to "Scan Pages X & X+1"

### Requirement 4: Loop Robustness

**User Story:** As a user scanning a long PDF, I want the loop to handle empty pages gracefully, so that it doesn't stop unnecessarily.

#### Acceptance Criteria

1. WHEN a page produces 0 MCQs THEN the System SHALL treat it as skipped (neutral) and continue scanning
2. WHEN an actual error occurs (API failure, save failure) THEN the System SHALL increment consecutiveErrors
3. WHEN consecutiveErrors reaches 3 THEN the System SHALL stop scanning and show safety stop message
4. WHEN navigator.onLine becomes false THEN the System SHALL auto-pause and display "Connection lost, scan paused"