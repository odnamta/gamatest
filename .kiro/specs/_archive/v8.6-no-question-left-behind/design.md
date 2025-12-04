# Design Document: V8.6 No Question Left Behind

## Overview

This patch addresses critical data integrity and UX issues in the batch MCQ extraction pipeline. The primary fix removes artificial limits that cause question loss on dense pages. Secondary fixes ensure reliable auto-scan resume functionality and add deck renaming capability.

## Architecture

The changes span three layers:

1. **AI Layer** (`src/actions/batch-mcq-actions.ts`, `src/lib/batch-mcq-schema.ts`)
   - Remove array size constraints in Zod schemas
   - Update AI prompts to be "greedy" extractors
   - Increase max_tokens to prevent response truncation

2. **State Management Layer** (`src/hooks/use-auto-scan.ts`)
   - Add defensive localStorage checks before resume
   - Ensure ref synchronization before scan loop starts
   - Prevent race conditions that reset page to 1

3. **UI Layer** (`src/components/decks/`, `src/app/(app)/decks/[deckId]/page.tsx`)
   - New EditableDeckTitle component with optimistic updates
   - NeedsReview tag highlighting in CardList

```
┌─────────────────────────────────────────────────────────────┐
│                      PDF Viewer Page                         │
├─────────────────────────────────────────────────────────────┤
│  useAutoScan Hook                                            │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │ localStorage │◄──►│ Resume Logic │◄──►│ Scan Loop      │  │
│  │ (state)      │    │ (V8.6 fix)   │    │ (processPage)  │  │
│  └─────────────┘    └──────────────┘    └────────────────┘  │
│                              │                               │
│                              ▼                               │
│                    ┌──────────────────┐                      │
│                    │ draftBatchMCQ    │                      │
│                    │ (no .max(5))     │                      │
│                    └──────────────────┘                      │
│                              │                               │
│                              ▼                               │
│                    ┌──────────────────┐                      │
│                    │ OpenAI API       │                      │
│                    │ (max_tokens:4096)│                      │
│                    └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Modified: `draftBatchMCQFromText` Server Action

```typescript
// Before: Artificial cap
const itemsToValidate = questionsArray.slice(0, 5)

// After: Process all
const itemsToValidate = questionsArray
```

### 2. Modified: Zod Schema

```typescript
// Before
export const mcqBatchDraftSchema = z.array(mcqBatchItemSchema).max(5)

// After
export const mcqBatchDraftSchema = z.array(mcqBatchItemSchema) // No max
```

### 3. New: `updateDeckTitle` Server Action

```typescript
interface UpdateDeckTitleInput {
  deckId: string
  newTitle: string
}

// Returns ActionResult { success: boolean; error?: string }
```

### 4. New: `EditableDeckTitle` Component

```typescript
interface EditableDeckTitleProps {
  deckId: string
  initialTitle: string
}

// States: viewing | editing | saving
// Features: optimistic update, error rollback, escape to cancel
```

### 5. Modified: `useAutoScan` Hook

```typescript
// New defensive check in startScan
const startScan = useCallback((options?: StartScanOptions) => {
  if (options?.isResuming) {
    const saved = loadAutoScanState(deckId, sourceId)
    if (!saved || !saved.isScanning) {
      console.warn('[useAutoScan] No valid saved state, starting fresh')
      startFresh()
      return
    }
    // Sync refs before loop
    isScanningRef.current = true
    currentPageRef.current = saved.currentPage
  }
  // ...
}, [])
```

## Data Models

No new database tables. Changes affect:

1. **deck_templates.title** - Now editable via new server action
2. **card_template_tags** - May include "NeedsReview" tag from AI

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No Artificial Array Cap

*For any* array of valid MCQ objects returned by the AI, the validation pipeline SHALL process all items without truncation. The output count SHALL equal the input count (minus any items that fail individual validation).

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Resume Preserves Page Position

*For any* saved auto-scan state where `currentPage > 1`, calling `resume()` SHALL result in scanning starting from exactly `currentPage`, never from page 1.

**Validates: Requirements 2.1**

### Property 3: Resume Preserves Stats

*For any* saved auto-scan state with non-zero stats (cardsCreated, pagesProcessed, errorsCount), calling `resume()` SHALL preserve those exact values in the hook's state.

**Validates: Requirements 2.2**

### Property 4: Resume Fallback on Missing State

*For any* call to `resume()` when localStorage contains no valid saved state, the system SHALL fall back to `startFresh()` behavior (page 1, zeroed stats).

**Validates: Requirements 2.3, 2.4**

### Property 5: Author-Only Title Edit

*For any* deck_template, only the user whose ID matches `author_id` SHALL be able to successfully call `updateDeckTitle`. Non-authors SHALL receive an authorization error.

**Validates: Requirements 3.2, 3.3**

### Property 6: NeedsReview Highlight

*For any* card with a tag where `name.toLowerCase() === 'needsreview'`, the CardList component SHALL render that card with the yellow highlight class.

**Validates: Requirements 4.2**

### Property 7: NeedsReview Filter

*For any* list of cards, filtering by NeedsReview SHALL return exactly the subset of cards that have a tag named "NeedsReview" (case-insensitive).

**Validates: Requirements 4.3**

## Error Handling

| Scenario | Handling |
|----------|----------|
| AI returns truncated JSON | Increase max_tokens to 4096; log warning if response seems cut off |
| Resume with no saved state | Fall back to startFresh with console warning |
| Title update fails | Revert optimistic UI, show toast error |
| Non-author attempts rename | Return 403 error, UI should not show edit button |

## Testing Strategy

### Unit Tests

- `updateDeckTitle` returns error for non-author
- `updateDeckTitle` succeeds for author with valid title
- `EditableDeckTitle` renders edit icon for author
- `EditableDeckTitle` hides edit icon for non-author

### Property-Based Tests

Using **fast-check** library as specified in the project's testing stack.

1. **Batch Array Processing** (Property 1)
   - Generate arrays of 1-50 valid MCQ objects
   - Verify all pass through without truncation

2. **Resume Page Preservation** (Property 2)
   - Generate saved states with currentPage in [2, 100]
   - Mock localStorage, call resume, verify page number

3. **Resume Stats Preservation** (Property 3)
   - Generate saved states with random stats
   - Call resume, verify stats match exactly

4. **Author-Only Edit** (Property 5)
   - Generate user IDs and deck author IDs
   - Verify updateDeckTitle succeeds iff user === author

5. **NeedsReview Highlight** (Property 6)
   - Generate cards with random tags
   - Verify highlight class presence matches tag presence

6. **NeedsReview Filter** (Property 7)
   - Generate card lists with random NeedsReview distribution
   - Verify filter returns exact subset

### Test Configuration

- Minimum 100 iterations per property test
- Each test tagged with: `**Feature: v8.6-no-question-left-behind, Property {N}: {description}**`
