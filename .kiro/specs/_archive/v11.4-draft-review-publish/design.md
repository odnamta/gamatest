# Design Document: V11.4 Draft Review & Publish

## Overview

V11.4 accelerates the QA workflow for content authors by introducing status filters, smart select-all, bulk publishing, and a high-speed "Save & Next" side panel editor. The current implementation requires authors to navigate to individual card edit pages and manually manage card status, significantly slowing down content review. This feature adds status-aware filtering, bulk operations, and an inline editor panel that enables rapid iteration through draft cards.

## Architecture

The feature follows the existing architecture patterns with new components for status filtering and side panel editing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Deck Details Page                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  StatusFilterChips                                                   │    │
│  │  [Draft (12)] [Published (45)] [All]  [Publish all draft cards]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CardList (with status badges)                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐    │    │
│  │  │ Card 1 [Draft]  [Edit] [Delete]                             │    │    │
│  │  │ Card 2 [Draft]  [Edit] [Delete]                             │    │    │
│  │  │ ...                                                          │    │    │
│  │  └─────────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  BulkActionsBar (floating)                                          │    │
│  │  [Auto-Tag] [Add Tag] [Move] [Export] [Publish Selected] [Delete]   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Opens on Edit click
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CardEditorPanel (Slide-over)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [← Previous]  Card 3 of 12  [Next →]                    [✕ Close]  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  EditCardForm (reused, narrow width optimized)                      │    │
│  │  - Stem                                                              │    │
│  │  - Options A-E                                                       │    │
│  │  - Explanation                                                       │    │
│  │  - Tags                                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Save]                                    [Save & Next →] (primary) │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Component: StatusFilterChips

A row of filter chips for filtering cards by status.

```typescript
interface StatusFilterChipsProps {
  draftCount: number
  publishedCount: number
  activeFilter: 'draft' | 'published' | 'all'
  onFilterChange: (filter: 'draft' | 'published' | 'all') => void
  onPublishAllDrafts?: () => void
  isAuthor: boolean
}
```

**Behavior:**
- Displays three chips with counts: "Draft (X)", "Published (Y)", "All"
- Active chip is visually highlighted
- Shows "Publish all draft cards" button when Draft filter is active and draftCount > 0
- Defaults to "Draft" if draftCount > 0, otherwise "All"

### New Component: CardEditorPanel

A slide-over drawer for editing cards inline.

```typescript
interface CardEditorPanelProps {
  isOpen: boolean
  onClose: () => void
  cardId: string | null
  cardIds: string[]  // Ordered list of card IDs in current filter
  currentIndex: number
  onNavigate: (direction: 'prev' | 'next') => void
  onSave: () => Promise<void>
  onSaveAndNext: () => Promise<void>
  deckId: string
}
```

**Behavior:**
- Opens as a right-side slide-over (drawer)
- Displays navigation controls at top: Previous, "Card X of Y", Next
- Contains EditCardForm content optimized for narrow width
- Action buttons at bottom: Save, Save & Next (primary)
- Keyboard shortcuts: Cmd+Enter (Save & Next), Cmd+S (Save), Escape (Close)
- Updates URL with `?editCard={cardId}` for state persistence

### New Component: PublishAllConfirmDialog

A confirmation dialog for publishing all draft cards.

```typescript
interface PublishAllConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  draftCount: number
  isPublishing: boolean
}
```

### Modified Component: CardList

Update the existing CardList component:

1. **Status Filter Integration**
   - Accept `statusFilter` prop to filter cards by status
   - Calculate and expose draft/published counts

2. **Smart Select-All**
   - Track `isAllSelected` flag for filter-based selection
   - Show prompt when totalCards > visibleCards
   - Pass filter descriptor to bulk actions when isAllSelected

3. **Edit Button Behavior**
   - Instead of navigating to /cards/[id]/edit, open CardEditorPanel
   - Pass current filter context for navigation

```typescript
// New state in CardList
const [statusFilter, setStatusFilter] = useState<'draft' | 'published' | 'all'>('draft')
const [isAllSelected, setIsAllSelected] = useState(false)
const [showEditorPanel, setShowEditorPanel] = useState(false)
const [editingCardId, setEditingCardId] = useState<string | null>(null)
const [editingCardIndex, setEditingCardIndex] = useState(0)
```

### Modified Component: CardListItem

Update to show status badge:

```typescript
interface CardListItemProps {
  // ... existing props
  status?: 'draft' | 'published' | 'archived'
}
```

**Behavior:**
- Display small status badge next to card content
- Draft: Blue badge with "Draft" text
- Published: Green badge or no badge (optional, as published is default)

### Modified Component: BulkActionsBar

Add "Publish Selected" action:

```typescript
interface BulkActionsBarProps {
  // ... existing props
  onPublish?: () => void
  showPublish?: boolean  // Show when filter includes drafts
  isPublishing?: boolean
}
```

### New Server Action: bulkPublishCards

```typescript
interface BulkPublishInput {
  // Either explicit card IDs or filter descriptor
  cardIds?: string[]
  filterDescriptor?: {
    deckId: string
    status: 'draft' | 'published' | 'all'
    tagIds?: string[]
  }
}

interface BulkPublishResult {
  ok: boolean
  count?: number
  error?: string
}

export async function bulkPublishCards(input: BulkPublishInput): Promise<BulkPublishResult>
```

