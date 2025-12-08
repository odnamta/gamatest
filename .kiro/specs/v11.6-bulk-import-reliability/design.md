# Design Document: V11.6 Bulk Import Reliability (Hyperflow)

## Overview

V11.6 enhances the bulk MCQ import workflow with a dedicated Drafts Workspace, improved atomicity guarantees, duplicate protection, and clearer autoscan semantics. The design leverages existing schema (no changes) and patterns (withUser, ActionResultV2, content-staging-metrics).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Deck Detail Page                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    DeckDraftsPanel                          ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ Draft List  │  │ Bulk Select │  │ Publish/Archive     │ ││
│  │  │ (Table/Card)│  │ Checkboxes  │  │ Actions             │ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Server Actions                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ getDeckDrafts    │  │ bulkPublishDrafts│  │ bulkArchive    ││
│  │ (batch-mcq)      │  │ (batch-mcq)      │  │ Drafts         ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              bulkCreateMCQV2 (enhanced)                   │  │
│  │  - Duplicate detection via normalized stem               │  │
│  │  - Atomic writes (best-effort with Supabase)             │  │
│  │  - Skip count reporting                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase (Existing Schema)                  │
│  card_templates: id, deck_template_id, stem, status,            │
│                  import_session_id, question_number, ...        │
│  card_template_tags: card_template_id, tag_id                   │
│  user_card_progress: user_id, card_template_id, ...             │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Server Actions (src/actions/batch-mcq-actions.ts)

#### getDeckDrafts

```typescript
interface DraftCardSummary {
  id: string
  questionNumber: number | null
  stem: string
  tags: Array<{ id: string; name: string; color: string; category: string }>
  importSessionId: string | null
  createdAt: string
}

interface GetDeckDraftsResult {
  ok: true
  data: {
    deckId: string
    deckTitle: string
    drafts: DraftCardSummary[]
  }
} | { ok: false; error: string }

async function getDeckDrafts(deckId: string): Promise<GetDeckDraftsResult>
```

#### bulkPublishDrafts / bulkArchiveDrafts

```typescript
interface BulkStatusResult {
  ok: true
  data: { updatedCount: number }
} | { ok: false; error: string }

async function bulkPublishDrafts(cardIds: string[]): Promise<BulkStatusResult>
async function bulkArchiveDrafts(cardIds: string[]): Promise<BulkStatusResult>
```

#### Enhanced bulkCreateMCQV2

```typescript
interface BulkCreateResult {
  ok: true
  createdCount: number
  skippedCount: number  // NEW: duplicates skipped
  deckId: string
} | { ok: false; error: { message: string; code: string } }
```

### UI Components

#### DeckDraftsPanel (src/components/decks/DeckDraftsPanel.tsx)

Props:
- `deckId: string`
- `isAuthor: boolean`
- `onRefresh?: () => void`

Features:
- Fetches drafts via getDeckDrafts on mount
- Displays table on desktop, stacked cards on mobile (375px breakpoint)
- Bulk selection with checkboxes
- "Publish Selected" and "Archive Selected" buttons with confirmation dialogs

### Helpers (src/lib/content-staging-metrics.ts)

#### normalizeStem (NEW)

```typescript
function normalizeStem(stem: string): string
// Lowercase, trim, collapse whitespace (conservative with punctuation)
// Used for duplicate detection within same deck + import_session
```

#### calculateMissingNumbers (existing, ensure consistency)

```typescript
function calculateMissingNumbers(
  detectedNumbers: number[],
  createdNumbers: number[]
): number[]
```

## Data Models

### Existing Tables Used (NO CHANGES)

**card_templates**
- `id` UUID PK
- `deck_template_id` UUID FK
- `stem` TEXT
- `status` TEXT ('draft' | 'published' | 'archived')
- `import_session_id` UUID (nullable)
- `question_number` INTEGER (nullable)
- `created_at` TIMESTAMPTZ

