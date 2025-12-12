# Design Document: v11.7 Companion Dashboard & Tag-Filtered Global Study

## Overview

This design extends Specialize with tag-filtered global study sessions and companion-style dashboard insights. The implementation leverages existing database schema (`card_template_tags`, `tags`, `user_card_progress`) without migrations.

Key goals:
- Enable focused study sessions filtered by topic/source tags
- Surface weakest concepts proactively on the dashboard
- Maintain mobile-first UX (375px) with minimal visual clutter

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Dashboard Page                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DashboardHero                                           │   │
│  │  ├── Greeting + Stats                                    │   │
│  │  ├── StudyTagFilter (new)                               │   │
│  │  │   └── loads topic/source tags                        │   │
│  │  │   └── persists selection to localStorage             │   │
│  │  └── StartStudyingButton (enhanced)                     │   │
│  │       └── accepts tagIds prop                           │   │
│  │       └── navigates to /study/global?tags=...           │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WeakestConceptsCard (new)                              │   │
│  │  ├── consumes getDashboardInsights                      │   │
│  │  ├── shows top 3 weakest concepts                       │   │
│  │  └── "Review" CTA per concept                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Deck List / Library                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    /study/global Page                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Parse ?tags=tag1,tag2 from URL                             │
│  2. Call getGlobalDueCards(batchNumber, tagIds)                │
│  3. Render study session with filtered cards                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Server Actions                               │
├─────────────────────────────────────────────────────────────────┤
│  global-study-actions.ts                                        │
│  ├── getGlobalDueCards(batch, tagIds?) - enhanced              │
│  └── getGlobalStats() - unchanged                              │
│                                                                 │
│  analytics-actions.ts                                           │
│  └── getDashboardInsights() - new                              │
│                                                                 │
│  tag-actions.ts                                                 │
│  └── getUserTags() - unchanged (already filters by user)       │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Enhanced `getGlobalDueCards` Action

**File:** `src/actions/global-study-actions.ts`

```typescript
export interface GlobalDueCardsResult {
  success: boolean
  cards: Card[]
  totalDue: number
  hasMoreBatches: boolean
  isNewCardsFallback: boolean
  error?: string
}

// Enhanced signature
export async function getGlobalDueCards(
  batchNumber: number = 0,
  tagIds?: string[]  // NEW: optional tag filter
): Promise<GlobalDueCardsResult>
```

**Implementation approach:**
- When `tagIds` is provided and non-empty, add a subquery join to `card_template_tags`
- Use `IN` clause to match any of the provided tag IDs
- Preserve all existing constraints: `status='published'`, `suspended=false`, `next_review <= now`
- Maintain `ORDER BY next_review ASC`

### 2. New `getDashboardInsights` Action

**File:** `src/actions/analytics-actions.ts`

```typescript
export interface DashboardInsights {
  dueCount: number
  weakestConcepts: WeakestConceptResult[]  // max 3
  reviewedToday?: number  // optional, only if study_logs has today's record
}

export type DashboardInsightsResult = ActionResultV2<DashboardInsights>

export async function getDashboardInsights(): Promise<DashboardInsightsResult>
```

**Implementation approach:**
- Use `withUser` helper for authentication
- Call existing `getGlobalStats()` for `dueCount`
- Call `findWeakestConcepts()` with user's progress data, limited to 3 results
- Query `study_logs` for today's `cards_reviewed` if available

### 3. New `StudyTagFilter` Component

**File:** `src/components/tags/StudyTagFilter.tsx`

```typescript
export interface StudyTagFilterProps {
  onSelectionChange: (tagIds: string[]) => void
  initialSelection?: string[]
}

export function StudyTagFilter({ onSelectionChange, initialSelection }: StudyTagFilterProps)
```

**Features:**
- Loads tags via `getUserTags()` filtered to `category in ('topic', 'source')`
- Multi-select pill/chip UI with toggle behavior
- Persists selection to `localStorage` key `study-tag-filter`
- Wraps on mobile (375px) using `flex-wrap`

### 4. Enhanced `StartStudyingButton` Component

**File:** `src/components/study/StartStudyingButton.tsx`

```typescript
export interface StartStudyingButtonProps {
  dueCount: number
  onClick: () => void
  isLoading?: boolean
  tagIds?: string[]  // NEW: optional tag filter
}
```

**Changes:**
- Accept optional `tagIds` prop
- When clicked with `tagIds`, navigate to `/study/global?tags={tagIds.join(',')}`

### 5. New `WeakestConceptsCard` Component

**File:** `src/components/dashboard/WeakestConceptsCard.tsx`

```typescript
export interface WeakestConceptsCardProps {
  concepts: WeakestConceptResult[]
  onReviewClick: (tagId: string) => void
}

export function WeakestConceptsCard({ concepts, onReviewClick }: WeakestConceptsCardProps)
```

**Features:**
- Shows up to 3 weakest concepts
- Each row: tag name, accuracy badge (e.g., "42%" or "Needs work"), "Review" button
- Hidden when `concepts` is empty
- "Review" button triggers navigation to `/study/global?tags={tagId}`

## Data Models

### Existing Tables (No Changes)

```sql
-- card_template_tags (join table)
card_template_id UUID REFERENCES card_templates(id)
tag_id UUID REFERENCES tags(id)
PRIMARY KEY (card_template_id, tag_id)

-- tags
id UUID PRIMARY KEY
user_id UUID REFERENCES auth.users(id)
name TEXT
color TEXT
category tag_category  -- 'source' | 'topic' | 'concept'

-- user_card_progress
user_id UUID
card_template_id UUID
correct_count INTEGER
total_attempts INTEGER
next_review TIMESTAMPTZ
suspended BOOLEAN
```

