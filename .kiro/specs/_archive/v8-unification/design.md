# Design Document

## Overview

V8.0 "The Great Unification" eliminates the hybrid V1/V2 schema state by completing the data migration and hard-switching all application code to use V2 tables exclusively. The migration consists of three phases: (1) Data Migration - pouring all remaining legacy data into V2 tables, (2) Code Cutover - updating all server actions to use V2 tables only, and (3) Verification - adding startup checks to ensure migration completeness.

## Architecture

The migration follows a "pour and switch" pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                     BEFORE (Hybrid State)                       │
├─────────────────────────────────────────────────────────────────┤
│  Legacy Tables          │  V2 Tables                            │
│  ┌─────────┐            │  ┌────────────────┐                   │
│  │ decks   │────────────┼─▶│ deck_templates │                   │
│  └─────────┘            │  └────────────────┘                   │
│       │                 │         │                             │
│       ▼                 │         ▼                             │
│  ┌─────────┐            │  ┌────────────────┐                   │
│  │ cards   │────────────┼─▶│ card_templates │                   │
│  └─────────┘            │  └────────────────┘                   │
│       │                 │         │                             │
│       ▼                 │         ▼                             │
│  ┌───────────┐          │  ┌─────────────────────┐              │
│  │ card_tags │──────────┼─▶│ card_template_tags  │              │
│  └───────────┘          │  └─────────────────────┘              │
│                         │         │                             │
│  (SRS embedded in cards)│         ▼                             │
│                         │  ┌─────────────────────┐              │
│                         │  │ user_card_progress  │              │
│                         │  └─────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     AFTER (V2 Only)                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐     ┌─────────────┐                         │
│  │ deck_templates │◀────│ user_decks  │ (subscriptions)         │
│  └────────────────┘     └─────────────┘                         │
│         │                     │                                 │
│         ▼                     │                                 │
│  ┌────────────────┐           │                                 │
│  │ card_templates │           │                                 │
│  └────────────────┘           │                                 │
│         │                     │                                 │
│         ▼                     ▼                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐               │
│  │ card_template_tags  │  │ user_card_progress  │ (SRS state)   │
│  └─────────────────────┘  └─────────────────────┘               │
│                                                                 │
│  Legacy tables remain but are no longer queried                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Migration SQL Function

**File:** `scripts/migrate-v8-unification.sql`

```sql
CREATE OR REPLACE FUNCTION migrate_v1_to_v2_complete()
RETURNS JSON AS $$
DECLARE
  deck_count INTEGER := 0;
  card_count INTEGER := 0;
  tag_count INTEGER := 0;
  progress_count INTEGER := 0;
BEGIN
  -- Step 1: Migrate decks → deck_templates
  -- Step 2: Migrate cards → card_templates  
  -- Step 3: Migrate card_tags → card_template_tags
  -- Step 4: Create user_card_progress from cards SRS state
  -- Step 5: Create user_decks subscriptions
  
  RETURN json_build_object(
    'deck_templates_created', deck_count,
    'card_templates_created', card_count,
    'card_template_tags_created', tag_count,
    'user_card_progress_created', progress_count
  );
END;
$$ LANGUAGE plpgsql;
```

### 2. Updated Server Actions

**Files to modify:**
- `src/actions/card-actions.ts` - Point to card_templates
- `src/actions/mcq-actions.ts` - Point to card_templates
- `src/actions/batch-mcq-actions.ts` - Remove V1 fallback
- `src/actions/global-study-actions.ts` - Remove V1 functions
- `src/actions/study-actions.ts` - Point to user_card_progress
- `src/actions/deck-actions.ts` - Point to deck_templates

### 3. Updated Page Components

**Files to modify:**
- `src/app/(app)/decks/[deckId]/page.tsx` - Remove hybrid logic
- `src/app/(app)/study/[deckId]/page.tsx` - Use V2 queries
- `src/app/(app)/study/mcq/[deckId]/page.tsx` - Use V2 queries

