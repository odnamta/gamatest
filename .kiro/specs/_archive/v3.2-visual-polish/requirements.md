# Requirements Document

## Introduction

V3.2 Visual Polish & Bug Fixes addresses three key areas: implementing a GitHub-style heatmap with proper right-aligned layout, hiding incomplete course features until the AI Course Generator is ready, and stabilizing the Bulk Import workflow with permanent source management and power-user copy tools.

## Glossary

- **Heatmap**: A visual grid displaying study activity over time, styled like GitHub's contribution graph with right-aligned layout where today is always bottom-right
- **SourceBar**: A persistent UI component showing the currently linked PDF file with options to upload or replace
- **Copy Toolbar**: A row of buttons for quickly copying selected text to specific MCQ form fields
- **MCQ**: Multiple Choice Question with stem, options (A-E), correct answer, and explanation

## Requirements

### Requirement 1: GitHub-Style Heatmap Layout

**User Story:** As a user, I want the study heatmap to look like GitHub's contribution graph, so that I can easily see my study patterns with today always visible at the bottom-right.

#### Acceptance Criteria

1. WHEN the Heatmap renders THEN the Heatmap component SHALL use a right-aligned (justify-end) flex or grid container
2. WHEN the viewport width is below the large breakpoint THEN the Heatmap component SHALL display the last 28 days arranged in 4 rows of 7 columns
3. WHEN the viewport width is at or above the large breakpoint THEN the Heatmap component SHALL display the last 84 days arranged in 12 rows of 7 columns
4. WHEN the Heatmap displays study days THEN the Heatmap component SHALL position the current day (today) at the bottom-right-most square
5. WHEN the Heatmap renders THEN the Heatmap component SHALL display squares with visible gaps between them matching GitHub's visual style

### Requirement 2: Hide Incomplete Course Features

**User Story:** As a user, I want to only see features that are ready to use, so that I am not confused by incomplete course functionality.

#### Acceptance Criteria

1. WHEN the LibrarySection renders THEN the LibrarySection component SHALL hide all Courses rendering logic
2. WHEN the LibrarySection renders THEN the LibrarySection component SHALL hide the Create Course button
3. WHEN the LibrarySection renders THEN the LibrarySection component SHALL display only the Decks section

### Requirement 3: Fix Deck Button Overlay

**User Story:** As a user, I want a clean deck creation interface without overlapping elements.

#### Acceptance Criteria

1. WHEN the Decks section renders THEN the Dashboard component SHALL not display a floating Add Deck button
2. WHEN the Decks section renders THEN the Dashboard component SHALL display only the inline Create Deck form for adding decks

### Requirement 4: Permanent Source Bar in Bulk Import

**User Story:** As a user, I want to always see and manage my PDF source file, so that I can change it at any point during bulk import.

#### Acceptance Criteria

1. WHEN no PDF file is linked THEN the SourceBar component SHALL display an "Upload PDF" button
2. WHEN a PDF file is linked THEN the SourceBar component SHALL display the filename in green with a file icon and a "Replace" button
3. WHEN a user clicks the Replace button THEN the SourceBar component SHALL reset the upload state and show the upload interface
4. WHEN a PDF upload completes THEN the BulkImportPage component SHALL continue displaying the SourceBar with the Replace option visible

### Requirement 5: Power User Copy Toolbar

**User Story:** As a power user, I want quick-action buttons to copy selected text into specific MCQ fields, so that I can rapidly create questions from source material.

#### Acceptance Criteria

1. WHEN the bulk import page displays THEN the CopyToolbar component SHALL render below the text area with buttons: To Stem, To Option A, To Option B, To Option C, To Option D, To Explanation
2. WHEN a user clicks any copy button THEN the CopyToolbar component SHALL paste the currently selected text into the corresponding MCQ form field
3. WHEN text is pasted into an MCQ field THEN the CopyToolbar component SHALL auto-focus the next logical field in the form sequence

### Requirement 6: Extended MCQ Options

**User Story:** As a user creating medical exam questions, I want to add up to 5 answer options (A-E), so that I can match standard medical exam formats.

#### Acceptance Criteria

1. WHEN the MCQ form renders THEN the CreateMCQForm component SHALL allow adding up to 5 options (A-E)
2. WHEN a user adds an option THEN the CreateMCQForm component SHALL append a new option field with the next sequential letter label
3. WHEN a user removes an option THEN the CreateMCQForm component SHALL re-label remaining options sequentially
