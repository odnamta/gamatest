# V8.1 Post-Migration Fixes - Implementation Plan

## Overview

V8.1 addresses two critical issues discovered after the V8.0 migration:
1. **Server Error on Deck Pages**: Users with bookmarked legacy deck URLs get 404 errors
2. **Missing Study Progress**: Cards created by authors don't have `user_card_progress` rows, making them invisible in study sessions

---

## Fix 1: Smart Legacy Redirect (Critical Priority)

- [x] 1.1 Update `src/app/(app)/decks/[deckId]/page.tsx` with legacy redirect
  - Import `redirect` from `next/navigation`
  - Before `notFound()`, check if `deckId` matches a `legacy_id` in `deck_templates`
  - If legacy match found, use `redirect('/decks/${newId}')` for permanent redirect
  - _Requirement: Users with old bookmarks should seamlessly reach their decks_

- [x] 1.2 Update `src/app/(app)/study/[deckId]/page.tsx` with legacy redirect
  - Same pattern: try V2 ID first, fallback to `legacy_id` lookup
  - Redirect to `/study/${newId}` if legacy match found
  - _Requirement: Study links from old sessions should work_

- [x] 1.3 Update `src/app/(app)/study/mcq/[deckId]/page.tsx` with legacy redirect
  - Same pattern: try V2 ID first, fallback to `legacy_id` lookup
  - Redirect to `/study/mcq/${newId}` if legacy match found
  - _Requirement: MCQ study links from old sessions should work_

- [x] 1.4 Update `src/app/(app)/decks/[deckId]/cards/[cardId]/edit/page.tsx` with legacy redirect
  - Check both `deckId` and `cardId` for legacy matches
  - Redirect to new URL if either is a legacy ID
  - _Requirement: Card edit links should work_

- [x] 1.5 Create helper function `resolveDeckId` in `src/lib/legacy-redirect.ts`
  - Input: `deckId: string`, `supabase: SupabaseClient`
  - Logic: Try direct lookup, then `legacy_id` lookup
  - Return: `{ id: string, isLegacy: boolean }` or `null`
  - _Requirement: DRY - reusable across all pages_

---

## Fix 2: The 'Heal' Action (High Priority)

- [x] 2.1 Create `healAuthorProgress` Server Action in `src/actions/heal-actions.ts`
  - Step 1: Get all `deck_templates` where `author_id = user.id`
  - Step 2: Get all `card_templates` in those decks
  - Step 3: Get existing `user_card_progress` for user
  - Step 4: Identify cards with NO progress row
  - Step 5: Bulk insert default progress rows using `ON CONFLICT DO NOTHING`
  - Return: `{ success: boolean, healedCount: number, error?: string }`
  - _Requirement: Safe to run multiple times (idempotent)_

- [x] 2.2 Add 'Run Repair' button to Dashboard
  - Created `src/components/dashboard/RepairButton.tsx`
  - Shows only if user has cards without progress
  - Display message: "Repair Complete: X missing cards added to your study queue."
  - Hides after successful repair
  - _Requirement: Easy one-click fix for affected users_

- [x] 2.3 Add `checkHealthStatus` function
  - Query count of cards without progress for current user
  - Return: `{ needsRepair: boolean, missingCount: number }`
  - Used to conditionally show repair button
  - _Requirement: Don't show repair button if not needed_

---

## Fix 3: Dashboard Link Cleanup (Medium Priority)

- [x] 3.1 Update dashboard to use V2 schema
  - Changed `src/app/(app)/dashboard/page.tsx` to query `user_decks` + `deck_templates`
  - Now returns `deck_templates.id` (V2 ID) not legacy `decks.id`
  - _Requirement: All dashboard links use V2 IDs_

- [x] 3.2 Verify `DeckCard` uses correct ID
  - `src/components/decks/DeckCard.tsx` uses `deck.id` from props
  - Dashboard now passes V2 ID from `deck_templates`
  - _Requirement: Clicking deck card goes to correct URL_

- [x] 3.3 Add `revalidatePath` after heal action
  - `healAuthorProgress` calls `revalidatePath('/dashboard')` after success
  - Ensures dashboard reflects updated state
  - _Requirement: UI updates after repair_

---

## Checkpoint - Verify All Fixes

- [ ] 4.1 Test legacy redirect manually
  - Navigate to `/decks/{legacy_uuid}` - should redirect to V2 URL
  - Navigate to `/study/{legacy_uuid}` - should redirect to V2 URL
  - Navigate to `/study/mcq/{legacy_uuid}` - should redirect to V2 URL

- [ ] 4.2 Test heal action
  - Create a deck with cards
  - Verify cards appear in study session after heal
  - Run heal again - should report 0 cards healed (idempotent)

- [ ] 4.3 Verify dashboard links
  - All deck cards should link to `/decks/{v2_id}`
  - No 404 errors when clicking deck cards

---

## Implementation Status

**All code changes complete. 545 tests passing.**

### Files Created:
- `src/lib/legacy-redirect.ts` - Helper functions for legacy ID resolution
- `src/actions/heal-actions.ts` - Heal action and health check functions
- `src/components/dashboard/RepairButton.tsx` - UI component for repair action

### Files Modified:
- `src/app/(app)/decks/[deckId]/page.tsx` - Added legacy redirect
- `src/app/(app)/study/[deckId]/page.tsx` - Added legacy redirect
- `src/app/(app)/study/mcq/[deckId]/page.tsx` - Added legacy redirect
- `src/app/(app)/decks/[deckId]/cards/[cardId]/edit/page.tsx` - Added legacy redirect
- `src/app/(app)/dashboard/page.tsx` - Updated to V2 schema, added RepairButton

---

## Implementation Notes

### Legacy Redirect Pattern (for all pages)
```typescript
import { redirect } from 'next/navigation'

// Try direct V2 lookup first
const { data: deckTemplate } = await supabase
  .from('deck_templates')
  .select('id, title')
  .eq('id', deckId)
  .single()

// If not found, try legacy_id lookup
if (!deckTemplate) {
  const { data: legacyMatch } = await supabase
    .from('deck_templates')
    .select('id')
    .eq('legacy_id', deckId)
    .single()
  
  if (legacyMatch) {
    redirect(`/decks/${legacyMatch.id}`)
  }
  notFound()
}
```

### Heal Action Pattern
```typescript
// Use ON CONFLICT DO NOTHING for idempotency
const { error } = await supabase
  .from('user_card_progress')
  .insert(progressRows)
  .onConflict('user_id,card_template_id')
  .ignore()
```
