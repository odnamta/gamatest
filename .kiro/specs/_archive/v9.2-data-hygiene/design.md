# Design Document: V9.2 Data Hygiene & Retro-Tagging

## Overview

V9.2 provides a comprehensive toolkit for cleaning up legacy card data and ensuring consistent tagging across the entire database. The feature set includes:

1. **Untagged Filter** - Client-side filtering to identify cards without tags
2. **AI Retro-Tagger** - Batch AI classification with OpenAI to auto-tag legacy cards
3. **Tag Merger** - Admin utility to consolidate duplicate/variant tags

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
├─────────────────────────────────────────────────────────────────┤
│  FilterBar                                                       │
│  └── UntaggedToggle (new)                                       │
│                                                                  │
│  BulkActionsBar                                                  │
│  └── AutoTagButton (new)                                        │
│                                                                  │
│  /admin/tags                                                     │
│  ├── TagMergeModal (new)                                        │
│  └── TagSelectionList (enhanced)                                │
├─────────────────────────────────────────────────────────────────┤
│                     Server Actions                               │
├─────────────────────────────────────────────────────────────────┤
│  tag-actions.ts                                                  │
│  ├── autoTagCards(cardIds[]) - AI classification                │
│  └── mergeTags(sourceIds[], targetId) - Tag consolidation       │
│                                                                  │
│  lib/golden-list.ts                                              │
│  └── GOLDEN_TOPIC_TAGS - Approved topic tag list                │
├─────────────────────────────────────────────────────────────────┤
│                      Database                                    │
├─────────────────────────────────────────────────────────────────┤
│  card_template_tags                                              │
│  └── Upsert operations for auto-tagging                         │
│  └── Update + Delete for tag merging                            │
│                                                                  │
│  tags                                                            │
│  └── Delete source tags after merge                             │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### New Components

#### `UntaggedToggle`
Location: Integrated into `src/components/tags/FilterBar.tsx`

```typescript
interface FilterBarProps {
  // ... existing props
  showUntaggedOnly: boolean
  onShowUntaggedOnlyChange: (value: boolean) => void
}
```

A toggle switch that:
- Displays "Show Untagged Only" label
- Filters card list client-side when activated
- Updates card count indicator

#### `AutoTagButton`
Location: Integrated into `src/components/cards/BulkActionsBar.tsx`

```typescript
interface BulkActionsBarProps {
  // ... existing props
  onAutoTag?: () => void
  isAutoTagging?: boolean
}
```

A button that:
- Displays "✨ Auto-Tag Selected" with sparkle icon
- Shows loading state during processing
- Disabled when no cards selected or already processing

#### `TagMergeModal`
Location: `src/components/tags/TagMergeModal.tsx`

```typescript
interface TagMergeModalProps {
  isOpen: boolean
  onClose: () => void
  sourceTags: Tag[]
  onMerge: (targetTagId: string) => Promise<void>
}
```

A modal dialog that:
- Displays source tags being merged
- Provides dropdown to select target tag
- Shows confirmation with affected card count
- Handles loading and error states

### Server Actions

#### `autoTagCards`
Location: `src/actions/tag-actions.ts`

```typescript
interface AutoTagResult {
  ok: true
  taggedCount: number
  skippedCount: number
} | {
  ok: false
  error: string
}

async function autoTagCards(cardIds: string[]): Promise<AutoTagResult>
```

Implementation requirements:
- Batch cards into groups of 20 max
- Fetch card stem/content for each batch
- Send to OpenAI with Golden List prompt
- Parse response and validate tags
- Upsert tags with ON CONFLICT DO NOTHING
- Return counts of tagged and skipped cards

#### `mergeTags`
Location: `src/actions/tag-actions.ts`

```typescript
interface MergeTagsResult {
  ok: true
  affectedCards: number
  deletedTags: number
} | {
  ok: false
  error: string
}

async function mergeTags(
  sourceTagIds: string[],
  targetTagId: string
): Promise<MergeTagsResult>
```

Implementation requirements:
- Verify user is admin
- Begin transaction
- Update card_template_tags: source → target
- Handle duplicates: delete source link if target exists
- Delete source tags from tags table
- Commit or rollback on error

### Golden List Configuration

Location: `src/lib/golden-list.ts`

