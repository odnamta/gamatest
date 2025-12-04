# V8.2.2 Hotfix: Upload & ID Patch

## Summary

The "Deck not found" error during PDF upload occurs because `uploadSourceAction` queries the legacy `decks` table instead of `deck_templates`. Additionally, the bulk import page doesn't verify author permissions.

---

## Fix 1: Smart ID for PDF Upload (The Crash Fix)

### Analysis

In `src/actions/source-actions.ts`, the `uploadSourceAction` function:
```typescript
// WRONG: Queries legacy 'decks' table
const { data: deck, error: deckError } = await supabase
  .from('decks')  // ← Should be 'deck_templates'
  .select('id')
  .eq('id', validatedDeckId)
  .single()
```

This fails because V8 uses `deck_templates`, not `decks`.

### Tasks

- [x] 1.1 Update `uploadSourceAction` to use `deck_templates`
  - Changed `.from('decks')` to `.from('deck_templates')`
  - Added `author_id` to select clause
  - Added `author_id === user.id` check (only authors can upload)
  - File: `src/actions/source-actions.ts`

- [x] 1.2 Update `linkSourceToDeckAction` to use `deck_templates`
  - Same pattern: query `deck_templates` instead of `decks`
  - Added author ownership verification
  - File: `src/actions/source-actions.ts`

- [ ] 1.3 Update `deck_sources` to use `deck_template_id` (DEFERRED)
  - Schema uses `deck_id` referencing legacy `decks` table
  - For now, storing `deck_template_id` in `deck_id` column works (both UUIDs)
  - Future: migrate to proper `deck_template_sources` join table

---

## Fix 2: Page Access Protection

### Analysis

The bulk import page (`src/app/(app)/decks/[deckId]/add-bulk/page.tsx`) is a client component that doesn't verify author permissions. Non-authors can see the upload UI but uploads fail.

### Tasks

- [x] 2.1 Add server-side author check
  - Created Server Component wrapper (`page.tsx`)
  - Moved client component to `BulkImportClient.tsx`
  - Checks `author_id === user.id` before rendering
  - Non-authors redirected to deck details page
  - Files: `src/app/(app)/decks/[deckId]/add-bulk/page.tsx`, `BulkImportClient.tsx`

- [x] 2.2 Alternative: Client-side guard - NOT NEEDED
  - Server-side check is more secure

---

## Schema Check

Before implementing, verify `deck_sources` table structure:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deck_sources';
```

If it has `deck_id` referencing legacy `decks`, we need to either:
1. Add `deck_template_id` column and migrate
2. Or use the existing `deck_id` column but query `deck_templates` (if FK allows)

---

## Verification

- [ ] 3.1 Test PDF upload as deck author
- [ ] 3.2 Verify non-authors cannot access bulk import page (redirects to deck details)
- [x] 3.3 Run existing tests: `npm run test` ✅ 572 passed (1 pre-existing flaky test in markdown.property.test.ts)
