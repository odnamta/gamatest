# Implementation Plan – V5 Content Workstation Upgrade

## Task Group 1: Tagging Database Schema

- [x] 1. Create database schema for tags
  - [x] 1.1 Create tags table
    - Add to schema.sql: id, user_id, name, color, created_at
    - Add UNIQUE constraint on (user_id, name)
    - Enable RLS with user_id = auth.uid() policy
    - Add index on user_id
    - _Req: 1.1, 1.2_
  - [x] 1.2 Create card_tags join table
    - Add to schema.sql: card_id, tag_id, created_at
    - Composite primary key (card_id, tag_id)
    - ON DELETE CASCADE for both foreign keys
    - RLS via card ownership check
    - Add indexes on card_id and tag_id
    - _Req: 1.3, 1.4, 1.5, 1.6_
  - [x] 1.3 Add TypeScript types
    - Add Tag interface to src/types/database.ts
    - Add CardTag interface
    - Add CardWithTags extended type
    - _Req: 1.1_

## Task Group 2: Tag Server Actions

- [x] 2. Implement tag CRUD operations
  - [x] 2.1 Create tag-actions.ts
    - createTag(name, color): Create new tag with ownership
    - getUserTags(): Fetch all tags for current user
    - updateTag(tagId, name, color): Update tag details
    - deleteTag(tagId): Delete tag (cascades to card_tags)
    - All actions include Zod validation and ownership checks
    - _Req: 1.1, 1.2, 1.6_
  - [x] 2.2 Create card-tag association actions
    - assignTagsToCard(cardId, tagIds): Set tags for a card
    - removeTagFromCard(cardId, tagId): Remove single tag
    - getCardTags(cardId): Fetch tags for a card
    - _Req: 1.3, 1.4_
  - [x] 2.3 Add property tests for tag operations
    - Test tag uniqueness constraint (Property 1)
    - Test cascade delete behavior (Property 2, 3)
    - _Req: 1.2, 1.5, 1.6_

## Task Group 3: Tag UI Components

- [x] 3. Build TagSelector component
  - [x] 3.1 Create TagSelector.tsx
    - Location: src/components/tags/TagSelector.tsx
    - Multi-select dropdown with checkboxes
    - Display selected tags as pills
    - Keyboard support (Enter to select/create)
    - _Req: 1.3_
  - [x] 3.2 Add inline "Create Tag" modal
    - Name input field
    - Color picker with presets
    - Validation for duplicate names
    - _Req: 1.1, 1.2_
  - [x] 3.3 Create TagBadge.tsx
    - Location: src/components/tags/TagBadge.tsx
    - Single tag display with color
    - Optional X button for removal
    - _Req: 1.7_

- [x] 4. Integrate TagSelector into forms
  - [x] 4.1 Add to CreateMCQForm
    - Add TagSelector below deck selector
    - Pass selected tags to card creation
    - _Req: 1.3_
  - [x] 4.2 Add to CreateCardForm (flashcard)
    - Add TagSelector below deck selector
    - Pass selected tags to card creation
    - _Req: 1.3_
  - [x] 4.3 Add to EditCardForm
    - Load existing tags on mount
    - Allow tag modification
    - _Req: 1.3, 1.4_
  - [x] 4.4 Display tags in CardListItem
    - Show tag pills below card preview
    - Use TagBadge component
    - _Req: 1.7_

## Task Group 4: Tag Filtering

- [x] 5. Implement tag filtering
  - [x] 5.1 Create FilterBar.tsx
    - Location: src/components/tags/FilterBar.tsx
    - Horizontal layout with tag pills
    - X button on each pill to remove filter
    - "Clear filters" button
    - _Req: 1.8, 1.10_
  - [x] 5.2 Add filter state to CardList
    - Add selectedFilterTags state
    - Filter cards by tag intersection (AND logic)
    - Maintain filter during bulk selection
    - _Req: 1.8, 1.9_
  - [x] 5.3 Integrate FilterBar into deck page
    - Render above card list
    - Connect to CardList filter state
    - _Req: 1.8_
  - [x] 5.4 Add property tests for filtering
    - Test AND intersection logic (Property 4)
    - _Req: 1.8_