```typescript
export const GOLDEN_TOPIC_TAGS = [
  'Anatomy',
  'Physiology', 
  'Pharmacology',
  'Pathology',
  'Obstetrics',
  'Gynecology',
  'Embryology',
  'Genetics',
  'Immunology',
  'Microbiology',
  'Biochemistry',
  'Epidemiology',
  'Biostatistics',
  'Ethics',
] as const

export type GoldenTopicTag = typeof GOLDEN_TOPIC_TAGS[number]
```

## Data Models

### Filter State

```typescript
interface CardFilterState {
  showUntaggedOnly: boolean
  // ... existing filter state
}
```

### Auto-Tag AI Response Schema

```typescript
const autoTagResponseSchema = z.object({
  classifications: z.array(z.object({
    cardId: z.string().uuid(),
    topic: z.enum(GOLDEN_TOPIC_TAGS),
    concepts: z.array(z.string()).min(1).max(2),
  }))
})
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Untagged Filter Correctness
*For any* list of cards with varying tag counts, when the "Show Untagged Only" filter is active, the filtered result should contain only cards where `tags.length === 0`, and when inactive, should contain all cards.
**Validates: Requirements 1.2, 1.3**

### Property 2: Filter Count Consistency
*For any* filtered card list, the displayed count indicator should equal the length of the filtered array.
**Validates: Requirements 1.4**

### Property 3: Auto-Tag Batch Size Limit
*For any* array of N card IDs where N > 20, the `autoTagCards` function should process cards in batches of at most 20 items each, resulting in ceil(N/20) batch operations.
**Validates: Requirements 2.3**

### Property 4: Auto-Tag Idempotence
*For any* card and tag combination, calling `autoTagCards` multiple times with the same card should result in exactly one card_template_tag row per tag (no duplicates, no errors).
**Validates: Requirements 2.6**

### Property 5: Golden List Validation
*For any* auto-tag response, all Topic tags must be members of the GOLDEN_TOPIC_TAGS list.
**Validates: Requirements 4.1, 4.2**

### Property 6: Merge Button Visibility
*For any* tag selection state, the "Merge Selected" button should be enabled if and only if the selection count is >= 2.
**Validates: Requirements 3.2**

### Property 7: Merge Tag Consolidation
*For any* set of cards with source tags, after a merge operation completes, all affected cards should have the target tag and none should have any source tags.
**Validates: Requirements 3.4, 3.6**

### Property 8: Merge Duplicate Handling
*For any* card that has both a source tag and the target tag before merge, after merge the card should have exactly one instance of the target tag (no duplicates).
**Validates: Requirements 3.5**

## Error Handling

### Auto-Tag Errors

| Error Condition | Response | User Message |
|-----------------|----------|--------------|
| Not authenticated | 401 | "Authentication required" |
| Not author of cards | 403 | "Only the author can auto-tag these cards" |
| OpenAI API error | 500 | "AI classification failed. Please try again." |
| Invalid AI response | 500 | "Could not parse AI response. Please try again." |
| Batch timeout | 500 | "Request timed out. Try selecting fewer cards." |

### Tag Merge Errors

| Error Condition | Response | User Message |
|-----------------|----------|--------------|
| Not admin | 403 | "Admin access required" |
| Target tag not found | 404 | "Target tag not found" |
| Source equals target | 400 | "Cannot merge a tag into itself" |
| Database error | 500 | "Merge failed. No changes were made." |

## Testing Strategy

### Property-Based Testing Framework
- **Library**: fast-check
- **Location**: `src/__tests__/*.property.test.ts`
- **Minimum iterations**: 100 per property

### Unit Tests
- Filter toggle state management
- Batch size calculation
- Golden List membership validation
- Merge duplicate detection

### Property-Based Tests

Each correctness property will be implemented as a property-based test:

1. **Untagged Filter** - Generate cards with random tag counts, verify filter
2. **Batch Size** - Generate arrays of 1-100 card IDs, verify batch count
3. **Auto-Tag Idempotence** - Apply same tags twice, verify single row
4. **Golden List** - Generate random topics, verify validation
5. **Merge Consolidation** - Generate card-tag relationships, verify merge result
6. **Merge Duplicates** - Generate cards with overlapping tags, verify no duplicates

### Test Annotations
Each property-based test must include:
```typescript
/**
 * **Feature: v9.2-data-hygiene, Property N: Property Name**
 * **Validates: Requirements X.Y**
 */
```
