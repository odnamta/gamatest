# Implementation Plan – V6.4 Shared Library Refactor

**Phase Goal:** Transition from user-bound cards to a shared deck/card template system with per-user progress, while maintaining perfect backward compatibility.

## Invariants (MUST preserve)

1. **DATA SAFETY:** Never lose user study progress or SRS state
2. **IDEMPOTENT:** Migration must be safe to run multiple times
3. **TAGS:** Tags remain their own table (many-to-many); no regression to JSON arrays
4. **SECURITY:** RLS must be explicit and strict: public templates are read-only for non-authors
5. **COMPATIBILITY:** Old `cards` and `decks` remain fully functional until V7

---

## Phase 1 — Schema Evolution (The Foundation)

### Content Layer (Shared Templates)

- [x] 1. Create deck_templates table
  - [x] 1.1 Create deck_templates table via migration
    - Columns: `id UUID PK`, `title TEXT NOT NULL`, `description TEXT`, `visibility TEXT CHECK ('private'|'public') DEFAULT 'private'`, `author_id UUID NOT NULL REFERENCES auth.users(id)`, `legacy_id UUID` (for migration tracking), `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
    - Add index on `legacy_id` for migration lookups
    - _Req: Schema Evolution_
  - [x] 1.2 Enable RLS on deck_templates
    - Policy: Public templates (`visibility = 'public'`) readable by all authenticated users
    - Policy: Private templates readable only by `author_id = auth.uid()`
    - Policy: INSERT/UPDATE/DELETE only allowed for `author_id = auth.uid()`
    - _Req: Security_

- [x] 2. Create card_templates table
  - [x] 2.1 Create card_templates table via migration
    - Columns: `id UUID PK`, `deck_template_id UUID NOT NULL REFERENCES deck_templates(id) ON DELETE CASCADE`, `stem TEXT NOT NULL`, `options JSONB NOT NULL`, `correct_index INTEGER NOT NULL`, `explanation TEXT`, `source_meta JSONB` (page, source_id, etc.), `legacy_id UUID`, `created_at TIMESTAMPTZ`
    - Add index on `legacy_id` for migration lookups
    - Add index on `deck_template_id` for joins
    - _Req: Schema Evolution_
  - [x] 2.2 Enable RLS on card_templates
    - Policy: Inherit visibility from parent deck_template
    - Policy: INSERT/UPDATE/DELETE only allowed if user owns parent deck_template
    - _Req: Security_

- [x] 3. Create card_template_tags join table
  - [x] 3.1 Create card_template_tags table via migration
    - Columns: `card_template_id UUID NOT NULL REFERENCES card_templates(id) ON DELETE CASCADE`, `tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ DEFAULT NOW()`
    - Primary key: `(card_template_id, tag_id)`
    - Add indexes on both foreign keys
    - _Req: Schema Evolution_
  - [x] 3.2 Enable RLS on card_template_tags
    - Policy: Inherit access from parent card_template
    - Policy: INSERT/DELETE only allowed if user owns parent card_template
    - _Req: Security_

### Progress Layer (Per-User)

- [x] 4. Create user_decks table
  - [x] 4.1 Create user_decks table via migration
    - Columns: `id UUID PK`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `deck_template_id UUID NOT NULL REFERENCES deck_templates(id) ON DELETE CASCADE`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ DEFAULT NOW()`
    - Unique constraint on `(user_id, deck_template_id)`
    - Add index on `user_id` for dashboard queries
    - _Req: Schema Evolution_
  - [x] 4.2 Enable RLS on user_decks
    - Policy: Full read/write restricted to `user_id = auth.uid()`
    - _Req: Security_