## Task Group 5: PDF Viewer Setup

- [x] 6. Set up react-pdf
  - [x] 6.1 Install and configure react-pdf
    - npm install react-pdf
    - Configure PDF.js worker
    - Set up CORS for Supabase Storage
    - _Req: 2.1_
  - [x] 6.2 Create PDFViewer.tsx base component
    - Location: src/components/pdf/PDFViewer.tsx
    - Render single page with react-pdf
    - Enable renderTextLayer={true}
    - Add loading skeleton
    - Add error state with retry button
    - _Req: 2.1, 2.2, 2.3_
  - [x] 6.3 Add page navigation
    - Previous/Next buttons
    - Page indicator (e.g., "3 / 42")
    - Disable buttons at boundaries
    - _Req: 2.4_

## Task Group 6: Split-Pane Layout

- [x] 7. Implement split-pane layout
  - [x] 7.1 Create desktop layout
    - 50/50 split: PDF left, form right
    - Use CSS grid or flexbox
    - Min-width constraints
    - _Req: 2.5_
  - [x] 7.2 Create mobile layout
    - Vertical stack: PDF top, form bottom
    - Responsive breakpoint at 1024px
    - Scrollable sections
    - _Req: 2.6_
  - [x] 7.3 Update add-bulk page
    - Integrate PDFViewer when source is linked
    - Maintain existing form functionality
    - _Req: 2.1_

## Task Group 7: Text Selection Workflow

- [x] 8. Implement text selection
  - [x] 8.1 Add selection listener to PDFViewer
    - Listen for mouseup/selectionchange events
    - Scope to PDF container only
    - Extract selected text and position
    - _Req: 2.7_
  - [x] 8.2 Create SelectionTooltip.tsx
    - Location: src/components/pdf/SelectionTooltip.tsx
    - Position near selection
    - Three buttons: To Stem, To Explanation, To AI Draft
    - Click-outside to dismiss
    - _Req: 2.7, 2.11_
  - [x] 8.3 Implement tooltip actions
    - "To Stem": Copy text to stem/front field
    - "To Explanation": Copy text to explanation field
    - "To AI Draft": Paste to AI input + trigger generation
    - Auto-scroll to form on mobile
    - _Req: 2.8, 2.9, 2.10_
  - [x] 8.4 Handle tooltip dismissal
    - Dismiss on click outside
    - Dismiss on page navigation
    - _Req: 2.11, 2.12_
  - [x] 8.5 Add property tests for selection
    - Test text preservation (Property 6)
    - _Req: 2.8_

## Task Group 8: State Persistence

- [x] 9. Implement PDF state persistence
  - [x] 9.1 Create pdf-state.ts helpers
    - Location: src/lib/pdf-state.ts
    - savePdfPage(fileId, page): Save to localStorage
    - getPdfPage(fileId): Retrieve from localStorage
    - clearPdfPage(fileId): Clear stored page
    - _Req: 3.1, 3.2, 3.3_
  - [x] 9.2 Integrate with PDFViewer
    - Save page on navigation
    - Restore page on mount
    - Reset on new PDF
    - Handle localStorage unavailable
    - _Req: 3.1, 3.2, 3.3, 3.4_
  - [x] 9.3 Add property tests for persistence
    - Test round-trip save/restore (Property 5)
    - _Req: 3.1, 3.2_

## Task Group 9: Final QA

- [x] 10. Testing and review
  - [x] 10.1 Integration testing
    - Test tag creation and assignment flow
    - Test PDF viewer with text selection
    - Test AI Draft with selected text
    - Test filtering with bulk actions
    - _Req: All_
  - [x] 10.2 Mobile testing
    - Test vertical stack layout
    - Test selection → form scroll
    - Test touch interactions
    - _Req: 2.6_
  - [x] 10.3 Performance testing
    - Test with large PDFs (50+ pages)
    - Test with many tags (20+)
    - Verify no memory leaks
    - _Req: NFR-1_
  - [x] 10.4 Final review
    - Run npm run build
    - Run all tests
    - Verify no console errors
    - _Req: All_
