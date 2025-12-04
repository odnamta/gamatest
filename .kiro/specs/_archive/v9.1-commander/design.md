# Design Document: V9.1 The Commander

## Overview

V9.1 introduces three key capabilities for deck authors and the platform:

1. **Bulk Tagging** - Select multiple cards and apply tags in a single operation, enabling efficient organization of large decks (500+ cards)
2. **Multi-Specialty AI** - Dynamic AI persona based on deck subject, preparing the platform for expansion beyond OBGYN
3. **Author Guardrails** - Hide edit controls from non-author subscribers to protect content integrity

## Architecture

The implementation follows the existing V2 architecture patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  DeckDetailsPage                                                 │
│  ├── BulkActionsBar (enhanced with "Add Tag" button)            │
│  ├── BulkTagModal (new component)                               │
│  └── CardList (isAuthor prop controls visibility)               │
├─────────────────────────────────────────────────────────────────┤
│                     Server Actions                               │
├─────────────────────────────────────────────────────────────────┤
│  tag-actions.ts                                                  │
│  └── bulkAddTagToCards(cardIds[], tagId) - batched inserts      │
│                                                                  │
│  ai-actions.ts / batch-mcq-actions.ts                           │
│  └── Dynamic system prompt with deck.subject                    │
├─────────────────────────────────────────────────────────────────┤
│                      Database                                    │
├─────────────────────────────────────────────────────────────────┤
│  deck_templates                                                  │
│  └── subject TEXT DEFAULT 'Obstetrics & Gynecology'             │
│                                                                  │
│  card_template_tags (existing)                                   │
│  └── Bulk inserts via batched operations                        │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Components

#### `BulkTagModal`
Location: `src/components/cards/BulkTagModal.tsx`

```typescript
interface BulkTagModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCardIds: string[]
  onSuccess: (count: number) => void
}
```

A modal dialog that:
- Displays a TagSelector for choosing a tag
- Shows the count of cards to be tagged
- Calls `bulkAddTagToCards` on confirmation
- Displays loading state during operation

### Enhanced Components

#### `BulkActionsBar` Enhancement
Location: `src/components/cards/BulkActionsBar.tsx`

Add new prop and button:
```typescript
interface BulkActionsBarProps {
  selectedCount: number
  onDelete: () => void
  onMove: () => void
  onExport: () => void
  onAddTag?: () => void  // NEW
  onClearSelection: () => void
}
```

#### `CardList` Enhancement
The existing `selectAll` function currently selects only filtered/visible cards. For bulk tagging of entire decks, we need a "Select All in Deck" option that fetches all card IDs from the database.

Add new state and handler:
```typescript
const [isSelectingAll, setIsSelectingAll] = useState(false)

const selectAllInDeck = async () => {
  setIsSelectingAll(true)
  const allIds = await getAllCardIdsInDeck(deckId)
  setSelectedIds(new Set(allIds))
  setIsSelectingAll(false)
}
```

### Server Actions

#### `bulkAddTagToCards`
Location: `src/actions/tag-actions.ts`

```typescript
interface BulkTagResult {
  ok: true
  taggedCount: number
} | {
  ok: false
  error: string
}

async function bulkAddTagToCards(
  cardIds: string[],
  tagId: string
): Promise<BulkTagResult>
```

Implementation requirements:
- Verify user is author of all cards (via deck_template.author_id)
- Batch inserts in chunks of 100 to prevent timeout
- Use `ON CONFLICT DO NOTHING` for idempotent behavior
- Return count of newly tagged cards

#### `getAllCardIdsInDeck`
Location: `src/actions/card-actions.ts`

```typescript
async function getAllCardIdsInDeck(deckId: string): Promise<string[]>
```

Fetches all card_template IDs for a deck, used by "Select All in Deck" feature.

### AI Prompt Modifications

#### Dynamic Subject in System Prompt

Current (hardcoded):
```
You are a medical board exam expert specializing in obstetrics and gynecology.
```

New (dynamic):
```typescript
function buildSystemPrompt(subject: string = 'Obstetrics & Gynecology'): string {
  return `You are a medical board exam expert specializing in ${subject}.`
}
```

