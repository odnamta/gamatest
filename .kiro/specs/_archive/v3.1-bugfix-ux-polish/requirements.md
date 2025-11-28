# Requirements Document

## Introduction

This specification covers V3.1 Bugfix & UX Polish improvements for the Cellines OB/GYN Prep flashcard application. The release focuses on six key areas: fixing the study activity heatmap display, hiding incomplete course features, decluttering the decks UI, improving the bulk import PDF workflow, adding power-user copy tools for MCQ creation, and making the MCQ form more flexible with dynamic options.

## Glossary

- **Heatmap**: A visual grid displaying study activity over time, where each cell represents a day and color intensity indicates activity level
- **Ghost Feature**: A UI element for functionality that is incomplete or not ready for user interaction
- **Bulk Import**: The workflow for uploading PDFs and creating multiple flashcards/MCQs from extracted content
- **Source Bar**: A compact UI element showing the currently linked PDF file with options to change it
- **MCQ**: Multiple Choice Question - a card type with a stem (question), multiple options, and an explanation
- **Dynamic Field Array**: A form pattern allowing users to add or remove input fields as needed
- **Text Selection Toolbar**: A set of buttons that appear when text is selected, allowing quick actions on the selection

## Requirements

### Requirement 1: Study Activity Heatmap Responsive Display

**User Story:** As a user, I want the study heatmap to display properly on all screen sizes, so that I can view my study activity without horizontal scrolling.

#### Acceptance Criteria

1. WHEN the viewport width is below the large breakpoint THEN the Heatmap component SHALL display the last 28 days of study activity
2. WHEN the viewport width is at or above the large breakpoint THEN the Heatmap component SHALL display the last 60 days of study activity
3. WHEN the Heatmap renders THEN the Heatmap component SHALL use a responsive grid layout that fits within the container width without horizontal scrolling
4. WHEN the Heatmap displays study days THEN the Heatmap component SHALL order days from oldest to newest with the most recent day at the bottom-right position

### Requirement 2: Hide Incomplete Course Features

**User Story:** As a user, I want to only see features that are ready to use, so that I am not confused by incomplete functionality.

#### Acceptance Criteria

1. WHEN the courses array is empty THEN the LibrarySection component SHALL hide the entire Courses subsection
2. WHEN the courses array is empty THEN the LibrarySection component SHALL hide the Create Course form

### Requirement 3: Simplified Deck Creation UI

**User Story:** As a user, I want a clean deck creation interface, so that I can create decks without visual clutter or overlapping elements.

#### Acceptance Criteria

1. WHEN the deck list page renders THEN the Dashboard component SHALL display only the inline deck creation form without a floating add button
2. WHEN the inline deck form renders THEN the Form component SHALL display an input with placeholder text "Enter new deck title..." and a button labeled "Create Deck"
3. WHEN the inline deck form renders THEN the Form component SHALL omit the "Create new deck" label

### Requirement 4: Persistent PDF Upload in Bulk Import

**User Story:** As a user, I want to always have access to upload or change my PDF source, so that I can modify my source material at any point during bulk import.

#### Acceptance Criteria

1. WHEN a source PDF is linked THEN the BulkImportPage component SHALL display a compact Source Bar showing a file icon, the filename in green, and a "Change/Replace PDF" button
2. WHEN no source PDF is linked THEN the BulkImportPage component SHALL display the large PDF upload dropzone
3. WHEN a PDF upload completes successfully THEN the BulkImportPage component SHALL continue displaying the Source Bar with the upload option visible

### Requirement 5: Power User Text Selection Tools

**User Story:** As a power user, I want quick-action buttons to copy selected text into specific MCQ fields, so that I can rapidly create questions from source material.

#### Acceptance Criteria

1. WHEN the bulk import textarea is displayed THEN the TextSelectionToolbar component SHALL render a row of buttons: "To Stem", "To Option A", "To Option B", "To Option C", and "To Explanation"
2. WHEN a user clicks any copy-to-field button THEN the TextSelectionToolbar component SHALL paste the currently highlighted text into the corresponding MCQ form field
3. WHEN text is pasted into an MCQ field THEN the TextSelectionToolbar component SHALL auto-focus the next logical field in the form sequence

### Requirement 6: Flexible MCQ Form with Dynamic Options

**User Story:** As a user creating medical exam questions, I want to add more than four answer options, so that I can create questions matching various exam formats (A-E options).

#### Acceptance Criteria

1. WHEN the MCQ form renders THEN the CreateMCQForm component SHALL display options as a dynamic field array allowing addition of new options
2. WHEN a user adds an option THEN the CreateMCQForm component SHALL append a new option field with the next sequential letter label (A, B, C, D, E, etc.)
3. WHEN a user clicks the remove button on an option THEN the CreateMCQForm component SHALL remove that option and re-label remaining options sequentially
4. WHEN the MCQ form is used THEN the CreateMCQForm component SHALL function identically on both the Deck page and Bulk Import page
