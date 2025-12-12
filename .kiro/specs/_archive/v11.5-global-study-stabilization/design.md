# Design Document: V11.5 Global Study Stabilization & Safer Actions

## Overview

V11.5 stabilizes the global study experience and improves code quality across server actions. The feature introduces a prominent "Start Studying" entry point on the dashboard, ensures SM-2 algorithm invariants are maintained, centralizes constants and auth patterns, and adds author-facing polish for draft management.

## Architecture

The implementation follows the existing patterns in the codebase:

1. **Server Actions** (`src/actions/`) - Handle all mutations and data fetching with auth
2. **Pure Utilities** (`src/lib/`) - Testable business logic extracted from actions
3. **React Components** (`src/components/`) - UI rendering with props-driven state
4. **App Router Pages** (`src/app/`) - Server components that compose actions and UI

### Key Architectural Decisions

- **withUser Helper**: Wraps server actions to eliminate auth boilerplate and standardize error shapes
- **Constants File**: Single source of truth for magic strings (statuses, categories, limits)
- **Pure Helpers**: Extract testable logic from actions (tag resolver, analytics, QA metrics)


## Components and Interfaces

### 1. Constants Module (`src/lib/constants.ts`)

```typescript
// Card status enum
export const CARD_STATUS = {
  Draft: 'draft',
  Published: 'published',
  Archived: 'archived',
} as const

export type CardStatus = typeof CARD_STATUS[keyof typeof CARD_STATUS]

// Tag categories (3-tier taxonomy)
export const TAG_CATEGORIES = ['source', 'topic', 'concept'] as const
export type TagCategory = typeof TAG_CATEGORIES[number]

// MCQ validation limits
export const MCQ_LIMITS = {
  maxOptions: 5,
  minStemLength: 10,
  maxStemLength: 2000,
  minExplanationLength: 10,
} as const
```

### 2. withUser Helper (`src/actions/_helpers.ts`)

```typescript
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Explicit context type for type safety
export type AuthContext = {
  user: User
  supabase: SupabaseClient
}

export type AuthError = { ok: false; error: 'AUTH_REQUIRED' }

export async function withUser<T>(
  fn: (ctx: AuthContext) => Promise<T>
): Promise<T | AuthError> {
  const user = await getUser()
  if (!user) {
    return { ok: false, error: 'AUTH_REQUIRED' }
  }
  const supabase = await createSupabaseServerClient()
  return fn({ user, supabase })
}
```

### 3. StartStudyingButton Component

```typescript
interface StartStudyingButtonProps {
  dueCount: number
  onClick: () => void
  isLoading?: boolean
}
```

### 4. Global Study Session Types

```typescript
export interface GlobalStudySession {
  sessionId: string
  cards: Card[]
  totalDue: number
  createdAt: string
}

export type CreateGlobalSessionResult =
  | { ok: true; session: GlobalStudySession }
  | { ok: false; error: string }
```

### 5. Tag Resolver (`src/lib/tag-resolver.ts`)

```typescript
export function resolveTopicTag(input: string): GoldenTopicTag | null
export function resolveConceptTag(input: string): string
```

### 6. Analytics Helpers (`src/lib/analytics.ts`)

```typescript
export interface WeakestConceptResult {
  tagId: string
  tagName: string
  accuracy: number
  totalAttempts: number
  isLowConfidence: boolean
}

export function findWeakestConcepts(
  progress: UserCardProgress[],
  cardTags: CardTemplateTag[],
  tags: Tag[],
  limit?: number
): WeakestConceptResult[]
```

### 7. QA Metrics Helper (`src/lib/content-staging-metrics.ts`)

```typescript
export interface QAMetrics {
  detectedCount: number
  createdCount: number
  missingNumbers: number[]
}

export function formatQAMetrics(metrics: QAMetrics): string
```


## Data Models

### Existing Tables Used

- `card_templates` - Card content with `status` field (draft/published/archived)
- `user_card_progress` - SRS state per user-card pair
- `user_decks` - User subscriptions to deck_templates
- `tags` - User tags with category and color
- `card_template_tags` - Many-to-many card-tag associations

### No Schema Changes Required

V11.5 uses existing schema. The `status` column on `card_templates` was added in V11.3.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: SM-2 Interval Non-Negativity
*For any* valid SM-2 input (interval ≥ 0, easeFactor ≥ 1.3, rating 1-4), calculateNextReview SHALL return an interval ≥ 0.
**Validates: Requirements 3.1**

### Property 2: SM-2 Ease Factor Floor
*For any* valid SM-2 input, calculateNextReview SHALL return an ease_factor ≥ 1.3.
**Validates: Requirements 3.2**

### Property 3: SM-2 Next Review Strictly Future
*For any* valid SM-2 input, calculateNextReview SHALL return a next_review date strictly after the invocation time.
**Validates: Requirements 3.3**

