# Design Document: V9.6 Tag Consolidator

## Overview

The Tag Consolidator adds AI-powered analysis to identify and suggest tag merges for typos, synonyms, and casing inconsistencies. It integrates with the existing Tag Manager UI via a new "Smart Cleanup" tab and leverages the existing `mergeMultipleTags` server action for execution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Admin UI Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  TagManager.tsx                                                 │
│  ├── Existing tabs (Sources, Topics, Concepts)                  │
│  └── NEW: SmartCleanupTab.tsx                                   │
│       ├── "Analyze Tags" button                                 │
│       ├── MergeGroupList (proposed merges with checkboxes)      │
│       └── "Approve Selected" button                             │
├─────────────────────────────────────────────────────────────────┤
│                      Server Actions                             │
├─────────────────────────────────────────────────────────────────┤
│  admin-tag-actions.ts                                           │
│  ├── analyzeTagConsolidation() - NEW                            │
│  │   ├── Fetch all tags (name only)                             │
│  │   ├── Batch if >= 200 tags (100 per batch)                   │
│  │   ├── Call OpenAI for analysis                               │
│  │   └── Return structured merge suggestions                    │
│  └── mergeMultipleTags() - EXISTING (reused)                    │
├─────────────────────────────────────────────────────────────────┤
│                      External Services                          │
├─────────────────────────────────────────────────────────────────┤
│  OpenAI API (gpt-4o-mini for cost efficiency)                   │
│  └── Prompt: Identify synonyms, typos, casing issues            │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Server Action: `analyzeTagConsolidation`

Location: `src/actions/admin-tag-actions.ts`

```typescript
interface MergeSuggestion {
  masterTagId: string
  masterTagName: string
  variations: Array<{
    tagId: string
    tagName: string
  }>
}

interface AnalyzeTagConsolidationResult {
  ok: true
  suggestions: MergeSuggestion[]
}

type AnalyzeResult = AnalyzeTagConsolidationResult | { ok: false; error: string }

async function analyzeTagConsolidation(): Promise<AnalyzeResult>
```

### UI Component: `SmartCleanupTab`

Location: `src/components/tags/SmartCleanupTab.tsx`

```typescript
interface SmartCleanupTabProps {
  onMergeComplete: () => void  // Callback to refresh tag list
}

function SmartCleanupTab({ onMergeComplete }: SmartCleanupTabProps): JSX.Element
```

### Batching Utility

Location: `src/lib/tag-consolidation.ts`

```typescript
/**
 * Batch tags for API processing.
 * Single batch if < 200 tags, otherwise chunks of 100.
 */
function batchTagsForAnalysis(tags: string[]): string[][]

/**
 * Parse AI response into structured suggestions.
 */
function parseConsolidationResponse(
  response: string,
  existingTags: Map<string, string>  // lowercase name -> id
): MergeSuggestion[]
```

## Data Models

### AI Response Schema

The OpenAI prompt requests JSON in this format:

```typescript
interface AIConsolidationResponse {
  groups: Array<{
    master: string      // Canonical tag name
    variations: string[] // Typos/synonyms to merge
  }>
}
```

### Resolved Merge Suggestion

After mapping AI suggestions to database entities:

```typescript
interface MergeSuggestion {
  masterTagId: string
  masterTagName: string
  variations: Array<{
    tagId: string
    tagName: string
  }>
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Batching produces correct chunk counts

*For any* list of tag names, the batching function SHALL produce exactly 1 batch if the list has fewer than 200 items, otherwise it SHALL produce ceil(length / 100) batches, and each batch SHALL contain at most 100 items.

**Validates: Requirements 1.2, 1.3**

### Property 2: AI response parsing produces valid structures

*For any* valid JSON response from the AI containing merge groups, parsing SHALL produce an array where each element has a non-empty masterTagName and a variations array (possibly empty after filtering).

**Validates: Requirements 1.4, 2.1**

### Property 3: Tag name resolution is case-insensitive and prefers existing IDs

*For any* suggested master tag name and existing tag database, if a tag exists with a case-insensitive match, the resolved masterTagId SHALL be the existing tag's ID, and the masterTagName SHALL be the existing tag's actual name.

**Validates: Requirements 1.5, 2.2**

### Property 4: Non-existent variations are filtered out

*For any* merge suggestion containing variation names, only variations that exist in the database (case-insensitive match) SHALL appear in the resolved MergeSuggestion.variations array.

**Validates: Requirements 2.3**

### Property 5: Merge group rendering includes all components

*For any* non-empty array of MergeSuggestion objects, the rendered UI SHALL display each group with the master tag name visible and all variation tag names listed.

**Validates: Requirements 3.3, 3.4**

### Property 6: Selection enables approval button

*For any* UI state where one or more merge groups are selected, the "Approve Selected" button SHALL be enabled. When zero groups are selected, the button SHALL be disabled.

**Validates: Requirements 4.1**

### Property 7: Batch merge calls mergeMultipleTags correctly

*For any* selected merge group, executing approval SHALL call `mergeMultipleTags` with the variation tag IDs as sourceTagIds and the master tag ID as targetTagId.

**Validates: Requirements 4.2**

### Property 8: Partial failure continues processing

*For any* batch of selected merge groups where one group fails to merge, the system SHALL continue processing remaining groups and report both successes and failures.

**Validates: Requirements 4.5**

## Error Handling

| Error Condition | Handling |
|-----------------|----------|
| OpenAI API key not configured | Return `{ ok: false, error: 'NOT_CONFIGURED' }` |
| OpenAI API error | Return `{ ok: false, error: 'AI_ERROR' }` |
| Invalid JSON response | Return `{ ok: false, error: 'PARSE_ERROR' }` |
| No tags to analyze | Return `{ ok: true, suggestions: [] }` |
| Individual merge failure | Log error, continue with remaining, report partial results |

## Testing Strategy

### Dual Testing Approach

This feature uses both unit tests and property-based tests:

- **Unit tests**: Verify specific examples like empty tag lists, exact JSON parsing
- **Property-based tests**: Verify universal properties across random inputs using fast-check

### Property-Based Testing

Library: **fast-check** (already in project)

Configuration: Minimum 100 iterations per property test.

Each property test MUST be tagged with: `**Feature: v9.6-tag-consolidator, Property {number}: {property_text}**`

### Test Files

- `src/__tests__/tag-consolidation.property.test.ts` - Core logic properties (batching, parsing, resolution)
- `src/__tests__/smart-cleanup.property.test.ts` - UI state properties (optional, for component testing)

### Key Test Scenarios

1. **Batching logic**: Generate random tag lists of various sizes, verify batch counts
2. **JSON parsing**: Generate valid AI response structures, verify parsing
3. **Name resolution**: Generate tag databases and suggestions, verify case-insensitive matching
4. **Filtering**: Generate suggestions with mix of existing/non-existing tags, verify filtering
5. **Merge execution**: Verify correct parameters passed to mergeMultipleTags