**card_template_tags**
- `card_template_id` UUID FK
- `tag_id` UUID FK

**tags**
- `id` UUID PK
- `name` TEXT
- `color` TEXT
- `category` TEXT

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Draft Filtering - Status and Deck Match

*For any* deck and set of card_templates with various statuses, when getDeckDrafts is called, the result SHALL contain only cards where status='draft' AND deck_template_id matches the requested deck.

**Validates: Requirements 1.1**

### Property 2: Draft Ordering - Question Number then Created At

*For any* set of draft cards with various question_numbers and created_at timestamps, when getDeckDrafts returns them, they SHALL be ordered by question_number ascending (nulls last), then by created_at ascending.

**Validates: Requirements 1.4**

### Property 3: Bulk Publish Transitions All Selected

*For any* set of draft card IDs, when bulkPublishDrafts is called, all cards with those IDs SHALL have status='published' after completion, and no other cards SHALL be modified.

**Validates: Requirements 3.1**

### Property 4: Bulk Archive Transitions All Selected

*For any* set of draft card IDs, when bulkArchiveDrafts is called, all cards with those IDs SHALL have status='archived' after completion, and no other cards SHALL be modified.

**Validates: Requirements 3.2**

### Property 5: Bulk Action Atomicity on Failure

*For any* bulk status transition that fails partway through, no cards SHALL have their status modified (all-or-nothing semantics).

**Validates: Requirements 3.5, 4.1, 4.2**

### Property 6: Duplicate Detection via Deck + Session + Normalized Stem

*For any* import where a card with the same deck_template_id, import_session_id, and normalized stem already exists, bulkCreateMCQV2 SHALL skip that card and increment skippedCount, without failing the batch. Duplicates are scoped to the same import session to avoid over-aggressive de-duplication across unrelated imports.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.2, 8.3, 8.4**

### Property 7: Missing Numbers Calculation Consistency

*For any* arrays of detected and created question numbers, calculateMissingNumbers SHALL return the set difference (detected - created) sorted ascending, and this result SHALL be consistent across multiple calls with the same inputs.

**Validates: Requirements 5.1, 5.2**

### Property 8: Complete Status When No Missing

*For any* QAMetrics where missingNumbers is empty and detectedCount equals createdCount and detectedCount > 0, formatQAMetrics SHALL include "Complete ✓" in the output.

**Validates: Requirements 5.4**

## Error Handling

### Authentication Errors
- All server actions use `withUser` helper
- Return `{ ok: false, error: 'AUTH_REQUIRED' }` for unauthenticated requests

### Authorization Errors
- getDeckDrafts verifies user is deck author
- Bulk actions verify user owns all specified cards
- Return `{ ok: false, error: 'UNAUTHORIZED' }` for non-authors

### Database Errors
- Wrap Supabase operations in try/catch
- Return `{ ok: false, error: 'DB_ERROR' }` with descriptive message
- Log errors server-side for debugging

### Extraction/AI Errors
- Surface clear error messages to UI
- Include page numbers or chunk identifiers when available
- Suggest re-running specific chunks on partial failure

## Testing Strategy

### Property-Based Testing (fast-check)

**Library:** fast-check (already in project)

**Test Files:**
- `src/__tests__/bulk-drafts-flow.property.test.ts` - Draft fetching, ordering, bulk transitions
- `src/__tests__/content-staging.property.test.ts` - Duplicate detection, missing numbers

**Configuration:**
- Minimum 100 iterations per property
- Each test tagged with property number and requirements reference

### Unit Tests

- getDeckDrafts returns correct shape
- bulkPublishDrafts/bulkArchiveDrafts handle empty arrays
- normalizeStem handles edge cases (empty, whitespace, special chars)
- Error states return correct error codes

### Integration Considerations

- Tests use mock Supabase client or test database
- Verify RLS policies don't interfere with test assertions
- Test both success and failure paths

