# Design Document: V8.5 Data Integrity

## Overview

V8.5 completes the tag flow from AI generation through database storage to UI display, and improves AI extraction reliability. The key changes are:

1. **Read-Side Tag Display**: Add joins to fetch tags when displaying cards
2. **AI Tag Enforcement**: Make tags mandatory in schema validation
3. **Forensic Mode Prompting**: Improve AI prompts to extract all questions
4. **Resume Flag**: Add explicit `isResuming` parameter for clarity

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Generation                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  draftBatchMCQFromText                              │   │
│  │  - Forensic mode prompt                             │   │
│  │  - Mandatory tags (1-3)                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Validation                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  mcqBatchItemSchema                                 │   │
│  │  - tags: z.array().min(1).max(3) (REQUIRED)         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage (V8.4 Complete)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  bulkCreateMCQV2                                    │   │
│  │  - Creates tags in tags table                       │   │
│  │  - Links via card_template_tags                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Display (V8.5 NEW)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Deck Detail Page                                   │   │
│  │  - Join card_templates → card_template_tags → tags  │   │
│  │  - Display tags as colored badges                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Fix 1: Tag Display on Read-Side

**Files to modify:**
- `src/app/(app)/decks/[deckId]/page.tsx` - Deck detail page
- Potentially create a helper function for tag fetching

**Current Issue:**
- Cards are fetched but tags are not joined
- Need to add a join query: `card_templates` → `card_template_tags` → `tags`

**Solution:**
```typescript
// Fetch cards with tags
const { data: cards } = await supabase
  .from('card_templates')
  .select(`
    id,
    stem,
    options,
    correct_index,
    explanation,
    card_template_tags (
      tags (
        id,
        name,
        color
      )
    )
  `)
  .eq('deck_template_id', deckId)
```

### Fix 2: AI Tag Enforcement

**File:** `src/lib/batch-mcq-schema.ts`

**Current Schema:**
```typescript
tags: z
  .array(z.string().max(30))
  .min(1).max(3)
  .optional()  // <-- This makes tags optional
```

**New Schema:**
```typescript
tags: z
  .array(z.string().min(1).max(30))
  .min(1, 'Must have at least 1 tag')
  .max(3, 'Must have at most 3 tags')
  // Remove .optional() to make tags required
```

### Fix 3: Forensic Mode Prompting

**File:** `src/actions/batch-mcq-actions.ts`

**Add to BATCH_EXTRACT_SYSTEM_PROMPT:**
```
FORENSIC MODE:
- Scan the ENTIRE text thoroughly for ALL multiple-choice questions
- Do NOT skip any questions - extract every MCQ you find (up to 5)
- If you find more than 5 questions, prioritize the first 5 in order
- Generate at least 1 medical concept tag per question (required)
```

### Fix 4: Resume Logic with Explicit Flag

**File:** `src/hooks/use-auto-scan.ts`

**Current Interface:**
```typescript
startScan: (startPage?: number) => void
resume: () => void
```

**New Interface:**
```typescript
interface StartScanOptions {
  startPage?: number
  isResuming?: boolean
}
startScan: (options?: StartScanOptions) => void
```

**Logic:**
- If `isResuming === true`: Use saved currentPage, preserve stats
- If `isResuming === false` or undefined: Use startPage or default to 1, reset stats

## Data Models

No schema changes required. Using existing tables:

**card_template_tags** (junction table)
- `card_template_id` (uuid, FK to card_templates)
- `tag_id` (uuid, FK to tags)
- Primary key: (card_template_id, tag_id)

**tags**
- `id` (uuid, PK)
- `user_id` (uuid, FK to auth.users)
- `name` (text)
- `color` (text)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Tag fetch includes all linked tags
*For any* card_template with tags in card_template_tags, fetching that card SHALL return all associated tag names.
**Validates: Requirements 1.1, 1.2**

### Property 2: Tag validation rejects empty tags
*For any* MCQ draft with an empty or missing tags array, schema validation SHALL reject it.
**Validates: Requirements 2.1, 2.2**

### Property 3: Valid tags pass validation
*For any* MCQ draft with 1-3 non-empty tag strings, schema validation SHALL accept it.
**Validates: Requirements 2.1**

### Property 4: Resume flag uses saved page
*For any* saved scan state, calling startScan with `isResuming: true` SHALL use the saved currentPage.
**Validates: Requirements 4.1, 4.2**

### Property 5: Fresh start ignores saved page
*For any* saved scan state, calling startScan with `isResuming: false` SHALL use the provided startPage or default to 1.
**Validates: Requirements 4.3**

## Error Handling

### Tag Fetch Errors
- If card_template_tags join fails, return cards without tags (graceful degradation)
- Log warning but don't fail the entire page load

### AI Tag Validation
- Questions without valid tags are filtered out silently
- If all questions fail validation, return empty drafts array
- Log count of filtered questions for debugging

### Resume State Errors
- If localStorage is corrupted, fall back to fresh start
- Show toast notification: "Could not resume, starting fresh"
- Clear corrupted state to prevent repeated failures

## Testing Strategy

### Property-Based Tests (fast-check)

**Test File:** `src/__tests__/tag-display.property.test.ts`
- Property 1: Tag fetch completeness

**Test File:** `src/__tests__/ai-tag-validation.property.test.ts`
- Property 2: Empty tags rejection
- Property 3: Valid tags acceptance

**Test File:** `src/__tests__/resume-flag.property.test.ts`
- Property 4: Resume uses saved page
- Property 5: Fresh start ignores saved page

### Unit Tests
- Verify forensic mode text is in prompts
- Verify tag schema changes work correctly
- Verify join query returns expected structure
