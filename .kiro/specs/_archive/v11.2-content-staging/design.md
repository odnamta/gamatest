# Design Document: V11.3 Content Staging

## Overview

V11.3 introduces a content staging workflow that adds a "Draft" layer between bulk import and live study content. This enables authors to QA imported chapters, detect missing questions, and publish cards in batches. The design is additive and backwards-compatible—existing cards default to `published` status and continue working unchanged.

Key capabilities:
- **Draft Status**: New bulk-imported cards start as drafts, invisible to study flows
- **Import Sessions**: Cards from the same bulk import share a session ID for grouped review
- **Session Review UI**: Admin-only interface for QA, editing, and publishing
- **Gap Detection**: Question number analysis to identify missing content
- **Bulk Publish/Archive**: Efficient status transitions for selected cards

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BulkImport Page                          │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐ │
│  │ PDF Viewer      │    │ Session Panel                       │ │
│  │ + Text Extract  │    │ - Draft count                       │ │
│  │                 │    │ - Detected/Missing numbers          │ │
│  │                 │    │ - "Review & Publish" button         │ │
│  └─────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Session Review Page                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Header: Book Title · Chapter · "44 Draft Cards"             ││
│  │ Metrics: "Detected 59 · Created 44 · Missing: 52-59"        ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Card Table (sortable by question_number)                    ││
│  │ ☐ | Q# | Stem (truncated) | Tags | Status | Actions        ││
│  │ ☑ | 1  | A 28-year-old... | 3    | draft  | Edit|Del|Dup   ││
│  │ ☐ | 2  | Which of the...  | 2    | draft  | Edit|Del|Dup   ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Actions: [Select All] [Publish Selected] [Archive Selected] ││
│  │          [Add Missing Card]                                 ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Import Phase**: BulkImport page generates `import_session_id`, passes to `bulkCreateMCQV2`
2. **Storage Phase**: Cards created with `status='draft'` and `import_session_id`
3. **Review Phase**: Session Review UI fetches cards by session ID, displays QA metrics
4. **Publish Phase**: Author selects cards, clicks Publish, status changes to `published`
5. **Study Phase**: Study queries filter `WHERE status = 'published'`

## Components and Interfaces

### Database Schema Changes

```sql
-- Add status enum to card_templates (non-breaking, nullable with default)
ALTER TABLE card_templates 
ADD COLUMN status TEXT DEFAULT 'published' 
CHECK (status IN ('draft', 'published', 'archived'));

-- Add import_session_id for grouping (nullable)
ALTER TABLE card_templates 
ADD COLUMN import_session_id UUID;

-- Index for efficient session queries
CREATE INDEX idx_card_templates_import_session 
ON card_templates(import_session_id) WHERE import_session_id IS NOT NULL;

-- Index for status filtering in study queries
CREATE INDEX idx_card_templates_status 
ON card_templates(status);

-- Backfill: existing cards get 'published' (already default, but explicit)
UPDATE card_templates SET status = 'published' WHERE status IS NULL;
```

### Server Actions

#### `bulkCreateMCQV2` (Modified)

```typescript
interface BulkCreateV2Input {
  deckTemplateId: string
  sessionTags?: string[]
  cards: Array<{
    stem: string
    options: string[]
    correctIndex: number
    explanation?: string
    tagNames: string[]
    questionNumber?: number
  }>
  // Existing V11 fields
  bookSourceId?: string
  chapterId?: string
  matchingGroupId?: string
  matchingBlockData?: MatchingBlockInput
  // V11.3: New field
  importSessionId?: string  // If provided, cards get this session ID and status='draft'
}
```

#### `getSessionCards` (New)

```typescript
interface SessionCardsInput {
  sessionId: string
}

interface SessionCardsResult {
  ok: boolean
  cards?: Array<{
    id: string
    stem: string
    options: string[]
    correctIndex: number
    explanation: string | null
    questionNumber: number | null
    status: 'draft' | 'published' | 'archived'
    tags: Array<{ id: string; name: string; color: string }>
    createdAt: string
    updatedAt: string
  }>
  sessionMeta?: {
    bookSourceId: string | null
    bookTitle: string | null
    chapterId: string | null
    chapterTitle: string | null
    createdAt: string
  }
  error?: { message: string; code: string }
}
```

#### `publishCards` (New)

```typescript
interface PublishCardsInput {
  cardIds: string[]
}

interface PublishCardsResult {
  ok: boolean
  publishedCount?: number
  error?: { message: string; code: string }
}
```

#### `archiveCards` (New)

```typescript
interface ArchiveCardsInput {
  cardIds: string[]
}

interface ArchiveCardsResult {
  ok: boolean
  archivedCount?: number
  error?: { message: string; code: string }
}
```

#### `duplicateCard` (New)

```typescript
interface DuplicateCardInput {
  cardId: string
}

interface DuplicateCardResult {
  ok: boolean
  newCardId?: string
  error?: { message: string; code: string }
}
```

### React Components

#### `SessionReviewPage` (New)

- Route: `/admin/sessions/[sessionId]`
- Server component that fetches session data
- Renders `SessionReviewHeader` and `SessionReviewTable`

#### `SessionReviewHeader` (New)

- Displays book title, chapter title, card counts
- Shows QA metrics (detected, created, missing)
- Contains action buttons

#### `SessionReviewTable` (New)

- Client component with selection state
- Sortable columns (question_number, stem, tags, status)
- Row actions (Edit, Delete, Duplicate)
- Bulk selection controls

#### `SessionPanel` (New)

- Embedded in BulkImport page
- Shows current session stats
- "Review & Publish" navigation button

### Utility Functions

#### `formatQAMetrics` (New)

