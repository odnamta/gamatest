# V8.2 Study Loop Repair - Design

## Overview

This design addresses four critical bugs in the study loop. The fixes are minimal and targeted to avoid introducing new issues.

## Architecture

No architectural changes. All fixes are within existing components and server actions.

## Components and Interfaces

### Fix 1: SM-2 Algorithm Update

**File**: `src/lib/sm2.ts`

**Change**: Modify the "Again" rating case to set `nextReview` to 10 minutes instead of 1 minute.

```typescript
// Before
nextReview: new Date(now.getTime() + 60 * 1000) // 1 minute

// After  
nextReview: new Date(now.getTime() + 10 * 60 * 1000) // 10 minutes
```

### Fix 2: GlobalStudySession State Machine

**File**: `src/components/study/GlobalStudySession.tsx`

**New State**: `isShowingFeedback: boolean`

**Flow**:
```
IDLE → (click answer) → ANSWERED + SHOWING_FEEDBACK → (2s timer) → IDLE (next card)
```

**Props to MCQQuestion**: Add `disabled={isShowingFeedback}`

### Fix 3: Smart Deck Merge

**File**: `src/actions/heal-actions.ts`

**New Functions**:
- `findDuplicateDeckGroups()`: Returns groups of decks with same title/author
- `mergeDuplicateDecks()`: Merges cards intelligently, deletes empty donors

**Merge Algorithm**:
```
1. Group deck_templates by (title, author_id) WHERE count > 1
2. For each group:
   a. Master = deck with most card_templates
   b. Donor = other deck(s)
   c. For each Donor card:
      - Normalize stem (trim, lowercase)
      - If stem exists in Master → DELETE Donor card
      - If stem unique → UPDATE deck_template_id to Master
   d. DELETE empty Donor deck_template
   e. UPDATE user_decks to point to Master only
3. Wrap entire operation in transaction
```

**Stem Normalization**:
```typescript
function normalizeStem(stem: string): string {
  return stem.trim().toLowerCase().replace(/\s+/g, ' ')
}
```

### Fix 4: New Cards Query

**File**: `src/actions/global-study-actions.ts`

**Change**: Merge new cards (no progress row) into the study queue alongside due cards.

## Data Models

No schema changes. Uses existing V2 tables:
- `card_templates`
- `user_card_progress`
- `user_decks`
- `deck_templates`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system.*

### Property 1: Again Rating Future Review

*For any* card with any interval and ease factor, when rated as "Again" (1), the resulting `next_review` SHALL be at least 10 minutes in the future.

**Validates: Requirements 1.1**

### Property 2: Feedback Disables Interaction

*For any* MCQ answer during auto-advance mode, the answer buttons SHALL be disabled for exactly 2 seconds after the answer is submitted.

**Validates: Requirements 2.1, 2.2**

## Error Handling

- If upsert fails, log error but don't crash the study session
- If deduplication finds no duplicates, return success with count=0
- If new cards query fails, fall back to existing behavior (due cards only)

## Testing Strategy

### Property-Based Tests

- Update `src/__tests__/sm2.property.test.ts` to expect 10-minute delay for "Again"
- Use fast-check library (already configured)
- Minimum 100 iterations per property

### Unit Tests

- Test `checkDuplicateDecks` with mock data
- Test `deduplicateUserDecks` preserves the correct deck
