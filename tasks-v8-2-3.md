# V8.2.3: Upload Logic Repair - Remediation Plan

**Goal:** Fix the persistent "Deck not found" error on PDF Upload by making ID resolution robust against Legacy IDs and User Deck IDs.

---

## Fix 1: Robust ID Resolution (The Catch-All)

**File:** `src/actions/source-actions.ts`  
**Priority:** 🔴 Highest

### Tasks

- [x] **1.1** Add diagnostic logging at entry point
  ```typescript
  console.log('[uploadSourceAction] Received deckId:', validatedDeckId, 'User:', user.id)
  ```

- [x] **1.2** Implement 3-Step Lookup Strategy in `uploadSourceAction`
  
  Replace the current single-query deck lookup with:
  
  - [x] **Step 1: Direct V2 Match** — Check `deck_templates` where `id == deckId`
  - [x] **Step 2: Legacy URL Match** — Check `deck_templates` where `legacy_id == deckId`
  - [x] **Step 3: Subscription Match** — Check `user_decks` where `id == deckId` → Get `deck_template_id`

- [x] **1.3** Extract into helper function `resolveDeckTemplateId()`
  ```typescript
  async function resolveDeckTemplateId(
    supabase: SupabaseClient,
    deckId: string,
    userId: string
  ): Promise<{ templateId: string; authorId: string } | null>
  ```

- [x] **1.4** Log the resolved Template ID for debugging
  ```typescript
  console.log('[uploadSourceAction] Resolved template:', resolvedTemplate?.templateId, 'from input:', deckId)
  ```

- [x] **1.5** Security check: Verify `template.author_id === user.id` after resolution
  - Log mismatch: `console.warn('[uploadSourceAction] Author mismatch:', { templateAuthor, currentUser })`

---

## Fix 2: Storage Bucket Policy Check

**File:** `src/actions/source-actions.ts`  
**Priority:** 🟠 High

### Tasks

- [x] **2.1** Differentiate error sources in upload flow
  - If DB lookup succeeds but Storage upload fails → Return `'Storage Permission Error'`
  - Current code already handles this partially, but ensure the error message is distinct

- [x] **2.2** Add explicit logging before storage upload
  ```typescript
  console.log('[uploadSourceAction] DB check passed, attempting storage upload for:', filePath)
  ```

- [x] **2.3** Verify storage error handling returns specific error type
  - Ensure `policy` / `permission` / `Unauthorized` errors return: `'Storage Permission Error: ...'`

---

## Fix 3: Apply Same Pattern to `linkSourceToDeckAction`

**File:** `src/actions/source-actions.ts`  
**Priority:** 🟡 Medium

### Tasks

- [x] **3.1** Reuse `resolveDeckTemplateId()` helper in `linkSourceToDeckAction`
- [x] **3.2** Add same diagnostic logging pattern

---

## Implementation Notes

1. **Legacy ID is the likely culprit** — URLs from V1 still contain old deck IDs stored in `legacy_id` column
2. **User Deck IDs** — When users access via subscription, the URL may contain `user_decks.id` instead of `deck_templates.id`
3. **Logging is critical** — We need to confirm which lookup step succeeds in production

---

## Verification Checklist

- [ ] Upload PDF to a deck created in V2 (direct ID) → Should work
- [ ] Upload PDF to a deck with legacy URL (legacy_id) → Should now work
- [ ] Upload PDF via subscribed deck page (user_deck ID) → Should now work
- [ ] Attempt upload to another user's deck → Should fail with auth error
- [ ] Check server logs show resolved template ID