The subject is passed from:
1. `DeckTemplate.subject` → `draftMCQFromText` input → AI prompt
2. `DeckTemplate.subject` → `draftBatchMCQFromText` input → AI prompt

## Data Models

### Schema Migration

```sql
-- V9.1: Add subject column to deck_templates
ALTER TABLE deck_templates 
ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'Obstetrics & Gynecology';

-- Backfill existing rows (already handled by DEFAULT)
UPDATE deck_templates 
SET subject = 'Obstetrics & Gynecology' 
WHERE subject IS NULL;
```

### TypeScript Types

```typescript
// src/types/database.ts
export interface DeckTemplate {
  id: string
  title: string
  description: string | null
  visibility: DeckVisibility
  author_id: string
  subject?: string  // NEW - defaults to 'Obstetrics & Gynecology'
  legacy_id: string | null
  created_at: string
  updated_at: string
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Select All Completeness
*For any* deck with N cards, when "Select All in Deck" is activated, the selection set should contain exactly N card IDs matching all cards in the database for that deck.
**Validates: Requirements 1.1, 1.4**

### Property 2: Selection State Consistency
*For any* sequence of toggle operations on card checkboxes, the selection set should accurately reflect the toggled state (card is in set iff it was toggled an odd number of times).
**Validates: Requirements 1.2**

### Property 3: Bulk Tag Batching
*For any* array of N card IDs where N > 100, the `bulkAddTagToCards` function should execute ceil(N/100) batched insert operations, each containing at most 100 items.
**Validates: Requirements 2.4**

### Property 4: Bulk Tag Idempotence
*For any* card and tag, calling `bulkAddTagToCards` twice with the same card ID and tag ID should result in exactly one card_template_tag row (no duplicates, no errors).
**Validates: Requirements 2.7**

### Property 5: Subject Fallback
*For any* deck template with null or empty subject, the AI prompt builder should use 'Obstetrics & Gynecology' as the subject value.
**Validates: Requirements 3.3, 5.3**

### Property 6: Dynamic Subject Interpolation
*For any* deck template with a non-empty subject, the generated AI system prompt should contain that exact subject string in the specialization clause.
**Validates: Requirements 3.4, 3.5**

### Property 7: Author Control Visibility
*For any* deck page view, edit controls (Add Card, Bulk Import, Edit, Delete) should be rendered if and only if `user.id === deck_template.author_id`.
**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

### Property 8: Bulk Tag Authorization
*For any* bulk tag operation, the server action should verify that the authenticated user is the author of all cards being tagged, rejecting the operation if any card belongs to a different author.
**Validates: Requirements 2.3, 2.6**

## Error Handling

### Bulk Tagging Errors

| Error Condition | Response | User Message |
|-----------------|----------|--------------|
| Not authenticated | 401 | "Authentication required" |
| Not author of cards | 403 | "Only the author can tag these cards" |
| Tag not found | 404 | "Tag not found" |
| Database error | 500 | "Failed to tag cards. Please try again." |
| Partial failure | Rollback | "Operation failed. No cards were tagged." |

### Subject Field Errors

| Error Condition | Response |
|-----------------|----------|
| Subject is null | Use default 'Obstetrics & Gynecology' |
| Subject is empty string | Use default 'Obstetrics & Gynecology' |
| Subject is whitespace only | Trim and use default if empty |

## Testing Strategy

### Property-Based Testing Framework
- **Library**: fast-check
- **Location**: `src/__tests__/*.property.test.ts`
- **Minimum iterations**: 100 per property

### Unit Tests
- `bulkAddTagToCards` batching logic
- Subject fallback in AI prompt builder
- `isAuthor` computation

### Property-Based Tests

Each correctness property will be implemented as a property-based test:

1. **Bulk Tag Batching** - Generate arrays of 1-1000 card IDs, verify batch count
2. **Bulk Tag Idempotence** - Apply same tag twice, verify single row
3. **Subject Fallback** - Generate null/empty/whitespace subjects, verify default
4. **Dynamic Subject** - Generate random subjects, verify prompt contains them
5. **Author Control Visibility** - Generate author/non-author scenarios, verify UI state

### Test Annotations
Each property-based test must include:
```typescript
/**
 * **Feature: v9.1-commander, Property 3: Bulk Tag Batching**
 * **Validates: Requirements 2.4**
 */
```