```typescript
function formatQAMetrics(
  detectedCount: number,
  createdCount: number,
  missingNumbers: number[]
): string
// Returns: "Detected 59 questions · 44 cards created · Missing: 52, 53, 54, 55, 56, 57, 58, 59"
```

#### `generateImportSessionId` (New)

```typescript
function generateImportSessionId(): string
// Returns: UUID v4 string
```

## Data Models

### CardTemplate (Extended)

```typescript
interface CardTemplate {
  id: string
  deck_template_id: string
  stem: string
  options: string[]
  correct_index: number
  explanation: string | null
  source_meta: unknown | null
  // V11 fields
  book_source_id: string | null
  chapter_id: string | null
  question_number: number | null
  matching_group_id: string | null
  // V11.3 fields
  status: 'draft' | 'published' | 'archived'
  import_session_id: string | null
  created_at: string
  updated_at: string
}
```

### ImportSession (Lightweight - derived from cards)

```typescript
interface ImportSession {
  id: string  // The import_session_id
  bookSourceId: string | null
  bookTitle: string | null
  chapterId: string | null
  chapterTitle: string | null
  draftCount: number
  publishedCount: number
  archivedCount: number
  createdAt: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Bulk import creates cards with draft status

*For any* valid bulk import input with an `importSessionId`, all created Card_Templates SHALL have `status = 'draft'`.

**Validates: Requirements 1.1**

### Property 2: Bulk import stores session ID on all cards

*For any* valid bulk import input with an `importSessionId`, all created Card_Templates SHALL have `import_session_id` equal to the provided session ID.

**Validates: Requirements 1.2, 2.2**

### Property 3: Session ID generation is unique

*For any* two calls to `generateImportSessionId()`, the returned UUIDs SHALL be different.

**Validates: Requirements 2.1**

### Property 4: Study queries filter by published status only

*For any* card with `status` not equal to 'published' (i.e., 'draft' or 'archived'), that card SHALL NOT appear in the results of `getGlobalDueCards`, `getDueCardsForDeck`, or due count queries.

**Validates: Requirements 1.4, 3.1, 3.2, 3.3, 3.4**

### Property 5: Session fetch returns all cards with matching session ID

*For any* `import_session_id`, calling `getSessionCards(sessionId)` SHALL return exactly the set of Card_Templates where `import_session_id = sessionId`.

**Validates: Requirements 2.3, 4.1**

### Property 6: Sorting by question_number is correct

*For any* list of cards sorted by `question_number` ascending, each card's `question_number` SHALL be less than or equal to the next card's `question_number`.

**Validates: Requirements 4.4**

### Property 7: Authorization denies non-authors

*For any* user who is not the author of the deck containing the session's cards, calling `getSessionCards`, `publishCards`, or `archiveCards` SHALL return an authorization error.

**Validates: Requirements 4.5**

### Property 8: Duplicate preserves session ID and sets draft status

*For any* card duplication via `duplicateCard`, the new card SHALL have the same `import_session_id` as the original and `status = 'draft'`.

**Validates: Requirements 5.3**

### Property 9: Question number detection extracts numbers correctly

*For any* text containing question patterns (e.g., "1.", "Q1", "Question 1"), `detectQuestionNumbers(text)` SHALL return all matching numbers in sorted order.

**Validates: Requirements 6.1**

### Property 10: Missing number calculation is correct

*For any* detected numbers array and saved numbers array, `calculateMissingNumbers(detected, saved)` SHALL return exactly the numbers present in detected but not in saved.

**Validates: Requirements 6.2**

### Property 11: QA metrics format string is correct

*For any* detected count, created count, and missing numbers array, `formatQAMetrics(detected, created, missing)` SHALL return a string containing all three values in the specified format.

**Validates: Requirements 6.4**

### Property 12: Bulk status update changes all selected cards

*For any* array of card IDs passed to `publishCards` or `archiveCards`, all cards with those IDs SHALL have their status updated to the target status.

**Validates: Requirements 7.2, 8.1**

### Property 13: Publish preserves session ID

*For any* card that is published via `publishCards`, the card's `import_session_id` SHALL remain unchanged.

**Validates: Requirements 7.5**

## Error Handling

### Authorization Errors

- Non-authors attempting to access Session Review: Return 403 with redirect to dashboard
- Non-authors attempting to publish/archive: Return `{ ok: false, error: { code: 'UNAUTHORIZED' } }`

### Data Errors

- Invalid session ID: Return `{ ok: false, error: { code: 'NOT_FOUND' } }`
- Card not found for duplicate: Return `{ ok: false, error: { code: 'NOT_FOUND' } }`
- Database transaction failure: Return `{ ok: false, error: { code: 'DB_ERROR' } }`

### Validation Errors

- Empty card selection for publish/archive: Return `{ ok: false, error: { code: 'VALIDATION_ERROR' } }`

## Testing Strategy

### Property-Based Testing

The implementation will use **fast-check** for property-based testing, as specified in the project's tech stack.

Each property test will:
1. Generate random valid inputs using fast-check arbitraries
2. Execute the function under test
3. Assert the property holds for all generated inputs
4. Run a minimum of 100 iterations per property

Property tests will be tagged with comments referencing the design document:
```typescript
// **Feature: v11.3-content-staging, Property 1: Bulk import creates cards with draft status**
// **Validates: Requirements 1.1**
```

### Unit Tests

Unit tests will cover:
- Edge cases for `formatQAMetrics` (empty missing array, large numbers)
- Edge cases for `calculateMissingNumbers` (empty arrays, no overlap)
- Authorization boundary conditions
- Database constraint violations

### Test File Location

Tests will be located at `src/__tests__/content-staging.property.test.ts`
