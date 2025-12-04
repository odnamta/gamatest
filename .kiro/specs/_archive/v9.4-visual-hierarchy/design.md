# Design Document

## Overview

V9.4 "Visual Hierarchy & Admin Access" introduces two focused improvements:

1. **Tag Sorting Utility**: A pure function `sortTagsByCategory()` that enforces consistent visual ordering (Source → Topic → Concept) across all tag displays without modifying database records.

2. **Admin Navigation**: A permission-gated "Manage Tags" link in the deck details page for authors to access the existing `/admin/tags` Tag Manager.

## Architecture

### Component Hierarchy

```
src/
├── lib/
│   └── tag-sort.ts              # NEW: sortTagsByCategory utility
├── components/
│   ├── cards/
│   │   └── CardListItem.tsx     # MODIFY: Use sortTagsByCategory before rendering
│   └── decks/
│       └── ManageTagsButton.tsx # NEW: Permission-gated admin link
└── app/(app)/decks/[deckId]/
    └── page.tsx                 # MODIFY: Add ManageTagsButton for authors
```

### Data Flow

```
Tags from DB → sortTagsByCategory() → Sorted Tags → TagBadge rendering
                    ↓
            (client-side only, no DB mutation)
```

## Components and Interfaces

### 1. Tag Sort Utility (`src/lib/tag-sort.ts`)

```typescript
import type { Tag, TagCategory } from '@/types/database'

/**
 * Category priority for visual sorting
 * Lower number = higher priority (appears first)
 */
const CATEGORY_PRIORITY: Record<TagCategory, number> = {
  source: 1,
  topic: 2,
  concept: 3,
}

/**
 * Default priority for tags without a category
 * Appears after all categorized tags
 */
const UNCATEGORIZED_PRIORITY = 99

/**
 * Sorts tags by category priority (Source → Topic → Concept)
 * Within same category, sorts alphabetically by name
 * 
 * @param tags - Array of tags to sort
 * @returns New sorted array (does not mutate input)
 */
export function sortTagsByCategory(tags: Tag[]): Tag[] {
  if (tags.length === 0) return []
  
  return [...tags].sort((a, b) => {
    const priorityA = a.category ? CATEGORY_PRIORITY[a.category] : UNCATEGORIZED_PRIORITY
    const priorityB = b.category ? CATEGORY_PRIORITY[b.category] : UNCATEGORIZED_PRIORITY
    
    // Sort by category priority first
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // Within same category, sort alphabetically
    return a.name.localeCompare(b.name)
  })
}
```

### 2. ManageTagsButton Component (`src/components/decks/ManageTagsButton.tsx`)

```typescript
'use client'

import Link from 'next/link'
import { Tags } from 'lucide-react'

interface ManageTagsButtonProps {
  isAuthor: boolean
}

/**
 * Permission-gated link to Tag Manager
 * Only renders for deck authors
 * V9.4: Requirements 4.1-4.5, 5.1-5.2
 */
export function ManageTagsButton({ isAuthor }: ManageTagsButtonProps) {
  if (!isAuthor) return null
  
  return (
    <Link
      href="/admin/tags"
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
    >
      <Tags className="w-4 h-4" />
      Manage Tags
    </Link>
  )
}
```

### 3. CardListItem Modification

Update `CardListItem.tsx` to sort tags before rendering:

```typescript
import { sortTagsByCategory } from '@/lib/tag-sort'

// In the component:
const sortedTags = sortTagsByCategory(tags)

// Render sortedTags instead of tags
{sortedTags.map((tag) => (
  <TagBadge key={tag.id} tag={tag} size="sm" />
))}
```

### 4. Card Type Badge Distinction

The existing card type badge already uses a different style (no `rounded-full`, uses `rounded`), but we should ensure visual distinction:

```typescript
// Card type badge - uses rounded rectangle (distinct from pill-shaped tags)
<span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
  isMCQ 
    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
}`}>
  {typeLabel}
</span>
```

Key differences from TagBadge:
- `rounded` (rectangle) vs `rounded-full` (pill)
- Added `border` for extra distinction
- Lighter background (`bg-*-50` vs `bg-*-100`)

## Data Models

No database changes required. This feature operates entirely on the client-side view layer.

### Existing Types Used

```typescript
// From src/types/database.ts
export type TagCategory = 'source' | 'topic' | 'concept';

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  category: TagCategory;
  created_at: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Category Priority Ordering
*For any* array of tags with different categories, after sorting, all Source tags SHALL appear before all Topic tags, and all Topic tags SHALL appear before all Concept tags.
**Validates: Requirements 1.1, 2.1, 2.2**

### Property 2: Alphabetical Within Category
*For any* array of tags where multiple tags share the same category, after sorting, those tags SHALL be ordered alphabetically by name within their category group.
**Validates: Requirements 1.3, 2.4**

### Property 3: Immutability
*For any* input array of tags, calling `sortTagsByCategory` SHALL return a new array without modifying the original input array.
**Validates: Requirements 1.4**

### Property 4: Category Determines Color
*For any* tag with a category, the TagBadge color SHALL match the category's enforced color: Source→blue, Topic→purple, Concept→green.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 5: Permission-Gated Visibility
*For any* user viewing a deck, the "Manage Tags" button SHALL be visible if and only if the user is the deck author.
**Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Empty tags array | Return empty array (no error) |
| Tag without category | Treat as lowest priority (appears last) |
| Non-author viewing deck | ManageTagsButton returns null (no render) |

## Testing Strategy

### Property-Based Testing (fast-check)

The following properties will be tested using fast-check:

1. **Property 1 (Category Priority)**: Generate random arrays of tags with mixed categories, verify output ordering.
2. **Property 2 (Alphabetical)**: Generate tags with same category, verify alphabetical order.
3. **Property 3 (Immutability)**: Verify original array unchanged after sort.
4. **Property 4 (Color Mapping)**: Already covered by existing `tag-category.property.test.ts`.
5. **Property 5 (Permission)**: Generate random isAuthor boolean, verify render behavior.

### Unit Tests

- `sortTagsByCategory` with empty array returns `[]`
- `sortTagsByCategory` with single tag returns single-element array
- `sortTagsByCategory` with uncategorized tags places them last
- `ManageTagsButton` renders link when `isAuthor=true`
- `ManageTagsButton` renders nothing when `isAuthor=false`

### Test File Location

`src/__tests__/visual-hierarchy.property.test.ts`