### New TypeScript Types

```typescript
// src/types/actions.ts
export interface DashboardInsights {
  dueCount: number
  weakestConcepts: WeakestConceptResult[]
  reviewedToday?: number
}

// Already exists in analytics-utils.ts
export interface WeakestConceptResult {
  tagId: string
  tagName: string
  accuracy: number
  totalAttempts: number
  isLowConfidence: boolean
}
```

### localStorage Schema

```typescript
// Key: 'study-tag-filter'
// Value: JSON string of string[] (tag IDs)
interface StudyTagFilterStorage {
  selectedTagIds: string[]
  updatedAt: number  // timestamp for potential staleness check
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tag filter returns only cards with matching tags
*For any* set of tag IDs and any set of cards with tag associations, when filtering by those tag IDs, all returned cards SHALL have at least one of the requested tags in their `card_template_tags` associations.
**Validates: Requirements 1.1, 1.2, 1.5, 7.1**

### Property 2: Empty tagIds returns unfiltered results
*For any* set of due cards, when `tagIds` is empty or undefined, the returned cards SHALL match the original unfiltered global due logic (all due cards from subscribed decks).
**Validates: Requirements 1.3, 7.2**

### Property 3: Tag filtering preserves next_review ordering
*For any* filtered result set, the cards SHALL be ordered by `next_review` ascending, regardless of which tags were used for filtering.
**Validates: Requirements 1.4, 7.3**

### Property 4: URL construction includes tagIds correctly
*For any* non-empty array of tag IDs, the constructed URL SHALL contain a `tags` query parameter with all IDs joined by commas.
**Validates: Requirements 2.1, 3.5, 5.3**

### Property 5: URL parsing extracts valid tag IDs
*For any* URL with a `tags` query parameter, parsing SHALL extract all valid UUID strings and ignore malformed entries.
**Validates: Requirements 2.2, 2.4**

### Property 6: Tag filter loads only topic/source categories
*For any* user's tag collection, the StudyTagFilter SHALL only display tags where `category` is 'topic' or 'source'.
**Validates: Requirements 3.2**

### Property 7: localStorage persistence round-trip
*For any* selection of tag IDs, saving to localStorage and then loading SHALL return the same set of tag IDs.
**Validates: Requirements 3.6**

### Property 8: Dashboard insights returns correct DTO shape
*For any* user with study data, `getDashboardInsights` SHALL return a DTO with `dueCount` (number), `weakestConcepts` (array of max 3 items), and optionally `reviewedToday`.
**Validates: Requirements 4.2**

### Property 9: Low confidence threshold hides noisy tags
*For any* user with fewer than 5 total attempts across all concept tags, `weakestConcepts` SHALL be an empty array.
**Validates: Requirements 4.4, 8.2**

### Property 10: Weakest concepts ordered by accuracy ascending
*For any* non-empty `weakestConcepts` array, the concepts SHALL be ordered by accuracy ascending (lowest accuracy first).
**Validates: Requirements 8.3**

### Property 11: Accuracy formatting rounds to integer
*For any* accuracy value, the formatted display string SHALL be the value rounded to the nearest integer followed by "%".
**Validates: Requirements 5.5**

## Error Handling

| Scenario | Handling |
|----------|----------|
| User not authenticated | Return `{ ok: false, error: 'AUTH_REQUIRED' }` |
| Invalid tag IDs in URL | Ignore invalid IDs, proceed with valid ones |
| No tags match filter | Return empty cards array with `totalDue: 0` |
| localStorage unavailable | Fall back to empty selection, no persistence |
| `findWeakestConcepts` returns empty | Hide WeakestConceptsCard component |
| Network error fetching tags | Show error toast, allow retry |

## Testing Strategy

### Unit Tests
- `parseTagIdsFromUrl(searchParams)` - various URL formats
- `buildStudyUrl(tagIds)` - URL construction
- `formatAccuracyPercent(accuracy)` - rounding behavior
- `filterTagsByCategory(tags, categories)` - category filtering

### Property-Based Tests (fast-check)

**File:** `src/__tests__/global-study-v11.7.property.test.ts`

1. **Tag filter correctness** (Property 1)
   - Generate random cards with random tag associations
   - Apply filter with random subset of tags
   - Assert all returned cards have at least one matching tag

2. **Empty filter equivalence** (Property 2)
   - Generate random due cards
   - Compare results of `getGlobalDueCards(0, [])` vs `getGlobalDueCards(0)`
   - Assert identical results

3. **Ordering preservation** (Property 3)
   - Generate cards with random `next_review` dates
   - Apply tag filter
   - Assert result is sorted by `next_review` ascending

4. **URL round-trip** (Properties 4, 5)
   - Generate random valid UUIDs
   - Build URL, parse URL
   - Assert extracted IDs match original

**File:** `src/__tests__/analytics-dashboard.property.test.ts`

5. **Low confidence threshold** (Property 9)
   - Generate progress data with varying attempt counts
   - Assert empty `weakestConcepts` when total attempts < 5

6. **Weakest concepts ordering** (Property 10)
   - Generate concepts with random accuracies
   - Assert ordering is by accuracy ascending

7. **Accuracy formatting** (Property 11)
   - Generate random floats 0-100
   - Assert formatted string matches `Math.round(value) + '%'`