### Property 4: Global Due Cards Filter - Published Only
*For any* set of cards with mixed statuses, getGlobalDueCards SHALL return only cards where status = 'published'.
**Validates: Requirements 1.4, 2.3**

### Property 5: Global Due Cards Filter - Not Suspended
*For any* set of cards with mixed suspended values, getGlobalDueCards SHALL exclude cards where suspended = true.
**Validates: Requirements 2.4**

### Property 6: Global Due Cards Ordering
*For any* set of due cards, getGlobalDueCards SHALL return them sorted by next_review ascending.
**Validates: Requirements 1.5**

### Property 7: withUser Pass-Through
*For any* callback result R, when authentication succeeds, withUser SHALL return R unchanged.
**Validates: Requirements 5.4**

### Property 8: Tag Category Validation
*For any* string S, if S is not in TAG_CATEGORIES, tag creation SHALL reject with validation error.
**Validates: Requirements 4.5, 7.1**

### Property 9: Tag Color Derivation
*For any* valid TagCategory C, getCategoryColor(C) SHALL return the deterministic color for that category.
**Validates: Requirements 7.2, 7.3**

### Property 10: Topic Tag Resolution - Valid Input
*For any* string S that matches a Golden List topic (case-insensitive), resolveTopicTag SHALL return the canonical form.
**Validates: Requirements 8.2, 8.4**

### Property 11: Topic Tag Resolution - Invalid Input
*For any* string S not in the Golden List, resolveTopicTag SHALL return null.
**Validates: Requirements 8.3**

### Property 12: Weakest Concepts - Accuracy Ordering
*For any* set of tags with accuracy data, findWeakestConcepts SHALL return tags ordered by accuracy ascending.
**Validates: Requirements 9.2**

### Property 13: Weakest Concepts - Low Confidence Deprioritization
*For any* two tags with equal accuracy where one has <5 attempts and one has ≥5 attempts, the ≥5 attempts tag SHALL rank as "weaker" (more reliable data).
**Validates: Requirements 9.3**

### Property 14: Weakest Concepts - Tie Breaker
*For any* two tags with equal accuracy and both ≥5 attempts, the tag with more attempts SHALL rank first.
**Validates: Requirements 9.4**

### Property 15: QA Metrics Formatting
*For any* QAMetrics input, formatQAMetrics SHALL return a string containing detected count, created count, and missing numbers list.
**Validates: Requirements 11.2**

### Property 16: Draft Badge Visibility - Author Only
*For any* deck where user is not author, draft count badge SHALL not be rendered.
**Validates: Requirements 10.4**


## Error Handling

### Authentication Errors
- All server actions using `withUser` return `{ ok: false, error: 'AUTH_REQUIRED' }` on missing auth
- UI components handle this by redirecting to login or showing auth prompt

### Supabase Query Errors
- Actions return structured errors: `{ ok: false, error: string }` instead of empty arrays
- Error messages are logged server-side and sanitized for client display
- Toast notifications show user-friendly error messages

### Validation Errors
- Zod schemas validate inputs before database operations
- Invalid tag categories rejected with specific error message
- MCQ limits enforced at schema level

## Testing Strategy

### Property-Based Testing (fast-check)

The following property tests will be implemented:

1. **SM-2 Algorithm Properties** (`src/__tests__/sm2-scheduler.property.test.ts`)
   - Generate random valid inputs (interval, easeFactor, rating)
   - Assert invariants: interval ≥ 0, easeFactor ≥ 1.3, nextReview > now
   - Minimum 100 iterations per property

2. **Global Due Selection Properties** (`src/__tests__/global-study-v11.5.property.test.ts`)
   - Generate random card sets with mixed statuses, due dates, suspended flags
   - Assert: only published, non-suspended, due cards returned
   - Assert: output sorted by next_review ascending

3. **Tag Resolver Properties** (`src/__tests__/tag-resolver.property.test.ts`)
   - Generate random strings and Golden List variations
   - Assert: valid topics resolve to canonical form
   - Assert: invalid topics return null

4. **Analytics Properties** (`src/__tests__/analytics-v11.5.property.test.ts`)
   - Generate random accuracy data sets
   - Assert: weakest concepts ordered by accuracy
   - Assert: low confidence deprioritization
   - Assert: tie-breaker by attempt count

5. **QA Metrics Properties** (`src/__tests__/qa-metrics.property.test.ts`)
   - Generate random detected/created counts and missing numbers
   - Assert: output format matches specification

### Unit Tests

- `withUser` helper: mock auth states, verify pass-through behavior
- Constants: verify exported values match specification
- Edge cases: rating=1 resets interval, rating=4 with interval=0 sets 4 days

### Testing Framework

- **Vitest** - Test runner
- **fast-check** - Property-based testing library
- Tests located in `src/__tests__/*.property.test.ts`
- Each property test tagged with: `**Feature: v11.5-global-study-stabilization, Property N: description**`