**Behavior:**
- Accepts either explicit card IDs or a filter descriptor
- Only updates cards where current status='draft'
- Returns count of cards published
- Revalidates deck page after success

## Data Models

No schema changes required. The feature uses the existing `status` column on `card_templates`:

```sql
-- Existing column (added in V11.3)
ALTER TABLE card_templates ADD COLUMN status TEXT DEFAULT 'published' 
  CHECK (status IN ('draft', 'published', 'archived'));
```

The status field is already present and used for the "Show Drafts" toggle. This feature expands its usage with proper filtering and bulk operations.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status counts are accurate
*For any* list of cards with various statuses, the displayed draft count SHALL equal the number of cards with status='draft', and the published count SHALL equal the number of cards with status='published'.
**Validates: Requirements 1.1**

### Property 2: Default filter based on draft count
*For any* deck, if the draft count is greater than zero, the default active filter SHALL be 'draft'; otherwise, the default SHALL be 'all'.
**Validates: Requirements 1.2, 1.3**

### Property 3: Filter produces correct card subset
*For any* list of cards and any status filter ('draft', 'published', 'all'), the filtered result SHALL contain exactly the cards matching that filter criteria, where 'all' includes both 'draft' and 'published' but excludes 'archived'.
**Validates: Requirements 1.4, 1.5, 1.6, 1.7**

### Property 4: Smart select-all prompt appears when needed
*For any* card list where totalCards exceeds visibleCards, clicking "Select all" SHALL display the inline prompt; when totalCards equals visibleCards, no prompt SHALL appear.
**Validates: Requirements 2.2**

### Property 5: Filter descriptor passed when isAllSelected
*For any* bulk action invoked when isAllSelected is true, the action SHALL receive a filter descriptor instead of explicit card IDs.
**Validates: Requirements 2.4**

### Property 6: Selection resets on filter change
*For any* selection state (including isAllSelected=true), changing the status filter SHALL reset selectedIds to empty and isAllSelected to false.
**Validates: Requirements 2.5**

### Property 7: Bulk publish only affects draft cards
*For any* set of card IDs passed to bulk publish, only cards with current status='draft' SHALL be updated to 'published'; cards already published SHALL remain unchanged.
**Validates: Requirements 3.2, 3.3, 3.4**

### Property 8: Publish-all updates all drafts in deck
*For any* deck with N draft cards, the publish-all action SHALL update exactly N cards to status='published'.
**Validates: Requirements 4.3**

### Property 9: Panel maintains card list state
*For any* CardEditorPanel opened from a filtered card list, the panel SHALL maintain the ordered list of card IDs matching the current filter and the correct index of the card being edited.
**Validates: Requirements 5.3**

### Property 10: Navigation actions update index correctly
*For any* CardEditorPanel with a card list of length N and current index I:
- "Save" SHALL keep index at I
- "Save & Next" SHALL increment index to min(I+1, N-1) after saving
- "Previous" SHALL decrement index to max(I-1, 0) without saving
- "Next" SHALL increment index to min(I+1, N-1) without saving
**Validates: Requirements 6.3, 6.4, 6.5, 6.6**

### Property 11: URL state syncs with panel
*For any* CardEditorPanel state, the URL query parameter SHALL reflect the current card ID, and loading a URL with a card ID parameter SHALL restore the panel state.
**Validates: Requirements 8.1, 8.2**

### Property 12: Badge styling matches status
*For any* card displayed in the list, the badge color SHALL match the card's status: blue for 'draft', green (or none) for 'published'.
**Validates: Requirements 9.1, 9.2, 9.3**

### Property 13: Study queries exclude non-published cards
*For any* study query (due cards, due counts), the result SHALL contain only cards with status='published'; cards with status='draft' or 'archived' SHALL never appear.
**Validates: Requirements 10.1, 10.2, 10.3**

## Error Handling

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| Bulk publish fails | Show toast error, preserve selection state for retry |
| Save fails in panel | Show inline error, keep panel open for correction |
| Card not found during navigation | Skip to next valid card, show toast warning |
| Network error during filter change | Show toast, revert to previous filter |
| URL card ID not in current filter | Open panel on first card in filter, show info toast |

## Testing Strategy

### Property-Based Testing (fast-check)

The project uses **fast-check** for property-based testing as specified in the tech stack.

**Test file:** `src/__tests__/draft-review-publish-v11.4.property.test.ts`

Properties to implement:
1. Status counts accuracy (Property 1)
2. Default filter logic (Property 2)
3. Filter correctness (Property 3)
4. Bulk publish draft-only (Property 7)
5. Publish-all completeness (Property 8)
6. Navigation index updates (Property 10)
7. Study query exclusion (Property 13)

### Unit Tests

- StatusFilterChips renders correct counts and active state
- CardEditorPanel keyboard shortcuts trigger correct actions
- BulkActionsBar shows Publish button when appropriate
- CardListItem displays correct badge for each status

### Integration Tests

- Full flow: Filter to Draft → Select All → Publish Selected → Verify counts update
- Full flow: Open panel → Save & Next through all drafts → Verify all saved
- Full flow: Reload page with URL param → Panel reopens on correct card
