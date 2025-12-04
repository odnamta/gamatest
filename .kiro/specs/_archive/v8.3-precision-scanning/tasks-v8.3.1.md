# V8.2.1 Hotfix: Deduplication Crash & Author Permissions

## Summary

Two issues identified:
1. **Crash on duplicate deletion** - Potential FK constraint violation when deleting cards
2. **Missing Add/Edit buttons** - `isAuthor` not being used to conditionally render author-only UI

---

## Fix 1: Safe Deduplication (The Crash Fix)

### Analysis

Current state:
- `user_card_progress.card_template_id` → `ON DELETE CASCADE` ✅ (schema.sql line ~520)
- `card_template_tags.card_template_id` → `ON DELETE CASCADE` ✅ (schema.sql line ~430)

The FK constraints are correct. However, `removeDuplicateCards` in `src/actions/card-actions.ts` manually deletes `user_card_progress` before deleting cards (redundant but harmless).

**Potential issue**: The query filters by `card_type = 'mcq'`, but `card_templates` table doesn't have a `card_type` column. This would return 0 rows and silently fail.

### Tasks

- [x] 1.1 Fix `removeDuplicateCards` query
  - Remove `.eq('card_type', 'mcq')` filter (card_templates doesn't have this column)
  - All card_templates are MCQ-style in V2 schema
  - File: `src/actions/card-actions.ts`

- [x] 1.2 Simplify deletion (rely on CASCADE)
  - Remove manual `user_card_progress` deletion (CASCADE handles it)
  - Wrap delete in try/catch with specific error message
  - File: `src/actions/card-actions.ts`

- [ ] 1.3 Verify FK constraints in production (manual step)
  - Run SQL to confirm CASCADE exists:
    ```sql
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc 
      ON tc.constraint_name = rc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('user_card_progress', 'card_template_tags');
    ```
  - If `delete_rule` is not `CASCADE`, apply migration:
    ```sql
    -- Only if needed
    ALTER TABLE user_card_progress 
      DROP CONSTRAINT user_card_progress_card_template_id_fkey,
      ADD CONSTRAINT user_card_progress_card_template_id_fkey 
        FOREIGN KEY (card_template_id) 
        REFERENCES card_templates(id) ON DELETE CASCADE;
    ```

---

## Fix 2: Restore Author Permissions (The Missing Buttons)

### Analysis

In `src/app/(app)/decks/[deckId]/page.tsx`:
- `isAuthor` is computed correctly: `deckTemplate.author_id === user.id`
- **Problem**: `isAuthor` is not passed to child components or used to conditionally render "Add Card" form

The "Add New Card" form and action buttons are always shown, regardless of `isAuthor`. This is actually the opposite problem - buttons show for everyone, not just authors.

If buttons are missing, the issue is likely:
1. `author_id` is NULL in the database
2. User ID mismatch

### Tasks

- [ ] 2.1 Add debug logging (temporary) - SKIPPED (not needed if 2.3 works)

- [ ] 2.2 Self-healing for NULL author_id (manual step if needed)
  - Run one-time SQL fix if author_id is NULL:
    ```sql
    UPDATE deck_templates dt
    SET author_id = ud.user_id
    FROM user_decks ud
    WHERE dt.id = ud.deck_template_id
      AND dt.author_id IS NULL;
    ```

- [x] 2.3 Conditionally render author-only UI
  - Pass `isAuthor` prop to relevant sections
  - Hide "Add New Card" form for non-authors
  - Hide "Bulk Import" button for non-authors
  - Hide "Clean Duplicates" button for non-authors
  - Hide Edit/Delete/Duplicate buttons in CardList for non-authors
  - Files: `src/app/(app)/decks/[deckId]/page.tsx`, `src/components/cards/CardList.tsx`, `src/components/cards/CardListItem.tsx`

---

## Verification

- [ ] 3.1 Test deduplication on deck with duplicates
- [ ] 3.2 Verify Add/Edit buttons appear for deck author
- [ ] 3.3 Verify Add/Edit buttons hidden for subscribers (non-authors)
- [x] 3.4 Run existing property tests: `npm run test` ✅ 573 tests pass