### 4. Migration Verification Utility

**File:** `src/lib/migration-check.ts`

```typescript
export async function checkMigrationStatus(): Promise<{
  legacyCardsCount: number;
  migrationComplete: boolean;
  warning?: string;
}>
```

## Data Models

### Legacy → V2 Field Mapping

| Legacy Table | Legacy Field | V2 Table | V2 Field |
|--------------|--------------|----------|----------|
| decks | id | deck_templates | legacy_id |
| decks | title | deck_templates | title |
| decks | user_id | deck_templates | author_id |
| cards | id | card_templates | legacy_id |
| cards | deck_id | card_templates | deck_template_id (via legacy_id lookup) |
| cards | stem | card_templates | stem |
| cards | options | card_templates | options |
| cards | correct_index | card_templates | correct_index |
| cards | explanation | card_templates | explanation |
| cards | interval | user_card_progress | interval |
| cards | ease_factor | user_card_progress | ease_factor |
| cards | next_review | user_card_progress | next_review |
| card_tags | card_id | card_template_tags | card_template_id (via legacy_id lookup) |
| card_tags | tag_id | card_template_tags | tag_id |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Migration Completeness
*For any* set of legacy cards in the `cards` table, after running the migration function, every card SHALL have a corresponding `card_template` row with matching `legacy_id`.
**Validates: Requirements 1.1**

### Property 2: SRS State Preservation
*For any* migrated card, the `user_card_progress` row SHALL have identical `interval`, `ease_factor`, and `next_review` values as the original legacy card.
**Validates: Requirements 1.2**

### Property 3: Tag Migration Integrity
*For any* legacy card with tags, after migration the corresponding `card_template` SHALL have the same set of tags via `card_template_tags`.
**Validates: Requirements 1.3**

### Property 4: Migration Idempotence
*For any* database state, running the migration function twice SHALL produce the same final state as running it once (no duplicate records, no errors).
**Validates: Requirements 1.4**

### Property 5: Card Creation V2 Only
*For any* card creation operation, the card SHALL exist in `card_templates` and SHALL NOT exist in the legacy `cards` table.
**Validates: Requirements 2.2**

### Property 6: Due Cards V2 Source
*For any* due cards query result, all returned cards SHALL have valid `card_template_id` references and SRS state from `user_card_progress`.
**Validates: Requirements 2.5**

### Property 7: Migration Report Accuracy
*For any* migration execution, the returned JSON counts SHALL exactly match the number of rows actually inserted into each V2 table.
**Validates: Requirements 3.3**

### Property 8: Content Integrity
*For any* migrated card, the content fields (stem, options, correct_index, explanation) in `card_templates` SHALL exactly match the original values in the legacy `cards` table.
**Validates: Requirements 3.4**

### Property 9: Legacy ID Rejection
*For any* card operation that receives an ID not found in `card_templates`, the system SHALL return an error without attempting legacy table fallback.
**Validates: Requirements 4.1**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Migration finds orphaned card (no deck) | Skip card, log warning |
| Duplicate legacy_id conflict | Use ON CONFLICT DO NOTHING |
| Missing tag reference | Skip tag link, log warning |
| V1 function called | Redirect to V2 equivalent |
| Legacy deck ID in request | Return clear error: "Deck not found in V2 schema" |

## Testing Strategy

### Property-Based Testing Library
**Library:** fast-check (already in use in the project)

### Test Configuration
- Minimum 100 iterations per property test
- Tests tagged with property reference: `**Feature: v8-unification, Property {N}: {description}**`

### Unit Tests
- Migration function returns correct counts
- V2 server actions reject legacy IDs
- Startup migration check logs appropriately

### Property-Based Tests
Each correctness property above will have a corresponding property-based test that:
1. Generates random valid input data
2. Executes the operation
3. Verifies the property holds

### Integration Tests
- End-to-end migration of sample dataset
- Card CRUD operations post-migration
- Study session with migrated cards
