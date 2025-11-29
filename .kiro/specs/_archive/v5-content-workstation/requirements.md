# Requirements: V5 – Content Workstation Upgrade

## Introduction

V5 transforms the Bulk Import page into a professional-grade authoring workstation with an integrated tagging system, split-screen PDF viewer, and seamless AI drafting workflow. This upgrade enables efficient content creation by allowing users to view source PDFs while simultaneously creating flashcards and MCQs.

## Glossary

- **Tag**: A user-defined label with a name and color that can be applied to cards for organization
- **TagSelector**: A multi-select dropdown component for assigning tags to cards
- **FilterBar**: A horizontal bar displaying active tag filters with clear functionality
- **PDFViewer**: An integrated component for viewing PDF documents with text selection
- **SelectionTooltip**: A floating UI element that appears when text is selected in the PDF
- **Split-Pane**: A layout dividing the screen into PDF viewer (left) and form (right)

## Goals

1. Enable card organization through a flexible tagging system
2. Provide integrated PDF viewing alongside card creation forms
3. Streamline content creation with text selection → form population workflow
4. Maintain mobile-friendly experience with responsive layouts

## Non-Goals

- Full-text search within PDFs
- PDF annotation or highlighting persistence
- Collaborative tagging or shared tag libraries
- Resizable split panes (deferred to V5.1)

---

## Feature Set 1: Tagging System

### US-1.1: Tag Management
As a user, I want to create and manage tags so that I can organize my cards by topic, difficulty, or custom categories.

### US-1.2: Tag Assignment
As a user, I want to assign multiple tags to cards during creation and editing so that I can categorize content flexibly.

### US-1.3: Tag Filtering
As a user, I want to filter my card list by tags so that I can focus on specific topics or categories.

### Acceptance Criteria – Feature Set 1

1. WHEN a user creates a tag, THE system SHALL store the tag with a unique name per user and a selected color.
2. WHEN a user attempts to create a duplicate tag name, THE system SHALL prevent creation and display an error message.
3. WHEN a user assigns tags to a card, THE system SHALL create associations in the card_tags table.
4. WHEN a user removes a tag from a card, THE system SHALL delete the association without affecting other cards.
5. WHEN a card is deleted, THE system SHALL cascade delete all associated tag relationships.
6. WHEN a tag is deleted, THE system SHALL cascade delete all card associations for that tag.
7. WHEN viewing the card list, THE system SHALL display tag pills below each card's preview text.
8. WHEN a user selects tags in the FilterBar, THE system SHALL show only cards matching ALL selected tags.
9. WHEN filtering is active, THE system SHALL maintain filter state during bulk selection operations.
10. WHEN a user clicks "Clear filters", THE system SHALL remove all active tag filters and show all cards.

---

## Feature Set 2: Integrated Split-Screen PDF Reader

### US-2.1: PDF Viewing
As a user, I want to view my uploaded PDF alongside the card creation form so that I can reference source material while authoring.

### US-2.2: Page Navigation
As a user, I want to navigate between PDF pages so that I can access different sections of my source material.

### US-2.3: Text Selection
As a user, I want to select text from the PDF and quickly populate form fields so that I can create cards efficiently.

### US-2.4: AI Draft Integration
As a user, I want to select text and trigger AI drafting so that I can generate card content from source material.

### Acceptance Criteria – Feature Set 2

1. WHEN viewing the add-bulk page with a linked PDF, THE system SHALL display the PDF in a left pane viewer.
2. WHEN the PDF is loading, THE system SHALL display a skeleton placeholder.
3. WHEN the PDF fails to load, THE system SHALL display an error message with retry option.
4. WHEN a user clicks "Previous" or "Next", THE system SHALL navigate to the adjacent page.
5. WHEN viewing on desktop (≥1024px), THE system SHALL display a 50/50 split layout.
6. WHEN viewing on mobile (<1024px), THE system SHALL display a vertical stack with PDF above form.
7. WHEN a user selects text in the PDF, THE system SHALL display a SelectionTooltip near the selection.
8. WHEN a user clicks "To Stem", THE system SHALL copy selected text to the stem/front field.
9. WHEN a user clicks "To Explanation", THE system SHALL copy selected text to the explanation field.
10. WHEN a user clicks "To AI Draft", THE system SHALL paste text into AI input and trigger generation.
11. WHEN the user clicks outside the selection, THE system SHALL hide the SelectionTooltip.
12. WHEN the user navigates to a different page, THE system SHALL hide the SelectionTooltip.

---

## Feature Set 3: State Persistence

### US-3.1: Page Memory
As a user, I want the PDF viewer to remember my last viewed page so that I can resume where I left off.

### Acceptance Criteria – Feature Set 3

1. WHEN a user navigates to a PDF page, THE system SHALL save the page number to localStorage.
2. WHEN a user returns to the same PDF, THE system SHALL restore the last viewed page.
3. WHEN a user switches to a different PDF, THE system SHALL reset to page 1 for the new PDF.
4. WHEN localStorage is unavailable, THE system SHALL default to page 1 without errors.

---

## Non-Functional Requirements

### NFR-1: Performance
- PDF rendering SHOULD complete within 2 seconds for pages under 5MB.
- Tag filtering SHOULD update the card list within 500ms.

### NFR-2: Accessibility
- All interactive elements SHOULD have proper focus states.
- PDF navigation controls SHOULD be keyboard accessible.
- SelectionTooltip buttons SHOULD be reachable via keyboard.

### NFR-3: Security
- All tag operations MUST enforce RLS policies (user_id = auth.uid()).
- PDF URLs MUST be validated for Supabase Storage origin.

### NFR-4: Compatibility
- PDF viewer MUST work with standard PDF files (PDF 1.4+).
- Text selection MUST work with PDFs that have embedded text layers.
