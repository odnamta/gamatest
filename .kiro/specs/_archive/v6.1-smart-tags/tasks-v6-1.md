# V6.1: Smart Tags & Clean Units - Remediation Plan

## Feature 1: Session Tag Presets (Highest Priority)

### UI: Session Header
- [x] Create `TagSelector` component in `src/components/batch/TagSelector.tsx` *(Already exists at src/components/tags/TagSelector.tsx)*
- [x] Add `TagSelector` to `BatchReviewModal` above the card list *(Already integrated in add-bulk page)*
- [x] Label component: "Session Tags (Source/Chapter) - Applied to ALL" *(Label: "Session Tags - Applied to all cards created from this page")*
- [x] Implement local React state for session tags (array of strings) *(useSessionTags hook with localStorage persistence)*
- [x] Style session tags distinctly (blue) vs AI-generated per-card tags (purple in BatchDraftCard)

### Backend: Atomic Tag Merging
- [x] Update `bulkCreateMCQ` signature to accept `sessionTags: string[]`
- [x] Implement tag merge logic: `finalTags = unique([...sessionTags, ...card.tags])`
- [x] **DB MIGRATION**: Add unique index on `(user_id, LOWER(name))` for case-insensitive deduplication
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_lower_name_idx 
  ON tags (user_id, LOWER(name));
  ```
- [x] Implement atomic UPSERT for tags with race condition handling
- [x] Update `src/lib/tag-merge.ts` to use case-insensitive deduplication

---

## Feature 2: AI Prompt Engineering - Medical Integrity (High Priority)

### Strict Data Preservation
- [x] Update system prompt in `draftBatchMCQFromText` with:
  - [x] Rule 1 (Units): "DATA INTEGRITY: Maintain ALL original units (imperial or metric) exactly as found. Do NOT convert lb to kg. Do NOT round numbers."
  - [x] Rule 2 (No Hallucination): "Never invent, infer, or guess new clinical numbers. If a value is missing in the text, leave it missing in the question."
  - [x] Rule 3 (Verbatim): "Extract questions verbatim from source material. Do NOT 'improve' or rephrase clinical data."

### Conceptual Tagging
- [x] Update system prompt for tag generation:
  - [x] "Generate 1-3 MEDICAL CONCEPT tags only (e.g., Preeclampsia, PelvicAnatomy)"
  - [x] "Format: Use PascalCase without spaces for internal storage"
  - [x] "Do NOT generate structural tags (e.g., Chapter1, Lange) - these are handled by Session Tags"

---

## Feature 3: UX Polish (Medium Priority)

### Save State Feedback
- [x] Disable "Save" button during `isSubmitting` state *(Already implemented)*
- [x] Update button text during save: `<Spinner /> Saving {n} Cards...`
- [x] Implement error toast: "Save failed. Please check your connection. (Error Code: X)"
- [x] Add loading spinner component if not already available *(Using Loader2 from lucide-react)*

---

## Implementation Order

1. ✅ **DB Migration** - Added unique index on `(user_id, LOWER(name))`
2. ✅ **Backend: Tag Merging** - Updated server action with `sessionTags` param and atomic upsert
3. ✅ **AI Prompts** - Updated system prompt with medical integrity rules
4. ✅ **UI: TagSelector** - Already exists, integrated in add-bulk page
5. ✅ **UX Polish** - Added loading states and enhanced error handling

---

## Files Modified

| File | Changes |
|------|---------|
| `schema.sql` | ✅ Added `tags_user_id_lower_name_idx` unique index |
| `src/actions/batch-mcq-actions.ts` | ✅ Added `sessionTags` param, atomic upsert, medical integrity prompts |
| `src/lib/batch-mcq-schema.ts` | ✅ Added `sessionTags` to `bulkCreateInputSchema` |
| `src/lib/tag-merge.ts` | ✅ Updated docs for case-insensitive deduplication |
| `src/components/batch/BatchReviewPanel.tsx` | ✅ Pass sessionTags to server, enhanced error feedback |

---

## DB Migration Status

✅ **Migration Applied via Supabase MCP** (2025-11-29)

The following was applied to production Supabase (`celline-prep-mvp`):

```sql
-- Tags table for card organization
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- RLS Policies for tags (user ownership)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_tags_user_id ON tags(user_id);
CREATE UNIQUE INDEX tags_user_id_lower_name_idx 
  ON tags (user_id, LOWER(name));

-- Card tags join table
CREATE TABLE card_tags (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_id, tag_id)
);

-- RLS Policies for card_tags
ALTER TABLE card_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage card_tags for own cards" ON card_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cards
      JOIN decks ON decks.id = cards.deck_id
      WHERE cards.id = card_tags.card_id AND decks.user_id = auth.uid()
    )
  );

-- Indexes for efficient filtering
CREATE INDEX idx_card_tags_card_id ON card_tags(card_id);
CREATE INDEX idx_card_tags_tag_id ON card_tags(tag_id);
```

## Verification Summary

| Check | Status |
|-------|--------|
| `tags` table exists | ✅ |
| `card_tags` table exists | ✅ |
| `tags_user_id_lower_name_idx` index | ✅ |
| RLS enabled on `tags` | ✅ |
| RLS enabled on `card_tags` | ✅ |
| All 421 tests pass | ✅ |