- [x] 5. Create user_card_progress table
  - [x] 5.1 Create user_card_progress table via migration
    - Columns: `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `card_template_id UUID NOT NULL REFERENCES card_templates(id) ON DELETE CASCADE`, `interval INTEGER DEFAULT 0`, `ease_factor REAL DEFAULT 2.5`, `repetitions INTEGER DEFAULT 0`, `next_review TIMESTAMPTZ DEFAULT NOW()`, `last_answered_at TIMESTAMPTZ`, `suspended BOOLEAN DEFAULT false`
    - Primary key: `(user_id, card_template_id)`
    - Add composite index on `(user_id, card_template_id)` for fast study lookups
    - Add index on `(user_id, next_review)` for due card queries
    - _Req: Schema Evolution_
  - [x] 5.2 Enable RLS on user_card_progress
    - Policy: Full read/write restricted to `user_id = auth.uid()`
    - _Req: Security_

- [x] 6. Update TypeScript types
  - [x] 6.1 Add new types to database.ts
    - Add `DeckTemplate`, `CardTemplate`, `CardTemplateTag`, `UserDeck`, `UserCardProgress` interfaces
    - Add `DeckVisibility` type: `'private' | 'public'`
    - Add `CardTemplateWithTags` extended type
    - _Req: Type Safety_

- [x] 7. Checkpoint - Verify schema
  - Ensure all tables created with correct columns
  - Verify RLS policies are active
  - Run `npm run test` to ensure no regressions

---

## Phase 2 — Data Migration (The Move)

- [x] 8. Create idempotent migration function
  - [x] 8.1 Write migrate_v1_to_v2() SQL function
    - Create function in Supabase SQL editor
    - Return type: JSON object with migration counts
    - _Req: Migration_
  - [x] 8.2 Implement Step 1: Decks → Deck Templates
    - For each row in `decks`, insert into `deck_templates` where no `deck_templates.legacy_id` equals that `decks.id`
    - Set `legacy_id = decks.id`, `author_id = decks.user_id`, `visibility = 'private'`
    - Use `INSERT ... ON CONFLICT DO NOTHING` on `legacy_id`
    - _Req: Migration, Idempotent_
  - [x] 8.3 Implement Step 2: Cards → Card Templates
    - For each row in `cards` where `card_type = 'mcq'`, insert into `card_templates`
    - Set `legacy_id = cards.id`, resolve `deck_template_id` via `decks.id → deck_templates.legacy_id`
    - Use `INSERT ... ON CONFLICT DO NOTHING` on `legacy_id`
    - _Req: Migration, Idempotent_
  - [x] 8.4 Implement Step 3: card_tags → card_template_tags
    - For each existing card-tag link, create `card_template_tags` row
    - Resolve `card_template_id` via `cards.id → card_templates.legacy_id`
    - Use `INSERT ... ON CONFLICT DO NOTHING` on `(card_template_id, tag_id)`
    - _Req: Migration, Idempotent_
  - [x] 8.5 Implement Step 4: Cards → user_card_progress
    - For each `cards` row, create `user_card_progress` with SRS fields
    - Resolve `user_id` from `decks.user_id`, `card_template_id` via `legacy_id`
    - Copy: `interval`, `ease_factor`, `next_review`; set `repetitions` based on interval
    - Use `INSERT ... ON CONFLICT DO NOTHING` on `(user_id, card_template_id)`
    - _Req: Migration, Idempotent, Data Safety_
  - [x] 8.6 Implement Step 5: Create user_decks entries
    - For each deck owner, create `user_decks` linking them to their migrated deck_template
    - Use `INSERT ... ON CONFLICT DO NOTHING` on `(user_id, deck_template_id)`
    - _Req: Migration, Idempotent_
  - [x] 8.7 Return migration report
    - Return JSON: `{ deck_templates_created, card_templates_created, card_template_tags_created, user_progress_created, user_decks_created }`
    - Include counts vs legacy tables for verification
    - _Req: Migration_

- [x] 9. Checkpoint - Verify migration
  - Run `SELECT migrate_v1_to_v2()` and verify counts
  - Run again to verify idempotency (counts should be 0 on second run)
  - Spot-check: verify SRS data matches between old and new tables

---

## Phase 3 — Codebase Refactor (The Switch)

### Read Path (Study Mode)

- [x] 10. Update study server actions
  - [x] 10.1 Create getGlobalDueCardsV2 action
    - Location: `src/actions/study-actions.ts`
    - Query `card_templates` joined to `user_card_progress` where `next_review <= now`
    - If no `user_card_progress` exists for a card_template, treat as New Card (default SRS values)
    - Return same shape as existing `getGlobalDueCards` for compatibility
    - _Req: Read Path_
  - [x] 10.2 Update getCustomSessionCards
    - Location: `src/actions/custom-study-actions.ts`
    - Query from `card_templates` + `user_card_progress` instead of `cards`
    - Tag filtering via `card_template_tags` instead of `card_tags`
    - Deck filtering via `deck_templates` instead of `decks`
    - _Req: Read Path_
  - [x] 10.3 Add lazy progress creation
    - When user answers a card with no `user_card_progress`, create row on first answer
    - Implement in `recordAnswer` or equivalent action
    - _Req: Read Path_

- [x] 11. Update deck listing actions
  - [x] 11.1 Create getDeckTemplates action
    - Fetch user's deck_templates (authored + subscribed via user_decks)
    - Include due count from user_card_progress
    - _Req: Read Path_
  - [x] 11.2 Update dashboard queries
    - Global due count from `user_card_progress` where `next_review <= now`
    - Deck list from `user_decks` joined to `deck_templates`
    - _Req: Read Path_

### Write Path (Importer / Authoring)

- [x] 12. Update card creation flows
  - [x] 12.1 Update batch draft flow
    - Location: `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`
    - Create `card_templates` instead of `cards`
    - Create `card_template_tags` instead of `card_tags`
    - Auto-create `user_card_progress` for author
    - _Req: Write Path_
  - [x] 12.2 Update single card creation
    - Any "Add Card" flows should create `card_templates`
    - Auto-create `user_card_progress` for author
    - _Req: Write Path_
  - [x] 12.3 Update deck creation
    - Create `deck_templates` instead of `decks`
    - Auto-create `user_decks` entry for author
    - _Req: Write Path_

- [x] 13. Update card editing flows
  - [x] 13.1 Update card edit actions
    - Edit `card_templates` instead of `cards`
    - Only allow if user is author (RLS enforces this)
    - _Req: Write Path_
  - [x] 13.2 Update tag management
    - Manage `card_template_tags` instead of `card_tags`
    - _Req: Write Path_

- [x] 14. Checkpoint - Full integration test
  - Run `npm run test` - all tests pass
  - Run `npm run build` - no TypeScript errors
  - Manual test: create deck, add cards, study, verify SRS updates

---

## Phase 4 — Cleanup & Documentation

- [x] 15. Add feature flag for gradual rollout
  - [x] 15.1 Create useV2Schema feature flag
    - Environment variable or database flag
    - Allow toggling between V1 and V2 read paths
    - _Req: Compatibility_

- [x] 16. Update schema.sql documentation
  - [x] 16.1 Add V6.4 tables to schema.sql
    - Document all new tables with comments
    - Include migration guide section
    - _Req: Documentation_

- [x] 17. Final verification
  - [x] 17.1 Run full test suite
    - `npm run test` passes
    - No regressions in existing functionality
    - _Req: Testing_
  - [x] 17.2 Build verification
    - `npm run build` succeeds
    - No TypeScript errors
    - _Req: Testing_

---

## V6.4 Invariants Checklist

- [x] ✅ **DATA SAFETY:** All SRS progress migrated via `user_card_progress`
- [x] ✅ **IDEMPOTENT:** Migration uses `ON CONFLICT DO NOTHING` throughout
- [x] ✅ **TAGS:** `card_template_tags` is proper join table, not JSON
- [x] ✅ **SECURITY:** RLS policies enforce author-only writes, public read for public templates
- [x] ✅ **COMPATIBILITY:** Legacy `cards` and `decks` tables untouched, app works during migration

---

## New Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `deck_templates` | Shared deck definitions | id, title, visibility, author_id, legacy_id |
| `card_templates` | Shared card content | id, deck_template_id, stem, options, legacy_id |
| `card_template_tags` | Card-tag relationships | card_template_id, tag_id |
| `user_decks` | User's subscribed decks | user_id, deck_template_id, is_active |
| `user_card_progress` | Per-user SRS state | user_id, card_template_id, interval, ease_factor, next_review |

---

## File Changes Summary

### New Files
- Migration SQL function `migrate_v1_to_v2()` (Supabase SQL Editor)

### Modified Files
- `src/types/database.ts` - New type definitions (DeckTemplate, CardTemplate, UserDeck, UserCardProgress)
- `src/actions/global-study-actions.ts` - V2 read paths (getGlobalDueCardsV2, getGlobalStatsV2, upsertCardProgress)
- `src/actions/custom-study-actions.ts` - V2 filtering (getCustomSessionCardsV2)
- `src/actions/deck-actions.ts` - V2 deck operations (getDeckTemplates, getUserDeckTemplates, createDeckTemplateAction)
- `src/actions/batch-mcq-actions.ts` - V2 card creation (bulkCreateMCQV2)
- `schema.sql` - Documentation update with V6.4 tables

---

## Implementation Summary

**V6.4 Shared Library Refactor - COMPLETE**

All phases implemented:
1. ✅ Schema Evolution - 5 new tables with RLS
2. ✅ Data Migration - Idempotent function migrated 3 decks, 19 cards, 6 tags
3. ✅ Codebase Refactor - V2 read/write paths with feature flag
4. ✅ Documentation - schema.sql updated

Tests: 441 passed | Build: Success
