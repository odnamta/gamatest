# Design: V5 – Content Workstation Upgrade

## Overview

V5 introduces a professional authoring workstation that combines PDF viewing, tagging, and AI-assisted card creation into a unified interface. The architecture prioritizes separation of concerns while enabling seamless data flow between components.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Add Bulk Page Layout                              │
├─────────────────────────────────┬───────────────────────────────────────┤
│                                 │                                        │
│         PDF Viewer              │           Card Creation Form           │
│                                 │                                        │
│  ┌───────────────────────────┐  │  ┌────────────────────────────────┐   │
│  │                           │  │  │  TagSelector                   │   │
│  │      PDF Page Content     │  │  │  [Tag1] [Tag2] [+ Add]         │   │
│  │                           │  │  └────────────────────────────────┘   │
│  │   [SelectionTooltip]      │  │  ┌────────────────────────────────┐   │
│  │   ┌─────────────────┐     │  │  │  MCQ Form / Flashcard Form     │   │
│  │   │ Stem │ Expl │ AI│     │  │  │  - Stem/Front                  │   │
│  │   └─────────────────┘     │  │  │  - Options                     │   │
│  │                           │  │  │  - Explanation                 │   │
│  └───────────────────────────┘  │  └────────────────────────────────┘   │
│  ┌───────────────────────────┐  │                                        │
│  │  ◀ Prev   Page 3/42  Next ▶│  │                                        │
│  └───────────────────────────┘  │                                        │
└─────────────────────────────────┴───────────────────────────────────────┘
```

---

## Components and Interfaces

### 1. Database Schema

#### Tags Table
```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_tags_user_id ON tags(user_id);
```

#### Card Tags Join Table
```sql
CREATE TABLE card_tags (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_id, tag_id)
);

-- RLS (via card ownership)
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage card_tags for own cards" ON card_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cards
      JOIN decks ON decks.id = cards.deck_id
      WHERE cards.id = card_tags.card_id AND decks.user_id = auth.uid()
    )
  );

CREATE INDEX idx_card_tags_card_id ON card_tags(card_id);
CREATE INDEX idx_card_tags_tag_id ON card_tags(tag_id);
```

### 2. TagSelector Component

```tsx
// src/components/tags/TagSelector.tsx
interface TagSelectorProps {
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  deckId?: string // Optional: filter tags by deck context
}

// Features:
// - Multi-select dropdown with checkboxes
// - Inline "Create new tag" modal
// - Color preview badges
// - Keyboard support (Enter = create/select)
```

### 3. FilterBar Component

```tsx
// src/components/tags/FilterBar.tsx
interface FilterBarProps {
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  onClear: () => void
}

// Features:
// - Horizontal tag pills with X to remove
// - "Clear filters" button
// - Integrates with CardList filtering
```

### 4. PDFViewer Component

```tsx
// src/components/pdf/PDFViewer.tsx
interface PDFViewerProps {
  fileUrl: string
  fileId: string // For localStorage key
  onTextSelect?: (text: string, position: { x: number; y: number }) => void
}

// Features:
// - react-pdf with renderTextLayer={true}
// - Page navigation (prev/next)
// - Loading skeleton
// - Error state with retry
// - Selection event handling
```

### 5. SelectionTooltip Component

```tsx
// src/components/pdf/SelectionTooltip.tsx
interface SelectionTooltipProps {
  position: { x: number; y: number }
  selectedText: string
  onToStem: () => void
  onToExplanation: () => void
  onToAIDraft: () => void
  onClose: () => void
}

// Features:
// - Positioned near selection
// - Three action buttons
// - Click-outside to dismiss
```

---

## Data Models

### Tag Type
```typescript
interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}
```

### CardTag Type
```typescript
interface CardTag {
  card_id: string
  tag_id: string
  created_at: string
}
```

### Extended Card Type
```typescript
interface CardWithTags extends Card {
  tags: Tag[]
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tag Uniqueness Per User
*For any* user, creating a tag with a name that already exists for that user should be rejected, preserving the uniqueness constraint.
**Validates: Requirements 1.1, 1.2**

### Property 2: Tag Cascade Delete
*For any* tag that is deleted, all card_tags associations referencing that tag should also be deleted, leaving no orphaned references.
**Validates: Requirements 1.6**

### Property 3: Card Cascade Delete
*For any* card that is deleted, all card_tags associations for that card should also be deleted.
**Validates: Requirements 1.5**

### Property 4: Tag Filter Intersection
*For any* set of selected filter tags, the filtered card list should contain only cards that have ALL selected tags (AND logic).
**Validates: Requirements 1.8**

### Property 5: PDF Page Persistence Round-Trip
*For any* PDF file and page number, saving to localStorage and then restoring should return the same page number.
**Validates: Requirements 3.1, 3.2**

### Property 6: Selection Text Preservation
*For any* text selected in the PDF, clicking "To Stem" should result in the stem field containing exactly that text.
**Validates: Requirements 2.8**

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Duplicate tag name | Show toast: "Tag '{name}' already exists" |
| PDF load failure | Show error state with "Retry" button |
| Tag creation failure | Show toast with error message |
| Invalid PDF URL | Show "Cannot load PDF" message |
| localStorage unavailable | Silently default to page 1 |

---

## Testing Strategy

### Unit Tests
- Tag CRUD operations
- Filter logic (AND intersection)
- localStorage persistence helpers

### Property-Based Tests
- Tag uniqueness constraint
- Cascade delete behavior
- Filter intersection logic
- Page persistence round-trip

### Integration Tests
- PDF viewer with text selection
- Form population from selection
- Tag assignment during card creation

---

## File Structure

```
src/
├── actions/
│   └── tag-actions.ts           # NEW: Tag CRUD operations
├── components/
│   ├── pdf/
│   │   ├── PDFViewer.tsx        # NEW: PDF rendering component
│   │   └── SelectionTooltip.tsx # NEW: Text selection tooltip
│   └── tags/
│       ├── TagSelector.tsx      # NEW: Multi-select tag picker
│       ├── FilterBar.tsx        # NEW: Tag filter UI
│       └── TagBadge.tsx         # NEW: Single tag display
├── lib/
│   ├── pdf-state.ts             # NEW: localStorage helpers
│   └── tag-colors.ts            # NEW: Color presets
└── types/
    └── database.ts              # UPDATE: Add Tag, CardTag types
```

---

## Color Presets

```typescript
// src/lib/tag-colors.ts
export const TAG_COLORS = [
  { name: 'Red', value: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  { name: 'Orange', value: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { name: 'Yellow', value: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  { name: 'Green', value: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { name: 'Blue', value: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { name: 'Purple', value: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { name: 'Pink', value: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  { name: 'Gray', value: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
]
```
